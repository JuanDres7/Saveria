import { describe, expect, it } from 'bun:test';
import { type AccountRuleView, checkAccountChange, MAX_ACTIVE_ACCOUNTS } from '../src';

const ARCHIVED = '2026-10-20T00:00:00.000Z';

const account = (over: Partial<AccountRuleView> = {}): AccountRuleView => ({
  id: crypto.randomUUID(),
  name: 'Cuenta',
  currency: 'COP',
  isDefault: false,
  archivedAt: null,
  ...over,
});

const efectivo = account({ name: 'Efectivo', isDefault: true });

describe('checkAccountChange', () => {
  it('una cuenta nueva válida no tiene errores', () => {
    const next = account({ name: 'Nequi' });
    expect(
      checkAccountChange({ next, previous: null, others: [efectivo], hasTransactions: false }),
    ).toEqual({});
  });

  it('3.5 nombre repetido entre activas, sin distinguir mayúsculas', () => {
    const others = [efectivo, account({ name: 'Nequi' })];
    const errors = checkAccountChange({
      next: account({ name: ' nequi ' }),
      previous: null,
      others,
      hasTransactions: false,
    });
    expect(errors.name).toBeDefined();
  });

  it('una cuenta archivada no ocupa el nombre', () => {
    const others = [efectivo, account({ name: 'Nequi', archivedAt: ARCHIVED })];
    expect(
      checkAccountChange({
        next: account({ name: 'Nequi' }),
        previous: null,
        others,
        hasTransactions: false,
      }),
    ).toEqual({});
  });

  it('FR-023 no permite la cuenta activa número 21', () => {
    const others = [
      efectivo,
      ...Array.from({ length: MAX_ACTIVE_ACCOUNTS - 1 }, (_, i) => account({ name: `C${i}` })),
    ];
    const errors = checkAccountChange({
      next: account({ name: 'Otra' }),
      previous: null,
      others,
      hasTransactions: false,
    });
    expect(errors.account).toBeDefined();
  });

  it('FR-020 no deja quitar la marca a la única cuenta por defecto', () => {
    const errors = checkAccountChange({
      next: { ...efectivo, isDefault: false },
      previous: efectivo,
      others: [account({ name: 'Nequi' })],
      hasTransactions: false,
    });
    expect(errors.isDefault).toBeDefined();
  });

  it('quitar la marca está bien si otra cuenta activa ya es la cuenta por defecto', () => {
    expect(
      checkAccountChange({
        next: { ...efectivo, isDefault: false },
        previous: efectivo,
        others: [account({ name: 'Nequi', isDefault: true })],
        hasTransactions: false,
      }),
    ).toEqual({});
  });

  it('3.7 no se puede archivar la cuenta por defecto', () => {
    const errors = checkAccountChange({
      next: { ...efectivo, archivedAt: ARCHIVED },
      previous: efectivo,
      others: [],
      hasTransactions: false,
    });
    expect(errors.archivedAt).toBeDefined();
  });

  it('3.6 archivar con saldo distinto de cero está permitido', () => {
    const nequi = account({ name: 'Nequi' });
    expect(
      checkAccountChange({
        next: { ...nequi, archivedAt: ARCHIVED },
        previous: nequi,
        others: [efectivo],
        hasTransactions: true,
      }),
    ).toEqual({});
  });

  it('3.8 la moneda no cambia si la cuenta tiene movimientos', () => {
    const nequi = account({ name: 'Nequi' });
    const change = { next: { ...nequi, currency: 'USD' }, previous: nequi, others: [efectivo] };
    expect(checkAccountChange({ ...change, hasTransactions: true }).currency).toBeDefined();
    expect(checkAccountChange({ ...change, hasTransactions: false })).toEqual({});
  });

  it('FR-021 reactivar con un nombre ya usado por otra activa pide renombrarla', () => {
    const old = account({ name: 'Nequi', archivedAt: ARCHIVED });
    const errors = checkAccountChange({
      next: { ...old, archivedAt: null },
      previous: old,
      others: [efectivo, account({ name: 'NEQUI' })],
      hasTransactions: false,
    });
    expect(errors.name).toContain('reactivar');
  });

  it('FR-021 reactivar con 20 activas pide archivar otra', () => {
    const old = account({ name: 'Vieja', archivedAt: ARCHIVED });
    const others = [
      efectivo,
      ...Array.from({ length: MAX_ACTIVE_ACCOUNTS - 1 }, (_, i) => account({ name: `C${i}` })),
    ];
    const errors = checkAccountChange({
      next: { ...old, archivedAt: null },
      previous: old,
      others,
      hasTransactions: false,
    });
    expect(errors.archivedAt).toContain('Archiva otra');
  });

  it('editar una cuenta activa no cuenta para el límite', () => {
    const nequi = account({ name: 'Nequi' });
    const others = [
      efectivo,
      ...Array.from({ length: MAX_ACTIVE_ACCOUNTS - 2 }, (_, i) => account({ name: `C${i}` })),
    ];
    expect(
      checkAccountChange({
        next: { ...nequi, name: 'Nequi 2' },
        previous: nequi,
        others,
        hasTransactions: false,
      }),
    ).toEqual({});
  });
});
