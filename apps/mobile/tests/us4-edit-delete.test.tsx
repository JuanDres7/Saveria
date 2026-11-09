import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { openLedgerContext, refreshLedger } from '../src/features/transactions/ledger';
import { transactionService } from '../src/features/transactions/transaction-service';
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

import Home from '../src/app/(app)/home';
import EditTransaction from '../src/app/(app)/transactions/[id]';
import NewTransaction from '../src/app/(app)/transactions/new';
import { UndoSnackbar } from '../src/features/transactions/UndoSnackbar';

afterEach(() => {
  jest.useRealTimers();
  resetLedger();
  jest.clearAllMocks();
});

const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

const efectivo = () => makeAccountRecord({ name: 'Efectivo', isDefault: true });

/** La pantalla de editar junto al aviso "Deshacer", que en la app vive en el layout. */
async function openEdit(id: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
  await render(
    <>
      <EditTransaction />
      <UndoSnackbar />
    </>,
  );
}

describe('historia 4: editar un movimiento', () => {
  it('4.1 editar el monto recalcula el saldo y encola el registro completo', async () => {
    signInWith({ isOnline: false });
    const account = efectivo();
    const { ledger, queue } = setupLedger([account]);
    const gasto = makeTxRecord(account.id, { amount: '18000' });
    ledger.save(gasto);
    await openEdit(gasto.id);
    expect(screen.getByLabelText('Monto').props.value).toBe('18000');

    await type('Monto', '20.000');
    await fireEvent.press(button('Guardar cambios'));

    expect(ledger.findById(gasto.id)).toMatchObject({ amount: '20000', syncState: 'pending' });
    expect(ledger.balances().get(account.id)).toBe('-20000');
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ entity: 'transaction', operation: 'upsert' });
    expect(router.back).toHaveBeenCalled();
  });

  it('4.2 cambiar categoría, cuenta o fecha se refleja y mueve los saldos', async () => {
    signInWith({ isOnline: false });
    const account = efectivo();
    const nequi = makeAccountRecord({ name: 'Nequi' });
    const { ledger } = setupLedger([account, nequi]);
    const gasto = makeTxRecord(account.id);
    ledger.save(gasto);
    await openEdit(gasto.id);

    await fireEvent.press(radio('Transporte'));
    await fireEvent.press(radio('Nequi'));
    await fireEvent.press(radio('Ayer'));
    await fireEvent.press(button('Guardar cambios'));

    expect(ledger.findById(gasto.id)).toMatchObject({
      categorySlug: 'transport',
      accountId: nequi.id,
    });
    expect(ledger.balances().get(account.id)).toBe('0');
    expect(ledger.balances().get(nequi.id)).toBe('-18000');
    expect(ledger.findById(gasto.id)?.occurredOn).not.toBe(gasto.occurredOn);
  });

  it('4.3 mover a una cuenta de otra moneda pide el monto en la nueva moneda', async () => {
    signInWith({ isOnline: false });
    const account = efectivo();
    const usd = makeAccountRecord({ name: 'Ahorros USD', currency: 'USD' });
    const { ledger } = setupLedger([account, usd]);
    const gasto = makeTxRecord(account.id, { amount: '40000' });
    ledger.save(gasto);
    await openEdit(gasto.id);

    await fireEvent.press(radio('Ahorros USD'));
    // No se convierte solo: el monto se vacía y se avisa.
    expect(screen.getByLabelText('Monto').props.value).toBe('');
    expect(screen.getByText('El monto no se convierte solo: escríbelo en USD')).toBeTruthy();
    await fireEvent.press(button('Guardar cambios'));
    expect(screen.getByText('Escribe un monto')).toBeTruthy();
    expect(ledger.findById(gasto.id)?.currency).toBe('COP');

    await type('Monto', '10,50');
    await fireEvent.press(button('Guardar cambios'));
    expect(ledger.findById(gasto.id)).toMatchObject({
      accountId: usd.id,
      currency: 'USD',
      amount: '10.50',
    });
  });

  it('una cuenta archivada sigue en el selector del movimiento, pero no al registrar uno nuevo', async () => {
    signInWith({ isOnline: false });
    const vieja = makeAccountRecord({
      name: 'Vieja',
      archivedAt: '2026-10-20T00:00:00.000Z',
    });
    const { ledger } = setupLedger([efectivo(), vieja]);
    const gasto = makeTxRecord(vieja.id);
    ledger.save(gasto);
    await openEdit(gasto.id);
    expect(radio('Vieja')).toBeChecked();

    await render(<NewTransaction />);
    expect(screen.queryByRole('radio', { name: 'Vieja' })).toBeNull();
  });
});

