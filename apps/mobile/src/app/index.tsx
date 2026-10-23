import { Redirect } from 'expo-router';
import { ENTRY_ROUTE, routeGroupFor } from '../session/guards';
import { useSession } from '../session/session-store';

/**
 * Ruta de entrada (`/`). Siempre está disponible, también sin sesión, y manda al usuario a la
 * pantalla de entrada de su zona. Sin ella, abrir la app en `/` caería en "ruta no encontrada",
 * porque las pantallas de las zonas protegidas no existen mientras su guarda está cerrada.
 */
export default function Index() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);

  const group = routeGroupFor({ status, me, isOnline });
  if (group === 'splash') return null;
  return <Redirect href={ENTRY_ROUTE[group]} />;
}
