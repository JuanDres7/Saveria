import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ProfileFields } from '../src/features/profile/local-store';
import { createProfileService } from '../src/features/profile/profile-service';
import { createOutbox } from '../src/outbox/outbox';
import { watchOutbox } from '../src/outbox/user-outbox';
import { type Me, useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';
import { MemoryLocalStore, MemoryOutboxStore } from './support/memory';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

import ChangePassword from '../src/app/(app)/settings/change-password';
import Settings from '../src/app/(app)/settings/index';
import { AuthError, authService } from '../src/features/auth/auth-service';
import { profileService } from '../src/features/profile/profile-service';

const USER_ID = '0199a1b2-0000-7000-8000-000000000001';

function meWith(profile: Partial<ProfileFields> = {}): Me {
  const me = makeMe({ onboardingStep: 'done' });
  return {
    ...me,
    profile: {
      ...me.profile,
      countryCode: 'CO',
      city: 'Medellín',
      primaryCurrency: 'COP',
      ...profile,
    },
  };
}

function signIn(me: Me = meWith(), isOnline = true) {
  useSession.setState({ status: 'signedIn', me, accessToken: 'access', isOnline, notice: null });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const saveButton = () => screen.getByRole('button', { name: 'Guardar cambios' });

describe('3.1 activar el modo automático', () => {
  it('muestra qué implica y no deja guardar hasta confirmarlo', async () => {
    signIn();
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<Settings />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Automático' }));
    expect(screen.getByText(/se guardan sin preguntarte/i)).toBeTruthy();
    expect(screen.getByText(/se pueden deshacer desde el historial/i)).toBeTruthy();
    expect(saveButton()).toBeDisabled();

    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Entiendo y quiero activar el modo automático' }),
    );
    await fireEvent.press(saveButton());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ aiMode: 'auto' }), {
      autoModeConfirmed: true,
    });
  });

  it('si ya está en automático, guardar otros cambios no pide confirmar de nuevo', async () => {
    signIn(meWith({ aiMode: 'auto' }));
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<Settings />);
    expect(screen.queryByRole('checkbox', { name: /Entiendo/ })).toBeNull();
    await fireEvent.press(saveButton());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ aiMode: 'auto' }), {
      autoModeConfirmed: false,
    });
  });
});

describe('3.2 monedas de referencia', () => {
  it('la moneda principal no se ofrece como referencia', async () => {
    signIn();
    await render(<Settings />);
    expect(screen.queryByRole('checkbox', { name: /^COP/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /^USD/ })).toBeTruthy();
  });

  it('se pueden activar hasta 2; una tercera no se agrega y se avisa', async () => {
    signIn();
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('checkbox', { name: /^USD/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /^EUR/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /^MXN/ }));

    expect(screen.getByText('Puedes elegir hasta 2 monedas de referencia')).toBeTruthy();
    // el aviso también aparece junto a cada opción, por si el de arriba quedó fuera de la vista
    expect(
      screen.getAllByText('Ya elegiste 2. Quita una para elegir esta.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: /^MXN/ })).not.toBeChecked();
    await fireEvent.press(saveButton());
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ referenceCurrencies: ['USD', 'EUR'] }),
      { autoModeConfirmed: false },
    );
  });

  it('si una moneda de referencia pasa a ser la principal, sale de las de referencia', async () => {
    signIn(meWith({ referenceCurrencies: ['USD'] }));
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('radio', { name: /^USD/ }));
    await fireEvent.press(saveButton());
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ primaryCurrency: 'USD', referenceCurrencies: [] }),
      { autoModeConfirmed: false },
    );
  });
});

describe('3.4 cambios sin conexión', () => {
  it('se aplican en el dispositivo, quedan en el outbox y se envían al volver la red', async () => {
    const me = meWith();
    signIn(me, false);
    const local = new MemoryLocalStore();
    local.writeProfile(USER_ID, me.profile);
    const queue = new MemoryOutboxStore();
    const send = jest.fn(async () => ({ status: 'sent' as const }));
    const outbox = createOutbox(queue, send);
    const profile = createProfileService({
      context: () => ({ userId: USER_ID, local, outbox }),
      now: () => Date.now(),
    });
    const stop = watchOutbox(() => outbox);

    await profile.save({ city: 'Cali' });

    // aplicado en el dispositivo de inmediato, sin enviar
    expect(useSession.getState().me?.profile.city).toBe('Cali');
    expect(local.readProfile(USER_ID)?.city).toBe('Cali');
    expect(queue.items).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();

    await act(async () => useSession.getState().setOnline(true));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queue.items).toHaveLength(0));
    stop();
  });

  it('la pantalla guarda sin conexión y lo dice', async () => {
    signIn(meWith(), false);
    jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<Settings />);
    await fireEvent.press(saveButton());
    expect(
      await screen.findByText('Guardado en este teléfono. Se enviará cuando haya conexión.'),
    ).toBeTruthy();
  });
});

describe('cambiar la contraseña', () => {
  async function fill(current = 'clave1234', next = 'nueva5678') {
    await render(<ChangePassword />);
    await fireEvent.changeText(screen.getByLabelText('Contraseña actual'), current);
    await fireEvent.changeText(screen.getByLabelText('Contraseña nueva'), next);
  }

  it('requiere conexión', async () => {
    signIn(meWith(), false);
    await fill();
    expect(screen.getByText(/necesitas internet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  });

  it('con la contraseña actual incorrecta lo dice', async () => {
    signIn();
    jest
      .spyOn(authService, 'changePassword')
      .mockRejectedValueOnce(new AuthError('invalid_credentials', 'x'));
    await fill();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('La contraseña actual no es correcta')).toBeTruthy();
  });

  it('valida la contraseña nueva antes de enviarla', async () => {
    signIn();
    const change = jest.spyOn(authService, 'changePassword');
    await fill('clave1234', 'corta');
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('La contraseña debe tener al menos 8 caracteres')).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
  });

  it('al cambiarla avisa que las otras sesiones se cerraron', async () => {
    signIn();
    const change = jest.spyOn(authService, 'changePassword').mockResolvedValueOnce();
    await fill();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(change).toHaveBeenCalledWith({ currentPassword: 'clave1234', newPassword: 'nueva5678' });
    expect(
      await screen.findByText(
        'Listo. Cambiamos tu contraseña y cerramos la sesión en tus otros dispositivos.',
      ),
    ).toBeTruthy();
  });
});
