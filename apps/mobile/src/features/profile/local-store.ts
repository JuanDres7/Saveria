import { eq } from 'drizzle-orm';
import type { UserDb } from '../../db/open-user-db';
import { accounts, profile } from '../../db/schema';
import type { Me } from '../../session/session-store';

export type ProfileFields = Me['profile'];
export type LocalAccount = NonNullable<Me['defaultAccount']>;

/** Lo que la app guarda del usuario en su base local cifrada. */
export interface LocalStore {
  readProfile(userId: string): ProfileFields | null;
  writeProfile(userId: string, profile: ProfileFields): void;
  readDefaultAccount(): LocalAccount | null;
  writeAccount(account: LocalAccount): void;
}

export class DrizzleLocalStore implements LocalStore {
  constructor(private readonly db: UserDb) {}

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

  return {
    ...me,
    profile: keepLocal && localProfile ? localProfile : me.profile,
    defaultAccount: me.defaultAccount ?? local.readDefaultAccount(),
  };
}
