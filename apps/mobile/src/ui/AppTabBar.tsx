import { router, usePathname } from 'expo-router';
import { useSession } from '../session/session-store';
import { TAB_ITEMS, TabBar } from './TabBar';

/** ¿La ruta es una de las secciones de la barra? Solo ahí se muestra (FR-015). */
export function isSectionPath(pathname: string): boolean {
  return TAB_ITEMS.some((item) => item.path === pathname);
}

/**
 * La barra inferior de la app, conectada a la navegación: marca la sección de la ruta actual, abre
 * las demás y deja «Registrar movimiento» a un toque. El «+» solo aparece si el usuario ya tiene
 * moneda principal, la misma regla que tenía el botón de Inicio (escenario 2.6 de la 001).
 */
export function AppTabBar() {
  const pathname = usePathname();
  const hasPrimaryCurrency = useSession((s) => Boolean(s.me?.profile.primaryCurrency));
  return (
    <TabBar
      activePath={pathname}
      showRegister={hasPrimaryCurrency}
      // `navigate` reutiliza la sección si ya está abierta en lugar de apilar otra encima.
      onSelect={(path) => router.navigate(path as never)}
      onRegister={() => router.push('/transactions/new')}
    />
  );
}
