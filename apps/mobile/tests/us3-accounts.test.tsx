import { MAX_ACTIVE_ACCOUNTS } from '@saveria/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { openLedgerContext, refreshLedger } from '../src/features/transactions/ledger';
import {
  makeAccountRecord,
  makeTxRecord,
  resetLedger,
  setupLedger,
  signInWith,
} from './support/ledger';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

import AccountDetail from '../src/app/(app)/accounts/[id]';
import ArchivedAccounts from '../src/app/(app)/accounts/archived';
import Accounts from '../src/app/(app)/accounts/index';
import NewAccount from '../src/app/(app)/accounts/new';
import History from '../src/app/(app)/transactions/index';
import NewTransaction from '../src/app/(app)/transactions/new';

const ARCHIVED = '2026-10-20T00:00:00.000Z';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
});

const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

/** Abre la pantalla de detalle de una cuenta. */
async function openDetail(id: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
  await render(<AccountDetail />);
}

function efectivoAccount() {
  return makeAccountRecord({ name: 'Efectivo', isDefault: true });
}

describe('historia 3: gestionar cuentas', () => {
  it('3.1 y 3.2 crear "Nequi" con la moneda principal preseleccionada y saldo inicial', async () => {
    signInWith({ currency: 'COP', isOnline: false });
    const { accounts } = setupLedger([efectivoAccount()]);
    await render(<NewAccount />);
    expect(radio('COP')).toBeChecked();
    await type('Nombre', 'Nequi');
    await fireEvent.press(radio('Billetera digital'));
    await type('Saldo inicial', '80.000');
    await fireEvent.press(button('Crear cuenta'));

    const nequi = accounts.list().find((a) => a.name === 'Nequi');
    expect(nequi).toMatchObject({
      type: 'wallet',
      currency: 'COP',
      initialBalance: '80000',
      isDefault: false,
      syncState: 'pending',
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('3.1 la lista muestra cada cuenta activa con su saldo', async () => {
    signInWith();
    setupLedger([efectivoAccount(), makeAccountRecord({ name: 'Nequi', initialBalance: '80000' })]);
    await render(<Accounts />);
    expect(screen.getByText('$ 80.000 COP')).toBeTruthy();
    expect(screen.getByText('Efectivo')).toBeTruthy();
    expect(screen.getByText('Cuenta por defecto')).toBeTruthy();
  });

  it('3.3 marcarla por defecto cambia la cuenta preseleccionada al registrar', async () => {
    signInWith({ isOnline: false });
    const nequi = makeAccountRecord({ name: 'Nequi' });
    const { accounts } = setupLedger([efectivoAccount(), nequi]);
    await openDetail(nequi.id);
    await fireEvent.press(button('Usar como cuenta por defecto'));
    expect(accounts.findById(nequi.id)?.isDefault).toBe(true);
    expect(accounts.list().filter((a) => a.isDefault)).toHaveLength(1);

    await render(<NewTransaction />);
    expect(radio('Nequi')).toBeChecked();
  });

  it('3.4 renombrar se ve en los movimientos', async () => {
    signInWith({ isOnline: false });
    const nequi = makeAccountRecord({ name: 'Nequi' });
    const { accounts, ledger } = setupLedger([efectivoAccount(), nequi]);
    ledger.save(makeTxRecord(nequi.id));
    await openDetail(nequi.id);
    await type('Nombre', 'Nequi personal');
    await fireEvent.press(button('Guardar cambios'));
    expect(accounts.findById(nequi.id)?.name).toBe('Nequi personal');
    await render(<History />);
    // En el chip del filtro y en el movimiento; el nombre viejo ya no aparece.
    expect(screen.getAllByText('Nequi personal')).toHaveLength(2);
    expect(screen.queryByText('Nequi')).toBeNull();
  });

  it('3.5 no deja crear otra cuenta activa con el mismo nombre', async () => {
    signInWith();
    const { accounts } = setupLedger([efectivoAccount()]);
    await render(<NewAccount />);
    await type('Nombre', 'efectivo');
    await type('Saldo inicial', '0');
    await fireEvent.press(button('Crear cuenta'));
    expect(screen.getByText('Ya tienes una cuenta activa con ese nombre')).toBeTruthy();
    expect(accounts.list()).toHaveLength(1);
  });

  it('3.6 archivar avisa el saldo y la cuenta pasa a "cuentas archivadas"', async () => {
    signInWith({ isOnline: false });
    const nequi = makeAccountRecord({ name: 'Nequi', initialBalance: '20000' });
    const { accounts } = setupLedger([efectivoAccount(), nequi]);
    await openDetail(nequi.id);
    await fireEvent.press(button('Archivar'));
    expect(screen.getByText(/Esta cuenta tiene \$ 20\.000 COP/)).toBeTruthy();
    await fireEvent.press(button('Sí, archivar'));
    expect(accounts.findById(nequi.id)?.archivedAt).not.toBeNull();

    await render(<Accounts />);
    expect(screen.queryByText('Nequi')).toBeNull();
    await render(<ArchivedAccounts />);
    expect(screen.getByText('Nequi')).toBeTruthy();
    expect(screen.getByText('$ 20.000 COP')).toBeTruthy();
  });

  it('3.7 la cuenta por defecto pide elegir otra antes de archivarla', async () => {
    signInWith();
    const efectivo = efectivoAccount();
    const { accounts } = setupLedger([efectivo]);
    await openDetail(efectivo.id);
    await fireEvent.press(button('Archivar'));
    expect(
      screen.getByText(
        'No puedes archivar la cuenta por defecto. Elige otra cuenta por defecto antes',
      ),
    ).toBeTruthy();
    expect(accounts.findById(efectivo.id)?.archivedAt).toBeNull();
  });

  it('3.8 la moneda queda bloqueada si la cuenta tiene movimientos', async () => {
    signInWith();
    const efectivo = efectivoAccount();
    const { ledger } = setupLedger([efectivo]);
    ledger.save(makeTxRecord(efectivo.id));
    await openDetail(efectivo.id);
    expect(
      screen.getByText('No puedes cambiar la moneda de una cuenta que ya tiene movimientos'),
    ).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'USD' })).toBeNull();
  });

  it('3.9 crear sin red la deja usable y en el outbox', async () => {
    signInWith({ isOnline: false });
    const { queue, requests } = setupLedger([efectivoAccount()]);
    await render(<NewAccount />);
    await type('Nombre', 'Bancolombia');
    await fireEvent.press(radio('Banco'));
    await type('Saldo inicial', '1.500.000');
    await fireEvent.press(button('Crear cuenta'));
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ entity: 'account', operation: 'upsert' });
    expect(requests).toHaveLength(0);

    await render(<NewTransaction />);
    expect(radio('Bancolombia')).toBeTruthy();
  });

  it('FR-021 reactivar con el nombre ya usado pide renombrarla; renombrada sí se reactiva', async () => {
    signInWith({ isOnline: false });
    const vieja = makeAccountRecord({ name: 'Nequi', archivedAt: ARCHIVED });
    const { accounts } = setupLedger([
      efectivoAccount(),
      vieja,
      makeAccountRecord({ name: 'NEQUI' }),
    ]);
    await openDetail(vieja.id);
    await fireEvent.press(button('Reactivar'));
    expect(
      screen.getByText(
        'Ya tienes una cuenta activa con ese nombre. Cámbiale el nombre para reactivar esta',
      ),
    ).toBeTruthy();
    await type('Nombre', 'Nequi vieja');
    await fireEvent.press(button('Reactivar'));
    expect(accounts.findById(vieja.id)).toMatchObject({ name: 'Nequi vieja', archivedAt: null });
  });

  it('FR-021 reactivar con 20 activas pide archivar otra', async () => {
    signInWith();
    const vieja = makeAccountRecord({ name: 'Vieja', archivedAt: ARCHIVED });
    const others = Array.from({ length: MAX_ACTIVE_ACCOUNTS - 1 }, (_, i) =>
      makeAccountRecord({ name: `C${i}` }),
    );
    setupLedger([efectivoAccount(), vieja, ...others]);
    await openDetail(vieja.id);
    await fireEvent.press(button('Reactivar'));
    expect(screen.getByText(/Archiva otra para reactivar esta/)).toBeTruthy();
  });

  it('FR-037 una cuenta rechazada por el servidor queda marcada y al corregirla se reenvía', async () => {
    signInWith({ isOnline: true });
    let reject = true;
    const { accounts, requests } = setupLedger([efectivoAccount()], () =>
      reject
        ? new Response(
            JSON.stringify({
              code: 'validation_error',
              message: 'Los datos enviados no son válidos',
              fields: { name: 'Ya tienes una cuenta activa con ese nombre' },
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          )
        : new Response('{}', { status: 200 }),
    );
    await render(<NewAccount />);
    await type('Nombre', 'Daviplata');
    await type('Saldo inicial', '0');
    await fireEvent.press(button('Crear cuenta'));
    await openLedgerContext()?.outbox.flush();
    refreshLedger();

    const daviplata = accounts.list().find((a) => a.name === 'Daviplata');
    expect(daviplata).toMatchObject({
      syncState: 'rejected',
      syncError: 'Ya tienes una cuenta activa con ese nombre',
    });
    await render(<Accounts />);
    expect(
      screen.getByText('No se pudo guardar: Ya tienes una cuenta activa con ese nombre'),
    ).toBeTruthy();

    // Al corregirla se vuelve a enviar y queda guardada.
    reject = false;
    await openDetail(daviplata?.id ?? '');
    await type('Nombre', 'Daviplata 2');
    await fireEvent.press(button('Guardar cambios'));
    await openLedgerContext()?.outbox.flush();
    expect(requests).toHaveLength(2);
    expect(accounts.findById(daviplata?.id ?? '')?.syncState).toBe('synced');
  });
});
