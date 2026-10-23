import { render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { routeGroupFor } from '../src/session/guards';
import { useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';

// Expo Router simulado: `Stack.Protected` solo muestra a sus hijos si `guard` es verdadero, y
// cada `Stack.Screen` aparece como un elemento con su nombre, así se ve qué zonas están activas.
jest.mock('expo-router', () => {
  const React = require('react');
  const Screen = ({ name }: { name: string }) => React.createElement('Screen', { name });
  const Protected = ({ guard, children }: { guard: boolean; children: ReactNode }) =>
    guard ? React.createElement(React.Fragment, null, children) : null;
  const Stack = Object.assign(
    ({ children }: { children: ReactNode }) => React.createElement('Stack', null, children),
    { Screen, Protected },
  );
  return { Stack };
});
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('../src/features/auth/bootstrap', () => ({ bootstrapSession: jest.fn() }));

import RootLayout from '../src/app/_layout';
import AppLayout from '../src/app/(app)/_layout';

type Node = { type: string; props?: { name?: string }; children?: Node[] | null };

/** Nombres de las pantallas que quedaron montadas. */
function activeScreens(tree: unknown): string[] {
  const names: string[] = [];
  const walk = (node: Node | Node[] | null): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node.type === 'Screen' && node.props?.name) names.push(node.props.name);
    for (const child of node.children ?? []) walk(child as Node);
  };
  walk(tree as Node | Node[] | null);
  return names;
}

/** Monta el elemento y devuelve los nombres de las pantallas activas. */
async function screensOf(element: ReactElement): Promise<string[]> {
  await render(element);
  return activeScreens(screen.toJSON());
}

function setSession(state: Partial<ReturnType<typeof useSession.getState>>) {
  useSession.setState({
    status: 'unknown',
    me: null,
    accessToken: null,
    isOnline: false,
    ...state,
  });
}

describe('routeGroupFor', () => {
  it('sin saber si hay sesión muestra la pantalla de carga', () => {
    expect(routeGroupFor({ status: 'unknown', me: null, isOnline: true })).toBe('splash');
  });

  it('sin sesión va a (auth)', () => {
    expect(routeGroupFor({ status: 'signedOut', me: null, isOnline: true })).toBe('auth');
  });

  it('con sesión pero sin datos del usuario va a (auth)', () => {
    expect(routeGroupFor({ status: 'signedIn', me: null, isOnline: true })).toBe('auth');
  });

  it.each(['ai_name', 'country', 'city', 'currency', 'ai_mode'] as const)(
    'con el onboarding en el paso %s va a (onboarding)',
    (step) => {
      const me = makeMe({ onboardingStep: step });
      expect(routeGroupFor({ status: 'signedIn', me, isOnline: true })).toBe('onboarding');
    },
  );

  it('con el onboarding terminado va a (app)', () => {
    expect(routeGroupFor({ status: 'signedIn', me: makeMe(), isOnline: true })).toBe('app');
  });

  it('pasados 7 días sin verificar y CON conexión va a la puerta de verificación', () => {
    const me = makeMe({ verificationRequired: true });
    expect(routeGroupFor({ status: 'signedIn', me, isOnline: true })).toBe('verify-gate');
  });

  it('pasados 7 días sin verificar pero SIN conexión la app funciona normal (FR-032)', () => {
    const me = makeMe({ verificationRequired: true });
    expect(routeGroupFor({ status: 'signedIn', me, isOnline: false })).toBe('app');
  });

  it('el onboarding va antes que la verificación', () => {
    const me = makeMe({ onboardingStep: 'city', verificationRequired: true });
    expect(routeGroupFor({ status: 'signedIn', me, isOnline: true })).toBe('onboarding');
  });
});

describe('RootLayout', () => {
  it('mientras no se sabe si hay sesión no muestra ninguna pantalla', async () => {
    setSession({ status: 'unknown' });
    expect(await screensOf(<RootLayout />)).toEqual([]);
  });

  it('signedOut muestra solo (auth)', async () => {
    setSession({ status: 'signedOut' });
    expect(await screensOf(<RootLayout />)).toEqual(['(auth)']);
  });

  it('signedIn con el onboarding pendiente muestra solo (onboarding)', async () => {
    setSession({ status: 'signedIn', me: makeMe({ onboardingStep: 'country' }) });
    expect(await screensOf(<RootLayout />)).toEqual(['(onboarding)']);
  });

  it('signedIn con el onboarding terminado muestra solo (app)', async () => {
    setSession({ status: 'signedIn', me: makeMe(), isOnline: true });
    expect(await screensOf(<RootLayout />)).toEqual(['(app)']);
  });
});

describe('(app)/_layout', () => {
  it('en el uso normal muestra la pantalla principal', async () => {
    setSession({ status: 'signedIn', me: makeMe(), isOnline: true });
    expect(await screensOf(<AppLayout />)).toEqual(['index']);
  });

  it('con verificación exigida y conexión muestra solo la puerta de verificación', async () => {
    setSession({ status: 'signedIn', me: makeMe({ verificationRequired: true }), isOnline: true });
    expect(await screensOf(<AppLayout />)).toEqual(['verify-email-gate']);
  });

  it('con verificación exigida pero sin conexión sigue mostrando la pantalla principal', async () => {
    setSession({ status: 'signedIn', me: makeMe({ verificationRequired: true }), isOnline: false });
    expect(await screensOf(<AppLayout />)).toEqual(['index']);
  });
});
