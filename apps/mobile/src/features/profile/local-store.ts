import { eq } from 'drizzle-orm';
import type { UserDb } from '../../db/open-user-db';
import { accounts, meta, profile } from '../../db/schema';
import type { Me } from '../../session/session-store';

export type ProfileFields = Me['profile'];
export type LocalAccount = NonNullable<Me['defaultAccount']>;
/** Datos de la cuenta del último `me` que llegó del servidor (correo y verificación). */
export type AccountInfo = Omit<Me, 'profile' | 'defaultAccount'>;

/** Lo que la app guarda del usuario en su base local cifrada. */
export interface LocalStore {
  readProfile(userId: string): ProfileFields | null;
  writeProfile(userId: string, profile: ProfileFields): void;
  readDefaultAccount(): LocalAccount | null;
  writeAccount(account: LocalAccount): void;
  readAccountInfo(): AccountInfo | null;
  writeAccountInfo(info: AccountInfo): void;
}

const ACCOUNT_INFO_KEY = 'account_info';

export class DrizzleLocalStore implements LocalStore {
  constructor(private readonly db: UserDb) {}

  readAccountInfo(): AccountInfo | null {
    const row = this.db.select().from(meta).where(eq(meta.key, ACCOUNT_INFO_KEY)).get();
    return row ? (JSON.parse(row.value) as AccountInfo) : null;
  }

  writeAccountInfo(info: AccountInfo): void {
    const value = JSON.stringify(info);
    this.db
      .insert(meta)
      .values({ key: ACCOUNT_INFO_KEY, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }

  readProfile(userId: string): ProfileFields | null {
    const row = this.db.select().from(profile).where(eq(profile.id, userId)).get();
    if (!row) return null;
    const { id: _id, ...fields } = row;
    return fields;
  }

  writeProfile(userId: string, fields: ProfileFields): void {
    this.db
      .insert(profile)
      .values({ ...fields, id: userId })
      .onConflictDoUpdate({ target: profile.id, set: fields })
      .run();
  }

  readDefaultAccount(): LocalAccount | null {
    const row = this.db.select().from(accounts).where(eq(accounts.isDefault, true)).get();
    if (!row || row.deletedAt !== null) return null;
    return {
      id: row.id,
      name: row.name,
      currency: row.currency,
      initialBalance: row.initialBalance,
      isDefault: row.isDefault,
    };
  }

  writeAccount(account: LocalAccount): void {
    const now = new Date().toISOString();
    const fields = {
      name: account.name,
      currency: account.currency,
      initialBalance: account.initialBalance,
      isDefault: account.isDefault,
      updatedAt: now,
    };
    this.db
      .insert(accounts)
      .values({ id: account.id, ...fields, createdAt: now })
      .onConflictDoUpdate({ target: accounts.id, set: fields })
      .run();
  }
}

const time = (iso: string) => Date.parse(iso);

/**
 * Junta el `me` del servidor con la base local al entrar.
 *
 * El perfil local gana si es más nuevo: son cambios hechos sin conexión que todavía esperan en el
 * outbox y que, si se pisaran, devolverían al usuario a un paso ya respondido. Si el servidor
 * todavía no tiene "Efectivo" (se creó sin conexión), se usa la cuenta local.
 */
export function mergeMe(local: LocalStore, me: Me): Me {
  const localProfile = local.readProfile(me.id);
  const keepLocal =
    localProfile !== null && time(localProfile.updatedAt) > time(me.profile.updatedAt);
  if (!keepLocal) local.writeProfile(me.id, me.profile);
  if (me.defaultAccount) local.writeAccount(me.defaultAccount);
  local.writeAccountInfo({
    id: me.id,
    email: me.email,
    emailVerified: me.emailVerified,
    verificationDeadline: me.verificationDeadline,
    verificationRequired: me.verificationRequired,
  });

  return {
    ...me,
    profile: keepLocal && localProfile ? localProfile : me.profile,
    defaultAccount: me.defaultAccount ?? local.readDefaultAccount(),
  };
}

/**
 * Arma `me` solo con la base local, para abrir la app con la sesión guardada sin esperar a la red
 * (SC-003, escenario 5.1). `null` si la base todavía no tiene los datos de ese usuario.
 */
export function readLocalMe(local: LocalStore, userId: string): Me | null {
  const info = local.readAccountInfo();
  const profileFields = local.readProfile(userId);
  if (!info || info.id !== userId || !profileFields) return null;
  return { ...info, profile: profileFields, defaultAccount: local.readDefaultAccount() };
}
