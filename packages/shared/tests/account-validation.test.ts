import { describe, expect, it } from 'bun:test';
import { accountInputSchema } from '../src';

const valid = {
  name: 'Nequi',
  type: 'wallet',
  currency: 'COP',
  initialBalance: '80000',
  isDefault: false,
  archivedAt: null,
  updatedAt: '2026-10-28T12:00:00.000Z',
};

const fieldsOf = (input: unknown) => {
  const parsed = accountInputSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((i) => String(i.path[0]));
};

describe('accountInputSchema', () => {
  it('acepta una cuenta válida y recorta el nombre', () => {
    const parsed = accountInputSchema.parse({ ...valid, name: '  Nequi  ' });
    expect(parsed.name).toBe('Nequi');
  });

  it('nombre de 1 a 40 caracteres sin espacios sobrantes', () => {
    expect(fieldsOf({ ...valid, name: '   ' })).toContain('name');
    expect(fieldsOf({ ...valid, name: 'x'.repeat(41) })).toContain('name');
    expect(fieldsOf({ ...valid, name: 'x'.repeat(40) })).toEqual([]);
  });

  it('el tipo es cash, wallet o bank', () => {
    expect(fieldsOf({ ...valid, type: 'cash' })).toEqual([]);
    expect(fieldsOf({ ...valid, type: 'bank' })).toEqual([]);
    expect(fieldsOf({ ...valid, type: 'credit' })).toContain('type');
  });

  it('el saldo inicial puede ser 0 o negativo', () => {
    expect(fieldsOf({ ...valid, initialBalance: '0' })).toEqual([]);
    expect(fieldsOf({ ...valid, initialBalance: '-20000' })).toEqual([]);
  });

  it('el saldo inicial respeta 12 dígitos enteros y los decimales de la moneda', () => {
    expect(fieldsOf({ ...valid, initialBalance: '1234567890123' })).toContain('initialBalance');
    expect(fieldsOf({ ...valid, initialBalance: '100.5' })).toContain('initialBalance');
    expect(fieldsOf({ ...valid, currency: 'USD', initialBalance: '100.50' })).toEqual([]);
  });

  it('la moneda debe ser del catálogo', () => {
    expect(fieldsOf({ ...valid, currency: 'JPY' })).toContain('currency');
  });
});
