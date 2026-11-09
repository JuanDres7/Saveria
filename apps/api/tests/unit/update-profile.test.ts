import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createUpdateProfile,
  type ProfileUpdateInput,
} from '../../src/application/use-cases/update-profile';
import type { Profile } from '../../src/domain/entities';
import { DomainError } from '../../src/domain/errors';
import { makeProfile, makeUser } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let updateProfile: ReturnType<typeof createUpdateProfile>;
let userId: string;

const SERVER_TIME = new Date('2026-10-22T12:00:00.000Z');
const later = (ms = 1000) => new Date(SERVER_TIME.getTime() + ms).toISOString();

beforeEach(async () => {
  deps = createUseCaseDeps();
  updateProfile = createUpdateProfile(deps);
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(userId, { updatedAt: SERVER_TIME }));
});

const stored = () => deps.store.profiles.get(userId) as Profile;

const input = (overrides: Partial<ProfileUpdateInput> = {}): ProfileUpdateInput => ({
  aiName: null,
  countryCode: null,
  city: null,
  primaryCurrency: null,
  referenceCurrencies: [],
  aiMode: 'manual',
  onboardingStep: 'country',
  updatedAt: later(),
  ...overrides,
});

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  return error as DomainError;
}

describe('updateProfile', () => {
  it('con un updatedAt más nuevo aplica el registro completo y guarda el updatedAt del cliente', async () => {
    const updatedAt = later(5000);
    const result = await updateProfile(
      userId,
      input({ aiName: 'Ana', countryCode: 'CO', city: 'Medellín', updatedAt }),
    );
    expect(result.status).toBe('saved');
    expect(result.profile).toMatchObject({ aiName: 'Ana', countryCode: 'CO', city: 'Medellín' });
    expect(stored().updatedAt.toISOString()).toBe(updatedAt);
  });

  it.each([
    ['más viejo', -1000],
    ['igual', 0],
  ])('con un updatedAt %s responde conflict con la versión del servidor', async (_n, offset) => {
    const result = await updateProfile(userId, input({ aiName: 'Ana', updatedAt: later(offset) }));
    expect(result.status).toBe('conflict');
    expect(result.profile.aiName).toBeNull();
    expect(result.profile.updatedAt).toBe(SERVER_TIME.toISOString());
    expect(stored().aiName).toBeNull();
  });

  it('onboarding_step solo avanza: un paso anterior no lo hace retroceder', async () => {
    await updateProfile(userId, input({ onboardingStep: 'currency', updatedAt: later(1000) }));
    const result = await updateProfile(
      userId,
      input({ onboardingStep: 'country', updatedAt: later(2000) }),
    );
    expect(result.profile.onboardingStep).toBe('currency');
    expect(stored().onboardingStep).toBe('currency');
  });

  it('pasar a done sin primary_currency → validation_error', async () => {
    const error = await errorOf(updateProfile(userId, input({ onboardingStep: 'done' })));
    expect(error.code).toBe('validation_error');
    expect(error.fields?.primaryCurrency).toBeDefined();
  });

  it('pasar a done con primary_currency se acepta', async () => {
    const result = await updateProfile(
      userId,
      input({ onboardingStep: 'done', primaryCurrency: 'COP' }),
    );
    expect(result.profile.onboardingStep).toBe('done');
  });

  it('de manual a auto sin autoModeConfirmed → validation_error', async () => {
    const error = await errorOf(updateProfile(userId, input({ aiMode: 'auto' })));
    expect(error.code).toBe('validation_error');
    expect(error.fields?.aiMode).toBeDefined();
    expect(stored().aiMode).toBe('manual');
  });

  it('de manual a auto con autoModeConfirmed: true se acepta', async () => {
    const result = await updateProfile(userId, input({ aiMode: 'auto', autoModeConfirmed: true }));
    expect(result.profile.aiMode).toBe('auto');
  });

  it('si ya estaba en auto, seguir en auto no pide confirmación', async () => {
    await updateProfile(
      userId,
      input({ aiMode: 'auto', autoModeConfirmed: true, updatedAt: later(1000) }),
    );
    const result = await updateProfile(userId, input({ aiMode: 'auto', updatedAt: later(2000) }));
    expect(result.profile.aiMode).toBe('auto');
  });

  it('la moneda que pasa a ser principal se quita de las de referencia', async () => {
    const result = await updateProfile(
      userId,
      input({ primaryCurrency: 'USD', referenceCurrencies: ['USD', 'EUR'] }),
    );
    expect(result.profile.primaryCurrency).toBe('USD');
    expect(result.profile.referenceCurrencies).toEqual(['EUR']);
  });

  it('aiName vacío o solo espacios se guarda como null', async () => {
    const result = await updateProfile(userId, input({ aiName: '   ' }));
    expect(result.profile.aiName).toBeNull();
  });

  it.each([
    ['aiName de más de 30', { aiName: 'x'.repeat(31) }, 'aiName'],
    ['país fuera del catálogo', { countryCode: 'XX' }, 'countryCode'],
    ['moneda fuera del catálogo', { primaryCurrency: 'ABC' }, 'primaryCurrency'],
    [
      '3 monedas de referencia',
      { referenceCurrencies: ['USD', 'EUR', 'MXN'] },
      'referenceCurrencies',
    ],
  ])('%s → validation_error en el campo', async (_n, overrides, field) => {
    const error = await errorOf(updateProfile(userId, input(overrides)));
    expect(error.code).toBe('validation_error');
    expect(error.fields?.[field]).toBeDefined();
  });
});
