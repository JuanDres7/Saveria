/**
 * Reglas de cuentas que dependen de las demás cuentas del usuario (FR-017, FR-019 a FR-021,
 * FR-023). Es la única implementación: la usan el caso de uso `save-account` del servidor y el
 * servicio de cuentas del teléfono (Constitución I, research §9). Funciones puras, sin base de
 * datos: quien llama les pasa las cuentas que tiene.
 */

export const MAX_ACTIVE_ACCOUNTS = 20;

/** Lo que las reglas necesitan saber de una cuenta. */
export interface AccountRuleView {
  id: string;
  name: string;
  currency: string;
  isDefault: boolean;
  archivedAt: string | Date | null;
}

export interface AccountChange {
  /** La cuenta tal como quedaría. */
  next: AccountRuleView;
  /** La cuenta como está ahora, o `null` si es nueva. */
  previous: AccountRuleView | null;
  /** Las demás cuentas del usuario (sin esta). */
  others: readonly AccountRuleView[];
  /** Si la cuenta tiene movimientos vivos, como origen o como destino. */
  hasTransactions: boolean;
}

const isActive = (account: AccountRuleView) => account.archivedAt === null;
const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

/** Errores por campo; vacío si el cambio cumple todas las reglas. */
export function checkAccountChange({
  next,
  previous,
  others,
  hasTransactions,
}: AccountChange): Record<string, string> {
  const errors: Record<string, string> = {};
  const activeOthers = others.filter(isActive);
  const becomesActive = isActive(next) && (previous === null || !isActive(previous));
  const reactivating = previous !== null && !isActive(previous) && isActive(next);

  if (isActive(next) && activeOthers.some((o) => sameName(o.name, next.name))) {
    errors.name = reactivating
      ? 'Ya tienes una cuenta activa con ese nombre. Cámbiale el nombre para reactivar esta'
      : 'Ya tienes una cuenta activa con ese nombre';
  }

  if (becomesActive && activeOthers.length >= MAX_ACTIVE_ACCOUNTS) {
    if (reactivating) {
      errors.archivedAt = `Ya tienes ${MAX_ACTIVE_ACCOUNTS} cuentas activas. Archiva otra para reactivar esta`;
    } else {
      errors.account = `Puedes tener máximo ${MAX_ACTIVE_ACCOUNTS} cuentas activas`;
    }
  }

  if (!isActive(next) && next.isDefault) {
    errors.archivedAt =
      'No puedes archivar la cuenta por defecto. Elige otra cuenta por defecto antes';
  }

  if (previous?.isDefault && !next.isDefault && !activeOthers.some((o) => o.isDefault)) {
    errors.isDefault = 'Siempre debe haber una cuenta por defecto. Elige otra antes';
  }

  if (previous !== null && previous.currency !== next.currency && hasTransactions) {
    errors.currency = 'No puedes cambiar la moneda de una cuenta que ya tiene movimientos';
  }

  return errors;
}
