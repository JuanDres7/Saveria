import { beforeEach, describe, expect, it } from 'bun:test';
import { createCompleteOnboarding } from '../../src/application/use-cases/complete-onboarding';
import { DomainError } from '../../src/domain/errors';
import { makeAccount, makeProfile, makeUser, testId } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let completeOnboarding: ReturnType<typeof createCompleteOnboarding>;
let userId: string;

beforeEach(async () => {
  deps = createUseCaseDeps();
  completeOnboarding = createCompleteOnboarding(deps);
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
});

async function withProfile(primaryCurrency: string | null) {
  await deps.repositories.profiles.create(
    makeProfile(userId, { primaryCurrency, onboardingStep: 'ai_mode' }),
  );
}

const accountsOf = (id: string) => [...deps.store.accounts.values()].filter((a) => a.userId === id);

describe('completeOnboarding', () => {
  it('sin primary_currency → primary_currency_required y no crea nada', async () => {
    await withProfile(null);
    const error = await completeOnboarding(userId, testId()).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('primary_currency_required');
    expect(accountsOf(userId)).toHaveLength(0);
    expect(deps.store.profiles.get(userId)?.onboardingStep).toBe('ai_mode');
  });

  it('crea "Efectivo" con el id del cliente, en la moneda principal, saldo 0 y por defecto', async () => {
    await withProfile('COP');
    const accountId = testId();
    const me = await completeOnboarding(userId, accountId);

    const [account] = accountsOf(userId);
    expect(account).toMatchObject({
      id: accountId,
      name: 'Efectivo',
      currency: 'COP',
      initialBalance: '0',
      isDefault: true,
    });
    expect(deps.store.profiles.get(userId)?.onboardingStep).toBe('done');
    expect(me.profile.onboardingStep).toBe('done');
    expect(me.defaultAccount).toEqual({
      id: accountId,
      name: 'Efectivo',
      currency: 'COP',
      initialBalance: '0',
      isDefault: true,
    });
  });

  it('repetir la llamada con el mismo id no duplica (idempotente)', async () => {
    await withProfile('COP');
    const accountId = testId();
    await completeOnboarding(userId, accountId);
    const again = await completeOnboarding(userId, accountId);
    expect(accountsOf(userId)).toHaveLength(1);
    expect(again.defaultAccount?.id).toBe(accountId);
  });

  it('si ya hay una cuenta por defecto, no crea otra aunque llegue un id distinto', async () => {
    await withProfile('COP');
    const existing = makeAccount(userId);
    await deps.repositories.accounts.create(existing);
    const me = await completeOnboarding(userId, testId());
    expect(accountsOf(userId)).toHaveLength(1);
    expect(me.defaultAccount?.id).toBe(existing.id);
  });

  it('un id que ya usa otro usuario no toca esa cuenta', async () => {
    await withProfile('COP');
    const other = makeUser();
    await deps.repositories.users.create(other);
    const foreign = makeAccount(other.id, { currency: 'USD' });
    await deps.repositories.accounts.create(foreign);

    const error = await completeOnboarding(userId, foreign.id).then(
      () => null,
      (e: unknown) => e,
    );
    expect((error as DomainError).code).toBe('validation_error');
    expect(deps.store.accounts.get(foreign.id)?.userId).toBe(other.id);
    expect(accountsOf(userId)).toHaveLength(0);
  });

  it('no cambia updatedAt del perfil (no compite con el last-write-wins del cliente)', async () => {
    await withProfile('COP');
    const before = deps.store.profiles.get(userId)?.updatedAt;
    deps.clock.advance(60_000);
    await completeOnboarding(userId, testId());
    expect(deps.store.profiles.get(userId)?.updatedAt).toEqual(before as Date);
  });
});