describe('historia 4: borrar con "Deshacer"', () => {
  it('4.4 borrar quita el movimiento al instante y muestra "Deshacer"', async () => {
    signInWith({ isOnline: false });
    const account = efectivo();
    const { ledger, queue } = setupLedger([account]);
    const gasto = makeTxRecord(account.id);
    ledger.save(gasto);
    await openEdit(gasto.id);

    await fireEvent.press(button('Borrar'));

    expect(ledger.findById(gasto.id)?.deletedAt).not.toBeNull();
    expect(ledger.balances().get(account.id)).toBe('0');
    expect(queue.items[0]).toMatchObject({ entity: 'transaction', operation: 'delete' });
    expect(router.back).toHaveBeenCalled();
    expect(screen.getByText('Movimiento borrado')).toBeTruthy();
    expect(button('Deshacer')).toBeTruthy();
  });

  it('"Deshacer" se ve al menos 5 segundos y luego desaparece', async () => {
    jest.useFakeTimers();
    signInWith({ isOnline: false });
    const account = efectivo();
    const { ledger } = setupLedger([account]);
    const gasto = makeTxRecord(account.id);
    ledger.save(gasto);
    await openEdit(gasto.id);
    await fireEvent.press(button('Borrar'));

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    expect(ledger.findById(gasto.id)?.deletedAt).not.toBeNull();
  });

  it('4.5 "Deshacer" restaura el movimiento y el saldo', async () => {
    signInWith({ isOnline: false });
    const account = efectivo();
    const { ledger, queue } = setupLedger([account]);
    const gasto = makeTxRecord(account.id);
    ledger.save(gasto);
    await openEdit(gasto.id);
    await fireEvent.press(button('Borrar'));
    await fireEvent.press(button('Deshacer'));

    expect(ledger.findById(gasto.id)?.deletedAt).toBeNull();
    expect(ledger.balances().get(account.id)).toBe('-18000');
    // Borrar y deshacer sin red: un solo cambio pendiente, el registro completo.
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ operation: 'upsert' });
    expect(screen.queryByText('Movimiento borrado')).toBeNull();
  });

  it('4.6 sin red, crear, editar y borrar envía un solo cambio con el estado final', async () => {
    signInWith({ isOnline: false });
    const account = efectivo();
    const { queue, requests } = setupLedger([account]);
    const created = transactionService.record({
      type: 'expense',
      amountText: '18.000',
      accountId: account.id,
      categorySlug: 'dining',
      occurredOn: '2026-10-28',
      description: '',
    });
    if (!created.ok) throw new Error('no se creó');
    const id = created.transaction.id;
    expect(queue.items).toHaveLength(1);

    transactionService.update(id, {
      type: 'expense',
      amountText: '20.000',
      accountId: account.id,
      categorySlug: 'dining',
      occurredOn: '2026-10-28',
      description: '',
    });
    expect(queue.items).toHaveLength(1);
    transactionService.remove(id);
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ operation: 'delete' });

    // Vuelve la red: llega solo el borrado final, no la creación ni la edición.
    useSessionOnline();
    await openLedgerContext()?.outbox.flush();
    expect(requests.map((r) => r.method)).toEqual(['DELETE']);
  });

  it('FR-037 un borrado rechazado por el servidor muestra el movimiento "no se pudo borrar" y deja reintentar', async () => {
    signInWith({ isOnline: true });
    const account = efectivo();
    const { ledger, requests } = setupLedger([account], (request) =>
      request.method === 'DELETE'
        ? new Response(
            JSON.stringify({
              code: 'validation_error',
              message: 'Los datos enviados no son válidos',
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          )
        : new Response('{}', { status: 200 }),
    );
    const gasto = makeTxRecord(account.id);
    ledger.save(gasto);

    transactionService.remove(gasto.id);
    await act(async () => {
      await openLedgerContext()?.outbox.flush();
    });
    refreshLedger();

    // El borrado no se aplicó en el servidor: el movimiento vuelve a verse, marcado.
    expect(ledger.findById(gasto.id)).toMatchObject({ deletedAt: null, syncState: 'rejected' });
    await render(<Home />);
    expect(screen.getByText('No se pudo borrar: Los datos enviados no son válidos')).toBeTruthy();

    await fireEvent.press(button('Reintentar borrado'));
    await act(async () => {
      await openLedgerContext()?.outbox.flush();
    });
    expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(2);
  });
});

function useSessionOnline() {
  signInWith({ isOnline: true });
}
