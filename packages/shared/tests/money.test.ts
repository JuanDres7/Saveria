import { describe, expect, it } from 'bun:test';
import { compareAmounts, formatAmount, fromE4, parseAmount, toE4 } from '../src';

describe('parseAmount (entrada al estilo colombiano)', () => {
  it('"18.000" en COP es 18000 (punto de miles)', () => {
    expect(parseAmount('18.000', 'COP')).toEqual({ ok: true, value: '18000' });
  });

  it('"12,50" en USD es 12.50 (coma decimal)', () => {
    expect(parseAmount('12,50', 'USD')).toEqual({ ok: true, value: '12.50' });
  });

  it('completa los decimales de la moneda', () => {
    expect(parseAmount('12,5', 'USD')).toEqual({ ok: true, value: '12.50' });
    expect(parseAmount('7', 'USD')).toEqual({ ok: true, value: '7.00' });
    expect(parseAmount('1.250.000', 'COP')).toEqual({ ok: true, value: '1250000' });
  });

  it('acepta un punto decimal cuando no forma grupos de miles', () => {
    expect(parseAmount('12.5', 'USD')).toEqual({ ok: true, value: '12.50' });
  });

  it('ignora el signo $ y los espacios', () => {
    expect(parseAmount(' $ 18.000 ', 'COP')).toEqual({ ok: true, value: '18000' });
  });

  it('1.6 COP no acepta decimales', () => {
    expect(parseAmount('18000,5', 'COP').ok).toBe(false);
  });

  it('USD no acepta más de 2 decimales', () => {
    expect(parseAmount('1,234', 'USD').ok).toBe(false);
  });

  it('rechaza más de 12 dígitos enteros', () => {
    expect(parseAmount('1234567890123', 'COP').ok).toBe(false);
    expect(parseAmount('123456789012', 'COP')).toEqual({ ok: true, value: '123456789012' });
  });

  it('rechaza texto vacío o con letras', () => {
    expect(parseAmount('', 'COP').ok).toBe(false);
    expect(parseAmount('18 mil', 'COP').ok).toBe(false);
  });

  it('el signo solo se acepta si se pide', () => {
    expect(parseAmount('-5.000', 'COP').ok).toBe(false);
    expect(parseAmount('-5.000', 'COP', { allowNegative: true })).toEqual({
      ok: true,
      value: '-5000',
    });
  });
});

describe('toE4 / fromE4 (enteros en diezmilésimas)', () => {
  it('toE4("18000") = 180000000n', () => {
    expect(toE4('18000')).toBe(180000000n);
  });

  it('fromE4(-50000000n) = "-5000"', () => {
    expect(fromE4(-50000000n)).toBe('-5000');
  });

  it('ida y vuelta sin pérdida con 4 decimales', () => {
    for (const text of ['0.0001', '-123456789012.9999', '12.5', '0']) {
      expect(fromE4(toE4(text))).toBe(text);
    }
  });

  it('suma exacta donde el punto flotante falla', () => {
    expect(fromE4(toE4('0.1') + toE4('0.2'))).toBe('0.3');
  });

  it('rechaza texto que no es un decimal', () => {
    expect(() => toE4('12,5')).toThrow();
    expect(() => toE4('abc')).toThrow();
  });
});

describe('formatAmount y compareAmounts', () => {
  it('formatea al estilo colombiano', () => {
    expect(formatAmount('18000', 'COP')).toBe('$ 18.000');
    expect(formatAmount('1234.5', 'USD')).toBe('US$ 1.234,50');
    expect(formatAmount('-5000', 'COP')).toBe('-$ 5.000');
  });

  it('compara montos sin pasar por number', () => {
    expect(compareAmounts('10', '9.9999')).toBe(1);
    expect(compareAmounts('-1', '0')).toBe(-1);
    expect(compareAmounts('12.50', '12.5')).toBe(0);
  });
});
