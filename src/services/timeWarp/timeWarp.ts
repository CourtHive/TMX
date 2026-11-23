import { prepareWarpSwitch, warpParticipantsReady } from './warpParticipants';
import { pendingServerWriteCount } from 'services/network/networkPolicy';
import { tournamentEngine } from 'services/factory/engine';
import { tools } from 'tods-competition-factory';
import { buildWarpCopy } from './warpCopy';
import {
  invalidatePendingTournamentLoads,
  markTournamentRecordInstalled,
} from 'services/tournament/operationOwnership';
import {
  getWarpSession,
  setWarpSession,
  isWarpEntryLocation,
  requestWarpTransitionRender,
  WARP_ID_PREFIX,
} from './warpState';

export type WarpOptions = {
  record?: any;
  mode?: 'clock' | 'script';
  /** when the warp clock starts; the last change or now, chosen on entry (`warpStartPrompt.ts`) */
  startAt?: number;
};
export type ExitWarpOptions = { navigate?: boolean; resume?: boolean };
export type WarpHost = {
  path(): string;
  ready(): boolean;
  refused(): void;
  prepare(options: WarpOptions): Promise<unknown>;
  capture(options: WarpOptions): Record<string, any> | undefined;
  beforeEnter(): void;
  entered(session: any, options: WarpOptions, prepared: unknown, copy: any): void;
  beforeExit(session: any): void;
  restored(session: any, options: ExitWarpOptions, complete: () => void): void | Promise<void>;
  failed?(session: any, error: unknown): void;
};

let host: WarpHost | undefined;
let exiting = false;

/** Explicitly wired by application startup. Importing the lifecycle registers no listeners or UI side effects. */
export function initializeTimeWarp(owner: WarpHost): () => void {
  if (host) throw new Error('Time Warp has already been initialized');
  host = owner;
  return () => {
    exitTimeWarp({ navigate: false, resume: false });
    host = undefined;
  };
}

export function canEnterTimeWarp(): boolean {
  return !!host && isWarpEntryLocation(tournamentEngine.getTournamentId());
}

function ready(owner: WarpHost): boolean {
  return !getWarpSession() && !pendingServerWriteCount() && warpParticipantsReady() && owner.ready();
}

export async function enterTimeWarp(options: WarpOptions = {}): Promise<boolean> {
  const owner = host;
  if (!owner || (!options.record && !canEnterTimeWarp())) return false;
  if (!ready(owner)) {
    owner.refused();
    return false;
  }
  const path = owner.path();
  const selection = tournamentEngine.getTournamentId();
  const prepared = await owner.prepare(options);
  if (host !== owner || path !== owner.path() || selection !== tournamentEngine.getTournamentId() || !ready(owner))
    return false;
  const captured = owner.capture(options);
  if (!captured || path !== owner.path() || !ready(owner)) return false;
  // One engine snapshot, not getTournament() plus getState(). The sourceRecord shares this owned immutable snapshot.
  const sourceState = tournamentEngine.getState();
  const sourceRecord = selection ? sourceState.tournamentRecords[selection] : undefined;
  if (!options.record && !sourceRecord) return false;
  const copy = buildWarpCopy(options.record ?? sourceRecord, `${WARP_ID_PREFIX}${tools.UUID()}`);
  const session: any = {
    ...captured,
    tournamentId: copy.tournamentId,
    sourceId: selection,
    sourceRecord,
    sourceState,
    returnPath: path,
    mode: options.mode ?? 'clock',
  };
  owner.beforeEnter();
  setWarpSession(session);
  try {
    invalidatePendingTournamentLoads();
    prepareWarpSwitch('enter');
    const result = tournamentEngine.setState(copy);
    if (result.error) throw result.error;
    markTournamentRecordInstalled();
    requestWarpTransitionRender(copy.tournamentId);
    owner.entered(session, options, prepared, copy);
    return true;
  } catch (error) {
    exitTimeWarp();
    throw error;
  }
}

/** Discard is synchronous for auth/route guards; the UI owner may then reload the latest original asynchronously. */
export function exitTimeWarp(options: ExitWarpOptions = {}): void {
  const session = getWarpSession();
  const owner = host;
  if (!session || !owner) return;
  const complete = () => {
    if (getWarpSession() !== session) return;
    setWarpSession();
    exiting = false;
    requestWarpTransitionRender(session.sourceId);
  };
  // Auth/identity changes can synchronously abandon an already pending local reload.
  if (exiting) {
    if (options.navigate === false) complete();
    return;
  }
  exiting = true;
  // The owner must return its asynchronous restoration, so every outcome releases the barrier.
  const restore = async () => {
    try {
      try {
        owner.beforeExit(session);
        invalidatePendingTournamentLoads();
        prepareWarpSwitch('exit');
      } finally {
        // A failed page/clock teardown must still discard the sandbox.
        tournamentEngine.setState(session.sourceState?.tournamentRecords ?? {});
        if (session.sourceId) tournamentEngine.setTournamentId(session.sourceId);
        markTournamentRecordInstalled();
        // Keep the copy's identity and network barrier until the host finishes any local reload. Mutations against the
        // restored source are refused by the sandbox-owner check during this interval, and IDB saves remain disabled.
      }
      await owner.restored(session, options, complete);
    } catch (error) {
      const owns = getWarpSession() === session;
      complete();
      try {
        if (owns) owner.failed?.(session, error);
      } catch (recoveryError) {
        console.error('[timeWarp] exit recovery failed', recoveryError);
      }
    } finally {
      complete();
    }
  };
  void restore();
}
