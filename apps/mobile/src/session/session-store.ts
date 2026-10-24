import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';
import type { components } from '../api/schema';

export type Me = components['schemas']['Me'];

/** `unknown` = todavía no se sabe si hay sesión guardada (se muestra la pantalla de carga). */
export type SessionStatus = 'unknown' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  me: Me | null;
  /** Solo en memoria: nunca se guarda en disco. El refresh token vive en SecureStore. */
  accessToken: string | null;
  isOnline: boolean;
  /** Aviso para mostrar fuera de la sesión (por ejemplo, cambios pendientes al cerrar sesión). */
  notice: string | null;
  /** Al arrancar con la sesión guardada no hay access token hasta renovarla (`null`). */
  setSignedIn(session: { me: Me; accessToken: string | null }): void;
  setSignedOut(): void;
  setMe(me: Me): void;
  setAccessToken(accessToken: string): void;
  setOnline(isOnline: boolean): void;
  setNotice(notice: string | null): void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'unknown',
  me: null,
  accessToken: null,
  isOnline: false,
  notice: null,
  setSignedIn: ({ me, accessToken }) => set({ status: 'signedIn', me, accessToken }),
  setSignedOut: () => set({ status: 'signedOut', me: null, accessToken: null }),
  setMe: (me) => set({ me }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setOnline: (isOnline) => set({ isOnline }),
  setNotice: (notice) => set({ notice }),
}));

/** Hay red y, si el sistema lo sabe, llega a internet. */
export function isReachable(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Mantiene `isOnline` al día. Devuelve la función para dejar de escuchar. */
export function watchConnectivity(): () => void {
  return NetInfo.addEventListener((state) => {
    useSession.getState().setOnline(isReachable(state));
  });
}
