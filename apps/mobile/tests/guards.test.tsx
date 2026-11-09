import { render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { ENTRY_ROUTE, ONBOARDING_ROUTE, routeGroupFor } from '../src/session/guards';
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
  // `Redirect` se dibuja como un elemento con su destino, para poder comprobarlo.
  const Redirect = ({ href }: { href: string }) => React.createElement('Redirect', { href });
  return { Stack, Redirect };
});
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('../src/features/auth/bootstrap', () => ({ bootstrapSession: jest.fn() }));

import RootLayout from '../src/app/_layout';
import AppLayout from '../src/app/(app)/_layout';
import Index from '../src/app/index';

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
    expect(await screensOf(<RootLayout />)).toEqual(['index', '(auth)']);
  });

  it('signedIn con el onboarding pendiente muestra solo (onboarding)', async () => {
    setSession({ status: 'signedIn', me: makeMe({ onboardingStep: 'country' }) });
    expect(await screensOf(<RootLayout />)).toEqual(['index', '(onboarding)']);
  });

  it('signedIn con el onboarding terminado muestra solo (app)', async () => {
    setSession({ status: 'signedIn', me: makeMe(), isOnline: true });
    expect(await screensOf(<RootLayout />)).toEqual(['index', '(app)']);
  });
});

/** Pantallas de la app con sesión y onboarding terminado. */
const APP_SCREENS = [
  'home',
  'transactions/new',
  'transactions/index',
  'accounts/index',
  'accounts/new',
  'accounts/archived',
  'accounts/[id]',
  'settings/index',
  'settings/change-password',
  'settings/delete-account',
];

describe('(app)/_layout', () => {
  it('en el uso normal muestra la pantalla principal', async () => {
    setSession({ status: 'signedIn', me: makeMe(), isOnline: true });
    expect(await screensOf(<AppLayout />)).toEqual(APP_SCREENS);
  });

  it('con verificación exigida y conexión muestra solo la puerta de verificación', async () => {
    setSession({ status: 'signedIn', me: makeMe({ verificationRequired: true }), isOnline: true });
    expect(await screensOf(<AppLayout />)).toEqual(['verify-email-gate']);
  });

  it('con verificación exigida pero sin conexión sigue mostrando la pantalla principal', async () => {
    setSession({ status: 'signedIn', me: makeMe({ verificationRequired: true }), isOnline: false });
    expect(await screensOf(<AppLayout />)).toEqual(APP_SCREENS);
  });
});

/** Destino del <Redirect> que dibuja la ruta de entrada, o null si no redirige. */
async function redirectTarget(): Promise<string | null> {
  await render(<Index />);
  const tree = screen.toJSON() as { type: string; props?: { href?: string } } | null;
  return tree?.type === 'Redirect' ? (tree.props?.href ?? null) : null;
}

describe('ruta de entrada (/)', () => {
  it('sin saber si hay sesión no redirige todavía', async () => {
    setSession({ status: 'unknown' });
    expect(await redirectTarget()).toBeNull();
  });

  it('sin sesión manda a la bienvenida', async () => {
    setSession({ status: 'signedOut' });
    expect(await redirectTarget()).toBe('/welcome');
  });

  it('con el onboarding pendiente manda al onboarding', async () => {
    setSession({ status: 'signedIn', me: makeMe({ onboardingStep: 'city' }) });
    // retoma en el paso pendiente (2.5)
    expect(await redirectTarget()).toBe('/city');
  });

  it('con la sesión lista manda a la pantalla principal', async () => {
    setSession({ status: 'signedIn', me: makeMe(), isOnline: true });
    expect(await redirectTarget()).toBe('/home');
  });

  it('con verificación exigida y conexión manda a la puerta de verificación', async () => {
    setSession({ status: 'signedIn', me: makeMe({ verificationRequired: true }), isOnline: true });
    expect(await redirectTarget()).toBe('/verify-email-gate');
  });

  it('todas las zonas tienen una pantalla de entrada que existe como archivo', () => {
    // evita que ENTRY_ROUTE apunte a una ruta que no existe (lo que daba "Unmatched Route")
    const fs = require('node:fs');
    const path = require('node:path');
    const files: Record<string, string> = {
      '/welcome': '(auth)/welcome.tsx',
      '/ai-name': '(onboarding)/ai-name.tsx',
      '/verify-email-gate': '(app)/verify-email-gate.tsx',
      '/home': '(app)/home.tsx',
      '/country': '(onboarding)/country.tsx',
      '/city': '(onboarding)/city.tsx',
      '/currency': '(onboarding)/currency.tsx',
      '/ai-mode': '(onboarding)/ai-mode.tsx',
    };
    for (const href of [...Object.values(ENTRY_ROUTE), ...Object.values(ONBOARDING_ROUTE)]) {
      const file = files[href];
      expect(file).toBeDefined();
      expect(fs.existsSync(path.join(process.cwd(), 'src', 'app', file as string))).toBe(true);
    }
  });
});
