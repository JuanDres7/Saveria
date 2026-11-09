import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import type { UserDb } from '../src/db/open-user-db';
import * as schema from '../src/db/schema';
import { LocalAccounts } from '../src/features/accounts/local-accounts';
import { LocalTransactions } from '../src/features/transactions/local-transactions';
import { applyMigrations } from './support';

describe('migración local de la 001 a la 002', () => {
  it('un teléfono con la 001 conserva "Efectivo" y el perfil, y la cuenta queda lista', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite, { upTo: 0 });
    const now = '2026-10-24T12:00:00.000Z';
    sqlite.run(
      `insert into profile (id, primary_currency, onboarding_step, updated_at)
       values ('u1', 'COP', 'done', '${now}')`,
    );
    sqlite.run(
      `insert into accounts (id, name, currency, initial_balance, is_default, created_at, updated_at)
       values ('a1', 'Efectivo', 'COP', '0', 1, '${now}', '${now}')`,
    );

    applyMigrations(sqlite, { from: 1 });
    const db = drizzle(sqlite, { schema }) as unknown as UserDb;

    expect(new LocalAccounts(db).findById('a1')).toMatchObject({
      name: 'Efectivo',
      type: 'cash',
      archivedAt: null,
      syncState: 'synced',
      syncError: null,
    });
    expect(new LocalTransactions(db).balances().get('a1')).toBe('0');
    const profile = sqlite.query('select primary_currency, onboarding_step from profile').get();
    expect(profile).toEqual({ primary_currency: 'COP', onboarding_step: 'done' });
  });
});
