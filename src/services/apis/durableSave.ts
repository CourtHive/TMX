/**
 * Durable, conditional whole-record saves (C3; server contract in competition-factory-server
 * src/storage/postgres/COMMAND_RECEIPTS.md § Wholesale saves).
 *
 * `POST /factory/save` replaces the server's record. The flows that call it (go online, claim,
 * upload, create) act on the answer: some delete the local copy. A lost answer used to leave two
 * bad choices: keep the copy not knowing whether the save landed, or resend and overwrite whatever
 * landed in between. Two opt-in fields close that:
 *
 * - `commandId`: generated ONCE per user action and reused on every resend. The server answers a
 *   resend with the original answer plus `deduplicated: true`, and does not write again. The server
 *   fingerprints the body, so a resend must carry the identical body: the record is snapshotted
 *   once, before the first send.
 * - `expectedServerUpdatedAt`: `{ [tournamentId]: serverUpdatedAt | null }`, the write this copy is
 *   known to be current at, or null for "must not exist yet". A record written since is refused
 *   with 409 `{ conflict: true, tournamentId, expectedServerUpdatedAt, serverUpdatedAt }` and
 *   nothing is written. A tournament left out is saved unconditionally.
 *
 * Pure apart from `serverSyncAt` and localStorage: the transport and the wait are injected, and the
 * caller reports the outcome (reportSaveOutcome.ts), so this module never touches the DOM.
 */
import { serverSyncAt } from 'services/staleness/serverSync';
import { tools } from 'tods-competition-factory';

/** What the save is for: it decides what the copy is expected to replace on the server. */
export type SaveFlow = 'create' | 'claim' | 'goOnline' | 'upload';

export type SaveOutcome =
  | { status: 'saved'; deduplicated: boolean; data: any }
  | {
      status: 'conflict';
      tournamentId?: string;
      expectedServerUpdatedAt: string | null;
      serverUpdatedAt: string | null;
    }
  | { status: 'refused'; httpStatus?: number; data: any }
  | { status: 'uncertain'; reason: string };

export type DurableSaveResult = SaveOutcome & { commandId: string; attempts: number };

export type SaveBody = {
  tournamentRecord: any;
  commandId: string;
  expectedServerUpdatedAt?: Record<string, string | null>;
};

const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** Delays before each resend. Each send has its own 20 s network timeout (servicesApi). */
export const RETRY_DELAYS_MS = [1000, 3000];

/** Read an answer from `/factory/save`. `uncertain` means nothing came back that says whether it landed. */
export function classifySaveResponse(response: any): SaveOutcome {
  if (!response) return { status: 'uncertain', reason: 'no response' };
  const { status, data } = response;
  if (status === 401) return { status: 'uncertain', reason: 'not authenticated' };
  // 503 is also the server's "could not be committed, retry" (a retryable failure inside the receipt).
  if (GATEWAY_STATUSES.has(status) || status >= 500) return { status: 'uncertain', reason: `server ${status}` };
  if (status === 409 && data?.conflict) {
    return {
      status: 'conflict',
      tournamentId: data.tournamentId,
      expectedServerUpdatedAt: data.expectedServerUpdatedAt ?? null,
      serverUpdatedAt: data.serverUpdatedAt ?? null,
    };
  }
  if (status >= 200 && status < 300 && data?.success)
    return { status: 'saved', deduplicated: !!data.deduplicated, data };
  return { status: 'refused', httpStatus: status, data };
}

const OFFLINE_SYNC_PREFIX = 'tmxOfflineSync:';

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/** The tab's sync point (serverSync.ts) as the server reports it: `toISOString()` of the row's write time. */
export function syncPointIso(tournamentId: string): string | undefined {
  const at = serverSyncAt(tournamentId);
  return at === undefined ? undefined : new Date(at).toISOString();
}

/**
 * Going offline: keep the write the copy is current at past a reload. An offline tournament reloads
 * from IndexedDB with no sync point (tournamentDisplay `tryLocal`), and standalone mode routinely
 * outlives the tab, so without this going online would have nothing to send.
 */
