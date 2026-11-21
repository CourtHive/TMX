import { isSandboxId, registerSandboxId, setNetworkIsolation } from 'services/network/networkPolicy';
/** Disposable, tab-local state. Only the return address survives reload; tournament data never does. */
export const WARP_ID_PREFIX = 'time-warp-';
export const WARP_RETURN_KEY = 'tmx_time_warp_return';

export type WarpSession = {
  tournamentId: string;
  sourceId: string;
  sourceRecord: any;
  sourceState: any;
  loginState: any;
  identity?: string;
  returnPath: string;
  selectedScheduleDate: string | null;
  viewState?: any;
  overlay: any;
};

let session: WarpSession | undefined;

export function getWarpSession(): Readonly<WarpSession> | undefined {
  return session;
}

export function isTimeWarpActive(): boolean {
  return !!session;
}

/** A retired sandbox id must never be uploaded by a late callback either. */
export function isWarpTournamentId(id?: string): boolean {
  return isSandboxId(id);
}

export function isWarpRecord(record: any): boolean {
  return isWarpTournamentId(record?.tournamentId);
}

export function setWarpSession(next?: WarpSession): void {
  session = next;
  if (next) registerSandboxId(next.tournamentId);
  setNetworkIsolation(!!next);
}

let pendingRenderId: string | undefined;

export function requestWarpTransitionRender(tournamentId?: string): void {
  pendingRenderId = tournamentId;
}

export function consumeWarpTransitionRender(tournamentId: string): boolean {
  if (pendingRenderId !== tournamentId) return false;
  pendingRenderId = undefined;
  return true;
}

export function isWarpEntryLocation(tournamentId?: string): boolean {
  const prefix = `#/tournament/${tournamentId}`;
  const hash = globalThis.location?.hash ?? '';
  return (
    !session && !!tournamentId && (hash === prefix || hash.startsWith(prefix + '/') || hash.startsWith(prefix + '?'))
  );
}
