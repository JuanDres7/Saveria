import type { OneTimeToken, OneTimeTokenKind, User } from '../../domain/entities';
import type { Repositories } from '../ports/repositories';
import type { Clock, Random } from '../ports/services';

export interface FindLinkDeps {
  repositories: Pick<Repositories, 'users' | 'oneTimeTokens'>;
  random: Pick<Random, 'sha256Hex'>;
  clock: Clock;
}

/** Los tokens tienen 32 bytes en base64url (43 caracteres); el contrato admite hasta 100. */
const MAX_TOKEN_LENGTH = 100;

/**
 * Busca un enlace de un solo uso y su usuario. Es válido si es del tipo pedido, no se usó, no se
 * invalidó, no venció y se envió al correo que el usuario tiene ahora (cambiar el correo deja sin
 * efecto los enlaces viejos). Un enlace inválido no dice por qué.
 */
export async function findValidLink(
  deps: FindLinkDeps,
  kind: OneTimeTokenKind,
  token: string,
): Promise<{ link: OneTimeToken; user: User } | null> {
  if (token === '' || token.length > MAX_TOKEN_LENGTH) return null;
  const link = await deps.repositories.oneTimeTokens.findByHash(deps.random.sha256Hex(token));
  if (!link) return null;
  if (
    link.kind !== kind ||
    link.usedAt !== null ||
    link.invalidatedAt !== null ||
    link.expiresAt.getTime() <= deps.clock.now().getTime()
  ) {
    return null;
  }
  const user = await deps.repositories.users.findById(link.userId);
  if (!user || user.email !== link.targetEmail) return null;
  return { link, user };
}
