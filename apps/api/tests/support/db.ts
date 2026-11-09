import { createDb } from '../../src/infrastructure/db/client';

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://saveria:saveria@localhost:5432/saveria_test';

/** Base de pruebas. Se niega a abrir cualquier base cuyo nombre no termine en `_test`. */
export function createTestDb() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Las pruebas solo pueden usar una base "*_test" (recibida: "${dbName}")`);
  }
  return createDb(TEST_DATABASE_URL);
}

export async function resetDatabase(client: ReturnType<typeof createDb>['client']): Promise<void> {
  await client.unsafe(
    'TRUNCATE users, user_profiles, sessions, one_time_tokens, accounts, transactions RESTART IDENTITY CASCADE',
  );
}
