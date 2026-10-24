import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createPurgeExpired,
  SESSION_RETENTION_MS,
} from '../../src/application/use-cases/purge-expired';
import { makeSession, makeToken, makeUser } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

const DAY = 24 * 60 * 60 * 1000;

let deps: UseCaseDeps;
let userId: string;

beforeEach(async () => {
  deps = createUseCaseDeps();
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
});

const ago = (ms: number) => new Date(deps.clock.now().getTime() - ms);
const ahead = (ms: number) => new Date(deps.clock.now().getTime() + ms);

describe('purgeExpired', () => {
  it('la retención de sesiones es de 30 días', () => {
    expect(SESSION_RETENTION_MS).toBe(30 * DAY);
  });

  it('borra las sesiones revocadas o vencidas hace más de 30 días y deja las demás', async () => {
    const active = makeSession(userId, { expiresAt: ahead(10 * DAY) });
    const revokedOld = makeSession(userId, { revokedAt: ago(31 * DAY), revokeReason: 'logout' });
    const revokedRecent = makeSession(userId, {
      revokedAt: ago(5 * DAY),
      revokeReason: 'logout',
    });
    const expiredOld = makeSession(userId, { expiresAt: ago(31 * DAY) });
    const expiredRecent = makeSession(userId, { expiresAt: ago(2 * DAY) });
    // Una cuenta borrada hace poco: su sesión sigue para avisar a los otros dispositivos.
    const deletedRecent = makeSession(null, {
      revokedAt: ago(3 * DAY),
      revokeReason: 'account_deleted',
      deviceName: null,
    });
    for (const s of [active, revokedOld, revokedRecent, expiredOld, expiredRecent, deletedRecent]) {
      await deps.repositories.sessions.create(s);
    }

    const result = await createPurgeExpired(deps)();

    expect(result.sessions).toBe(2);
    const left = [...deps.store.sessions.keys()];
    expect(left).toContain(active.id);
    expect(left).toContain(revokedRecent.id);
    expect(left).toContain(expiredRecent.id);
    expect(left).toContain(deletedRecent.id);
    expect(left).not.toContain(revokedOld.id);
    expect(left).not.toContain(expiredOld.id);
  });

  it('borra los enlaces de un solo uso vencidos y deja los vigentes', async () => {
    const valid = makeToken(userId, { expiresAt: ahead(DAY) });
    const expired = makeToken(userId, { expiresAt: ago(1000) });
    await deps.repositories.oneTimeTokens.create(valid);
    await deps.repositories.oneTimeTokens.create(expired);

    const result = await createPurgeExpired(deps)();

    expect(result.tokens).toBe(1);
    expect(deps.store.tokens.has(valid.id)).toBe(true);
    expect(deps.store.tokens.has(expired.id)).toBe(false);
  });

  it('sin nada que borrar no falla', async () => {
    expect(await createPurgeExpired(deps)()).toEqual({ sessions: 0, tokens: 0 });
  });
});