export function rememberOfflineSyncPoint(tournamentId: string): void {
  const iso = syncPointIso(tournamentId);
  try {
    if (iso) storage()?.setItem(OFFLINE_SYNC_PREFIX + tournamentId, iso);
    else storage()?.removeItem(OFFLINE_SYNC_PREFIX + tournamentId);
  } catch {
    // storage unavailable: going online then has no precondition, as before C3
  }
}

export function offlineSyncPoint(tournamentId: string): string | undefined {
  try {
    return storage()?.getItem(OFFLINE_SYNC_PREFIX + tournamentId) ?? undefined;
  } catch {
    return undefined;
  }
}

export function forgetOfflineSyncPoint(tournamentId: string): void {
  try {
    storage()?.removeItem(OFFLINE_SYNC_PREFIX + tournamentId);
  } catch {
    // nothing to forget
  }
}

/**
 * The precondition each flow sends, or undefined for an unconditional save.
 *
 * - `create`, `claim`: the record has never been on the server (a new tournamentId; a record with no
 *   provider, which the server will not store). One that exists is someone else's: null.
 * - `goOnline`: the write the tournament went offline at. Offline edits are local only, so the
 *   server should hold nothing newer; if it does, those writes would be lost. Unknown (went offline
 *   before this was recorded) keeps the old unconditional save rather than stranding the tournament.
 * - `upload`: the director confirmed replacing the server's record, but not records written since
 *   this copy was read. Known sync point → conditional; a copy with none (loaded locally) → as confirmed.
 */
export function expectedServerUpdatedAtFor(
  flow: SaveFlow,
  tournamentId: string,
): Record<string, string | null> | undefined {
  if (flow === 'create' || flow === 'claim') return { [tournamentId]: null };
  const known =
    flow === 'goOnline' ? (syncPointIso(tournamentId) ?? offlineSyncPoint(tournamentId)) : syncPointIso(tournamentId);
  return known ? { [tournamentId]: known } : undefined;
}

/** A save whose outcome stayed uncertain, kept so that repeating the SAME action reuses its key. */
const uncertainSaves = new Map<string, { commandId: string; intent: string }>();

/** Tests only. */
export function resetDurableSaves(): void {
  uncertainSaves.clear();
}

/**
 * Save one record durably: one commandId for the action, resent on an uncertain outcome up to
 * `delays.length` times. A deduplicated answer is a success (the first send landed).
 *
 * If every send stays uncertain, the key is kept with the exact body: the director repeating the
 * action unchanged resends under it, so a save that did land is answered, not reported as a conflict.
 */
export async function durableSave({
  tournamentRecord,
  flow,
  send,
  wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  delays = RETRY_DELAYS_MS,
}: {
  tournamentRecord: any;
  flow: SaveFlow;
  send: (body: SaveBody) => Promise<any>;
  wait?: (ms: number) => Promise<unknown>;
  delays?: number[];
}): Promise<DurableSaveResult> {
  const tournamentId = tournamentRecord?.tournamentId;
  const expectedServerUpdatedAt = expectedServerUpdatedAtFor(flow, tournamentId);
  // One serialization: the body every send carries, and the intent a repeated action must match.
  const snapshot = JSON.stringify(tournamentRecord);
  const intent = `${JSON.stringify(expectedServerUpdatedAt ?? null)}\n${snapshot}`;
  const prior = uncertainSaves.get(tournamentId);
  const commandId = prior?.intent === intent ? prior.commandId : tools.UUID();

  const body: SaveBody = {
    tournamentRecord: JSON.parse(snapshot),
    commandId,
    ...(expectedServerUpdatedAt && { expectedServerUpdatedAt }),
  };

  let outcome: SaveOutcome = { status: 'uncertain', reason: 'not sent' };
  let attempts = 0;
  while (attempts <= delays.length) {
    if (attempts > 0) await wait(delays[attempts - 1]);
    attempts += 1;
    let response: any;
    try {
      response = await send(body);
    } catch (error) {
      console.warn('[durableSave] request failed; outcome uncertain:', error);
    }
    outcome = classifySaveResponse(response);
    if (outcome.status !== 'uncertain') break;
  }

  if (outcome.status === 'uncertain') uncertainSaves.set(tournamentId, { commandId, intent });
  else uncertainSaves.delete(tournamentId);

  return { ...outcome, commandId, attempts };
}
