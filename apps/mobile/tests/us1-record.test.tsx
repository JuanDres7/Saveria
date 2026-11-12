import { localToday } from '@saveria/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import type { LocalAccountRecord } from '../src/features/accounts/local-accounts';
import {
  type LedgerContext,
  openLedgerContext,
  refreshLedger,
  setLedgerContextForTests,
  useLedger,
} from '../src/features/transactions/ledger';
import { transactionOutboxHandlers } from '../src/features/transactions/transaction-service';
import { createHttpSender } from '../src/outbox/http-sender';
import { createOutbox } from '../src/outbox/outbox';
import { type Me, useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';
import { MemoryAccounts, MemoryLedger, MemoryOutboxStore } from './support/memory';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

import Home from '../src/app/(app)/home';
import NewTransaction from '../src/app/(app)/transactions/new';

const T = '2026-10-28T12:00:00.000Z';

const account = (over: Partial<LocalAccountRecord>): LocalAccountRecord => ({
  id: crypto.randomUUID(),
  name: 'Cuenta',
  type: 'cash',
  currency: 'COP',
  initialBalance: '0',
  isDefault: false,
  archivedAt: null,
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
  syncState: 'synced',
  syncError: null,
  ...over,
});

interface Setup {
  accounts: MemoryAccounts;
  ledger: MemoryLedger;
  queue: MemoryOutboxStore;
  requests: Request[];
  efectivo: LocalAccountRecord;
  usd: LocalAccountRecord;
}

/** Base local en memoria con "Efectivo" (COP, por defecto) y una cuenta en USD. */
function setup(
  respond: (request: Request) => Response = () => new Response('{}', { status: 200 }),
) {
  const accounts = new MemoryAccounts();
  const ledger = new MemoryLedger(accounts);
  const efectivo = account({ name: 'Efectivo', isDefault: true });
  const usd = account({ name: 'Ahorros USD', currency: 'USD' });
  accounts.save(efectivo);
  accounts.save(usd);
  const queue = new MemoryOutboxStore();
  const requests: Request[] = [];
  const sender = createHttpSender(
    async (request) => {
      requests.push(request.clone());
      return respond(request);
    },
    'http://api.test',
    transactionOutboxHandlers(),
  );
  const ctx: LedgerContext = { accounts, ledger, outbox: createOutbox(queue, sender) };
  setLedgerContextForTests(() => ctx);
  refreshLedger();
  return { accounts, ledger, queue, requests, efectivo, usd } satisfies Setup;
}

function signIn(isOnline: boolean) {
  const base = makeMe({ onboardingStep: 'done' });
  const me: Me = { ...base, profile: { ...base.profile, primaryCurrency: 'COP' } };
  useSession.setState({ status: 'signedIn', me, accessToken: 'access', isOnline, notice: null });
}

const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const typeAmount = (text: string) => fireEvent.changeText(screen.getByLabelText('Monto'), text);
const save = () => fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
/** Deja correr el envío del outbox (promesas pendientes). */
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

afterEach(() => {
  setLedgerContextForTests();
  useLedger.setState({ accounts: [], balances: {}, recent: [] });
  jest.clearAllMocks();
});

describe('historia 1: registrar un gasto o un ingreso', () => {
  it('1.1 abre con "gasto", la cuenta por defecto y la fecha de hoy', async () => {
    signIn(true);
    setup();
    await render(<NewTransaction />);
    expect(radio('Gasto')).toBeChecked();
    expect(radio('Efectivo')).toBeChecked();
    expect(radio('Hoy')).toBeChecked();
  });

  it('1.2 monto + categoría + "Guardar" registra el gasto en 3 toques (SC-001)', async () => {
    signIn(false);
    const { ledger, efectivo } = setup();
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await render(<NewTransaction />);
    await typeAmount('18.000');
    await fireEvent.press(radio('Restaurantes y domicilios')); // toque 2 (el 1 es el "+")
    // Con el monto escrito se cierra el teclado: si no, tapa "Guardar" (visto en el emulador).
    expect(dismiss).toHaveBeenCalled();
    await save(); // toque 3

    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]).toMatchObject({
      type: 'expense',
      amount: '18000',
      currency: 'COP',
      accountId: efectivo.id,
      categorySlug: 'dining',
      occurredOn: localToday(),
      syncState: 'pending',
    });
  });

  it('1.3 "ingreso" muestra solo las 8 categorías de ingreso', async () => {
    signIn(true);
    setup();
    await render(<NewTransaction />);
    expect(screen.queryByRole('radio', { name: 'Salario' })).toBeNull();
    await fireEvent.press(radio('Ingreso'));
    expect(radio('Salario')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Restaurantes y domicilios' })).toBeNull();
    for (const name of ['Primas y bonos', 'Reembolsos', 'Otros ingresos']) {
      expect(radio(name)).toBeTruthy();
    }
  });

  it('1.4 sin red se guarda, aparece en Inicio y queda en el outbox; con red se envía', async () => {
    signIn(false);
    const { queue, requests, ledger } = setup();
    await render(<NewTransaction />);
    await typeAmount('18000');
    await fireEvent.press(radio('Restaurantes y domicilios'));
    await save();

    expect(queue.items).toHaveLength(1);
    expect(requests).toHaveLength(0);
    await render(<Home />);
    expect(screen.getByText('Restaurantes y domicilios')).toBeTruthy();
    // El monto del movimiento va en su fila; el saldo, en la tarjeta de «Efectivo» y en el balance.
    const fila = screen.getByRole('button', { name: 'Restaurantes y domicilios 18000' });
    expect(within(fila).getByText('−$ 18.000')).toBeTruthy();
    expect(screen.getByText('−$ 18.000 COP')).toBeTruthy(); // saldo de "Efectivo"

    // Vuelve la red: el outbox envía el registro completo y el movimiento queda enviado.
    useSession.setState({ isOnline: true });
    await act(async () => {
      await openLedgerContext()?.outbox.flush();
      refreshLedger();
    });
    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.url).toBe(`http://api.test/v1/transactions/${ledger.rows[0]?.id}`);
    expect(await requests[0]?.json()).toMatchObject({ amount: '18000', categorySlug: 'dining' });
    expect(ledger.rows[0]?.syncState).toBe('synced');
  });

  it('1.5 sin monto, con 0 o sin categoría no se guarda y dice qué falta', async () => {
    signIn(true);
    const { ledger } = setup();
    await render(<NewTransaction />);
    await save();
    expect(screen.getByText('Escribe un monto')).toBeTruthy();
    expect(screen.getByText('Elige una categoría')).toBeTruthy();

    await typeAmount('0');
    await fireEvent.press(radio('Mercado'));
    await save();
    expect(screen.getByText('El monto debe ser mayor que cero')).toBeTruthy();
    expect(ledger.rows).toHaveLength(0);
  });

  it('1.6 en COP no acepta decimales; en USD sí 2', async () => {
    signIn(false);
    const { ledger } = setup();
    await render(<NewTransaction />);
    await typeAmount('18000,50');
    await fireEvent.press(radio('Mercado'));
    await save();
    expect(screen.getByText('Los montos en COP van sin decimales')).toBeTruthy();

    await fireEvent.press(radio('Ahorros USD'));
    await save();
    expect(ledger.rows[0]).toMatchObject({ amount: '18000.50', currency: 'USD' });
  });

  it('FR-037 un rechazo del servidor deja el movimiento con "no se pudo guardar" y el motivo', async () => {
    signIn(true);
    const { ledger } = setup(
      () =>
        new Response(
          JSON.stringify({
            code: 'validation_error',
            message: 'Los datos enviados no son válidos',
            fields: { accountId: 'La cuenta no existe' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    await render(<NewTransaction />);
    await typeAmount('18000');
    await fireEvent.press(radio('Mercado'));
    await save();
    await settle();

    expect(ledger.rows[0]).toMatchObject({
      syncState: 'rejected',
      syncError: 'La cuenta no existe',
    });
    await render(<Home />);
    expect(screen.getByText('No se pudo guardar: La cuenta no existe')).toBeTruthy();
  });
});
