import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CATEGORIES, categoriesFor, isCategoryOfType } from '../src';

const CONTRACT = fileURLToPath(
  new URL('../../../specs/002-accounts-transactions/contracts/openapi.yaml', import.meta.url),
);

describe('catálogo de categorías', () => {
  it('tiene 18 categorías de gasto y 8 de ingreso', () => {
    expect(CATEGORIES.filter((c) => c.type === 'expense')).toHaveLength(18);
    expect(CATEGORIES.filter((c) => c.type === 'income')).toHaveLength(8);
  });

  it('los slugs son únicos y coinciden con el enum CategorySlug del contrato', () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const contract = parse(readFileSync(CONTRACT, 'utf8'));
    expect([...slugs].sort()).toEqual([...contract.components.schemas.CategorySlug.enum].sort());
  });

  it('1.3 categoriesFor devuelve solo las del tipo pedido', () => {
    expect(categoriesFor('expense').every((c) => c.type === 'expense')).toBe(true);
    expect(categoriesFor('income').map((c) => c.slug)).toContain('salary');
    expect(categoriesFor('income').map((c) => c.slug)).not.toContain('dining');
  });

  it('isCategoryOfType distingue gasto de ingreso', () => {
    expect(isCategoryOfType('dining', 'expense')).toBe(true);
    expect(isCategoryOfType('salary', 'expense')).toBe(false);
    expect(isCategoryOfType('inventada', 'income')).toBe(false);
  });
});
