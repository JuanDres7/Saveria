import { selectBalanceCard } from '../src/features/accounts/balance-card';
import { summarizeAccounts } from '../src/features/transactions/ledger';
import { makeAccountRecord } from './support/ledger';

const profileDefault = { id: 'perfil', name: 'Efectivo', currency: 'COP', initialBalance: '0' };

const select = (
  accounts: ReturnType<typeof makeAccountRecord>[],
  balances: Record<string, string>,
  primary: string | null = 'COP',
  fallback: typeof profileDefault | null = null,
) => selectBalanceCard(summarizeAccounts(accounts, balances, primary), primary, fallback);

describe('tarjeta de balance (FR-012, escenario 1.2)', () => {
  it('con todas las cuentas activas en la moneda principal muestra el total', () => {
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet' });
    const card = select([efectivo, nequi], { [efectivo.id]: '50000', [nequi.id]: '30000' });
    expect(card).toEqual({ kind: 'total', amount: '80000', currency: 'COP', accountCount: 2 });
  });

  it('con monedas distintas muestra el saldo de la cuenta por defecto, nunca un total mezclado', () => {
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const ahorros = makeAccountRecord({ name: 'Ahorros USD', currency: 'USD' });
    const card = select([ahorros, efectivo], { [efectivo.id]: '50000', [ahorros.id]: '10' });
    expect(card).toMatchObject({
      kind: 'account',
      name: 'Efectivo',
      currency: 'COP',
      balance: '50000',
      negative: false,
      otherCurrencies: true,
    });
  });

  it('las cuentas archivadas no suman ni cuentan como otra moneda', () => {
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const vieja = makeAccountRecord({
      name: 'Vieja USD',
      currency: 'USD',
      archivedAt: '2026-10-01T00:00:00.000Z',
    });
    const card = select([efectivo, vieja], { [efectivo.id]: '80000', [vieja.id]: '5' });
    expect(card).toEqual({ kind: 'total', amount: '80000', currency: 'COP', accountCount: 1 });
  });

  it('si la cuenta por defecto está archivada, usa la primera cuenta activa', () => {
    const efectivo = makeAccountRecord({
      name: 'Efectivo',
      isDefault: true,
      archivedAt: '2026-10-01T00:00:00.000Z',
    });
    const dolares = makeAccountRecord({ name: 'Dólares', currency: 'USD' });
    const euros = makeAccountRecord({ name: 'Euros', currency: 'EUR' });
    const card = select([efectivo, dolares, euros], { [dolares.id]: '10', [euros.id]: '20' });
    expect(card).toMatchObject({ kind: 'account', name: 'Dólares', otherCurrencies: true });
  });

  it('un saldo negativo se marca como tal', () => {
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const ahorros = makeAccountRecord({ name: 'Ahorros USD', currency: 'USD' });
    const card = select([efectivo, ahorros], { [efectivo.id]: '-18000', [ahorros.id]: '10' });
    expect(card).toMatchObject({ kind: 'account', balance: '-18000', negative: true });
  });

  it('sin moneda principal no hay total: muestra la cuenta por defecto', () => {
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const card = select([efectivo], { [efectivo.id]: '1000' }, null);
    expect(card).toMatchObject({ kind: 'account', name: 'Efectivo', otherCurrencies: false });
  });

  it('sin cuentas locales todavía usa la cuenta por defecto del perfil', () => {
    const card = select([], {}, 'COP', profileDefault);
    expect(card).toMatchObject({
      kind: 'account',
      name: 'Efectivo',
      currency: 'COP',
      balance: '0',
      negative: false,
      otherCurrencies: false,
    });
  });

  it('sin cuentas y sin cuenta por defecto no hay tarjeta', () => {
    expect(select([], {})).toBeNull();
  });
});
