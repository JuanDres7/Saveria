import * as SQLite from 'expo-sqlite';
import {
  clearLastUserId,
  clearPendingRevocation,
  clearRefreshToken,
  deleteDbKey,
  getLastUserId,
} from '../session/secure';
import { closeUserDb, dbFileName } from './open-user-db';

export interface PurgeDeps {
  closeUserDb(): void;
  deleteDatabaseSync(name: string): void;
  deleteDbKey(userId: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
  clearPendingRevocation(): Promise<void>;
  getLastUserId(): Promise<string | null>;
  clearLastUserId(): Promise<void>;
}

const defaultDeps: PurgeDeps = {
  closeUserDb,
  deleteDatabaseSync: (name) => SQLite.deleteDatabaseSync(name),
  deleteDbKey,
  clearRefreshToken,
  clearPendingRevocation,
  getLastUserId,
  clearLastUserId,
};

/**
 * Borra TODO lo local de un usuario: el archivo de la base cifrada, su clave y las credenciales
 * (FR-024). Se usa al borrar la cuenta y cuando otro dispositivo la borró (`account_deleted`).
 * Los cambios pendientes de enviar se descartan junto con la base.
 */
export async function purgeUserData(userId: string, deps: PurgeDeps = defaultDeps): Promise<void> {
  deps.closeUserDb();

  try {
    deps.deleteDatabaseSync(dbFileName(userId));
  } catch {
    // Si el archivo ya no existe no hay nada que borrar.
  }

  await deps.deleteDbKey(userId);
  await deps.clearRefreshToken();
  await deps.clearPendingRevocation();
  if ((await deps.getLastUserId()) === userId) await deps.clearLastUserId();
}
