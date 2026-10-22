/**
 * Mutation request handler with server and local execution.
 * Handles tournament modifications with authentication and permission checks.
 */
import { notifyMutationApplied, notifyAuthoritativeRefreshRequired } from 'services/mutation/mutationObservers';
import { captureTournamentOperation, captureTournamentSelection } from 'services/tournament/operationOwnership';
import { getUserContext, ensureUserContext } from 'services/authentication/getUserContext';
import { playedOrderRefusalMessage } from 'services/scheduling/playedOrderRefusal';
import { isSessionValid, reportSessionLost } from 'services/session/sessionGuard';
import { isStale, resetActivityTimer } from 'services/staleness/stalenessGuard';
import { getLoginState, styleLogin } from 'services/authentication/loginState';
import { getSessionIdentity } from 'services/authentication/sessionIdentity';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { venueCalendarDate, venueTimeZone } from 'functions/venueTimeFrame';
import { canUseDemoClock, getDemoClock } from 'services/clock/demoClock';
import { advanceServerSync } from 'services/staleness/serverSync';
import { tmxToast } from 'services/notifications/tmxToast';
import { pipelineConfig } from 'config/pipelineConfig';
import { emitTmx } from 'services/messaging/socketIo';
import * as factory from 'tods-competition-factory';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import dayjs from 'dayjs';
import { t } from 'i18n';
import {
  applyPipelineOverrides,
  callOverrideParams,
  isPipelineActive,
  pipelineForcesLocal,
} from 'services/pipeline/pipelineFeatures';

// types
import type { MutationMethod, ExecutionResult } from 'types/services';

// constants
import { SUPER_ADMIN, TOURNAMENT_ENGINE } from 'constants/tmxConstants';
import { isMutationAllowed } from '@courthive/provider-config';
import { providerConfig } from 'config/providerConfig';

// Read when called, not at module load: the code is the factory's, so a typo cannot drift from it.
const isMissingTournament = (ack: any): boolean =>
  ack?.error?.code === factory.errorConditionConstants.MISSING_TOURNAMENT_RECORD.code;

interface MutationParams {
  tournamentRecord?: any;
  methods: MutationMethod[];
  engine?: string;
  callback?: (result: ExecutionResult) => void;
  /**
   * Ask the server to re-seed the per-event payloads this mutation evicts, so the first public
   * reader does not pay a cache miss. Set it when a reader is imminent — releasing a draw — and
   * leave it off otherwise, because building the payload is the cost the default path avoids.
   * Server-side only; the factory never sees it.
   */
  warmCache?: boolean;
  /** A bulk draft owns its own retry/discard state and disables automatic session replay. */
  retryAfterLogin?: boolean;
  /** Preserve this key when explicitly retrying the same intent. */
  commandId?: string;
}

// ── Pure helpers (testable without DOM) ──

/**
 * Whether every record is still running: its endDate (end of that day) is not before `now`. The tournament the demo
 * clock runs on is judged on the demo clock's venue date instead, so a historical walkthrough is not prompted as out
 * of range; a record with no endDate is judged as real time judges it. `demoDay` is undefined unless the demo clock
 * applies (anonymous, demo posture, a demo tournament), so for every other session this is exactly the real-time
 * check. An empty demo date (no venue zone) falls back to it.
 */
export function recordsInDateRange(
  records: any[],
  now: number,
  demoDay?: { tournamentId: string; date: string },
): boolean {
  return records.every((record: any) => {
    if (demoDay?.date && record.endDate && record.tournamentId === demoDay.tournamentId)
      return record.endDate.slice(0, 10) >= demoDay.date;
    const endTime = dayjs(record.endDate).endOf('day').valueOf();
    return !!(endTime && endTime >= now);
  });
}

export function checkOfflineState(tournamentRecords: Record<string, any>): {
  offline: number;
  invalidOffline: boolean;
} {
  const getOffline = (record: any) =>
    record.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;
  const offlineValues = Object.values(tournamentRecords).map(getOffline).filter(Boolean);
  const invalidOffline =
    offlineValues.length > 1 && !offlineValues.every((v: any) => !v.email || v.email === offlineValues[0].email);
  return { offline: offlineValues.length, invalidOffline };
}

export function applyDevOverrides(methods: MutationMethod[], devParams?: Record<string, any>): MutationMethod[] {
  if (!devParams) return methods;
  return methods.map((m) => (devParams[m.method] ? { ...m, params: { ...m.params, ...devParams[m.method] } } : m));
}

/** What the Pipeline features panel contributes to this mutation: its call params, and whether it forces local. */
export function resolvePipeline(
  tournamentRecord: any,
  methods: MutationMethod[],
): { params: Record<string, boolean>; forceLocal: boolean } {
  const active = isPipelineActive(tournamentRecord, !!getLoginState());
  if (!active) return { params: {}, forceLocal: false };
  const overrides = pipelineConfig.get();
  return {
    params: callOverrideParams(overrides),
    forceLocal: pipelineForcesLocal(tournamentRecord, overrides, active, methods),
  };
}

const LOCAL_ONLY = 'local-only';
const LOCAL_FIRST = 'local-first';
const SERVER_FIRST = 'server-first';
type ExecutionStrategy = typeof LOCAL_ONLY | typeof LOCAL_FIRST | typeof SERVER_FIRST;

export function determineExecutionStrategy(
  hasProvider: boolean,
  offline: boolean,
  serverFirst: boolean,
): ExecutionStrategy {
  if (!hasProvider || offline) return LOCAL_ONLY;
  if (!serverFirst) return LOCAL_FIRST;
  return SERVER_FIRST;
}

export async function mutationRequest(params: MutationParams): Promise<void> {
  if (isStale()) {
    const msg = 'Please refresh tournament data before making changes';
    tmxToast({ message: msg, intent: 'is-warning' });
    if (params.callback) params.callback({ error: { message: msg }, notified: true });
    return;
  }
  resetActivityTimer();

  const {
    tournamentRecord,
    methods,
    engine = TOURNAMENT_ENGINE,
    callback,
    warmCache,
    retryAfterLogin = true,
    commandId = factory.tools.UUID(),
  } = params;
  const state = getLoginState();

  let isCurrent = () => true;
  let isSelected = () => true;
  let completed = false;
  const completion = (result?: any): void => {
    if (completed) return;
    completed = true;
    if (tournamentRecord && isCurrent()) factory[engine].reset();
    if (callback && isFunction(callback)) {
      callback(result);
    } else if (result?.error) {
      tmxToast({
        message: playedOrderRefusalMessage(result) ?? result.error.message ?? t('common.error'),
        intent: 'is-danger',
      });
    }
  };

  const reject = (key: string) => completion({ error: { message: t(key) } });

  if (!Array.isArray(methods)) return reject('common.error');
  const factoryEngine = factory[engine];
  if (!factoryEngine) return completion();

  // Provider-level mutation gating (defense-in-depth — server mirrors this in executionQueue)
  const currentPermissions = providerConfig.get().permissions ?? {};
  const blocked = methods.find((m) => !isMutationAllowed(m.method, currentPermissions));
  if (blocked) {
    return completion({ error: { message: `Action not permitted: ${blocked.method}` } });
  }

  if (tournamentRecord) factoryEngine.setState(tournamentRecord);

  const getProviderId = (tournamentRecord: any) => tournamentRecord?.parentOrganisation?.organisationId;
  const tournamentRecords = factoryEngine.getState()?.tournamentRecords ?? {};

  const { offline, invalidOffline } = checkOfflineState(tournamentRecords);
  if (invalidOffline) return reject('toasts.notAllOffline');

  const tournamentIds = Object.values(tournamentRecords)?.map((record: any) => record.tournamentId);
  const ownsTournament = captureTournamentOperation(tournamentIds);
  const ownsSelection = captureTournamentSelection(tournamentIds);
  const identity = getSessionIdentity();
  isCurrent = () => ownsTournament() && getSessionIdentity() === identity;
  isSelected = () => ownsSelection() && getSessionIdentity() === identity;
  const providerIds = factory.tools.unique(Object.values(tournamentRecords)?.map(getProviderId)).filter(Boolean);
  if (providerIds.length > 1) return reject('toasts.multipleProviders');

  const demo = getDemoClock();
  const demoDay =
    demo && canUseDemoClock()
      ? { tournamentId: demo.tournamentId, date: venueCalendarDate(demo.nowMs, venueTimeZone()) }
      : undefined;
  const inDateRange = recordsInDateRange(Object.values(tournamentRecords), Date.now(), demoDay);

  const mutate = (saveLocal?: boolean) =>
    isCurrent()
      ? makeMutation({
          offline,
          methods,
          factoryEngine,
          tournamentIds,
          completion,
          saveLocal,
          warmCache,
          isCurrent,
          isSelected,
          retryAfterLogin,
          commandId,
        })
      : Promise.resolve(completion({ error: { message: t('mutationPrompts.tournamentChangedBeforeApply') } }));
  if (!inDateRange) {
    queryDateRange({ state, providerIds, mutate, reject });
    return;
  }
  if (providerIds.length && !offline && state) {
    checkPermissions({ state, providerIds, mutate, reject }).catch((error) => completion({ error }));
    return;
  }
  await mutate(true);
}

function queryDateRange({
  state,
  providerIds,
  mutate,
  reject,
}: {
  reject: (key: string) => void;
  state: any;
  providerIds: string[];
  mutate: (saveLocal?: boolean) => Promise<void>;
}): void {
  let chosen = false;
  const onClick = () => {
    chosen = true;
    return providerIds?.length ? checkPermissions({ state, providerIds, mutate, reject }) : mutate();
  };
  return tmxToast({
    action: { onClick, text: t('mutationPrompts.modify') },
    onClose: () => {
      if (!chosen) reject('toasts.notInDateRange');
    },
    message: t('toasts.notInDateRange'),
    intent: 'is-danger',
    pauseOnHover: true,
    duration: 8000,
  });
}

async function checkPermissions({
  state,
  providerIds,
  mutate,
  reject,
}: {
  reject: (key: string) => void;
  state: any;
  providerIds: string[];
  mutate: (saveLocal?: boolean) => Promise<void>;
}): Promise<void> {
  if (!state) {
    context.provider = undefined;
    styleLogin(false);
    return reject('toasts.notLoggedIn');
  }

  const targetProviderId = providerIds[0];

  // Use the multi-provider userContext if available (preferred source —
  // reflects current user_providers state without JWT staleness). Lazy
  // fetch on the mutation path closes the race that produced "Not
  // authorized" toasts for users with NULL users.provider_id whose
  // userContext cache hadn't yet populated. Falling back to JWT fields
  // covers older sessions where /auth/me is unreachable.
  const userContext = (await ensureUserContext()) ?? getUserContext();
  const isProvider = userContext
    ? userContext.providerIds.includes(targetProviderId)
    : !!(
        state?.providerIds?.includes(targetProviderId) ||
        state?.providerAssociations?.some((a: any) => a.providerId === targetProviderId) ||
        state?.provider?.organisationId === targetProviderId
      );
  const isSuperAdmin = userContext ? userContext.isSuperAdmin : state?.roles?.includes(SUPER_ADMIN);
  const impersonating = context.provider?.organisationId === targetProviderId;

  if (!isProvider && !isSuperAdmin) return reject('toasts.notAuthorized');
  if (!isProvider && isSuperAdmin && !impersonating) {
    let chosen = false;
    const impersonateProvider = () => {
      chosen = true;
      context.provider = { organisationId: targetProviderId, organisationName: '', organisationAbbreviation: '' };
      return mutate(false);
    };

    return tmxToast({
      action: {
        onClick: impersonateProvider,
        text: t('mutationPrompts.impersonate'),
      },
      message: t('toasts.superAdmin'),
      onClose: () => {
        if (!chosen) reject('toasts.notAuthorized');
      },
      intent: 'is-danger',
    });
  }

  const saveLocal = !isProvider && !(isSuperAdmin && impersonating);
  await mutate(saveLocal);
}

function engineExecution({ factoryEngine, methods }: { factoryEngine: any; methods: any[] }): any {
  if (debugConfig.get().log?.verbose) console.log('%c executing locally', 'color: lightgreen');
  const directives = factory.tools.makeDeepCopy(methods);
  const result = factoryEngine.executionQueue(directives, true) || {};
  // Single choke point every mutationRequest passes through. Any successful
  // local mutation makes page-level factory-read caches (e.g. the schedule2
  // matchUp cache) stale — notify central observers so they invalidate
  // before any callback re-reads. Without this, score entry from the scoring
  // modal (which calls mutationRequest directly, not the schedule's
  // executeMethods) left the grid showing pre-score data after modal close.
  if (!result.error) notifyMutationApplied({ methods, tournamentId: factoryEngine.getTournamentId?.() });
  return result;
}

async function localSave(saveLocal: boolean): Promise<void> {
  if (saveLocal || serverConfig.get().saveLocal) {
    await saveTournamentRecord();
  }
}

async function makeMutation({
  offline,
  methods,
  completion,
  factoryEngine,
  tournamentIds,
  saveLocal,
  warmCache,
  isCurrent,
  isSelected,
  retryAfterLogin,
  commandId,
}: {
  commandId: string;
  retryAfterLogin: boolean;
  isCurrent: () => boolean;
  isSelected: () => boolean;
  offline: any;
  methods: any[];
  completion: (result?: any) => void;
  factoryEngine: any;
  tournamentIds: string[];
  saveLocal?: boolean;
  warmCache?: boolean;
}): Promise<void> {
  const initiatingIdentity = getSessionIdentity();
  const tournamentRecord = factoryEngine.getTournament().tournamentRecord;
  // Pipeline features (Settings): their per-call options ride on every setMatchUpStatus, and a mock tournament
  // in use under them runs locally — results under modified rules must not reach the server.
  const pipeline = resolvePipeline(tournamentRecord, methods);
  const hasProvider = !pipeline.forceLocal && !!tournamentRecord?.parentOrganisation?.organisationId;
  const resolvedMethods = applyPipelineOverrides(applyDevOverrides(methods, window['dev']?.params), pipeline.params);
  if (window?.['dev']?.getContext().internal) console.log({ methods: resolvedMethods });

  const strategy = determineExecutionStrategy(hasProvider, !!offline, serverConfig.get().serverFirst);

  let factoryResult: any;
  if (strategy === LOCAL_ONLY || strategy === LOCAL_FIRST) {
    factoryResult = engineExecution({ factoryEngine, methods: resolvedMethods });
    if (factoryResult.error) return completion(factoryResult);
    if (strategy === LOCAL_ONLY) {
      await localSave(true);
      return completion(factoryResult);
    }
  }

  if (hasProvider && (factoryResult?.success || strategy === SERVER_FIRST)) {
    let ackReceived = false;
    let timedOut = false;
    const ackCallback = (ack: any) => {
      if (timedOut || ackReceived) return;
      if (!isCurrent()) {
        ackReceived = true;
        if (ack?.success && isSelected()) {
          notifyAuthoritativeRefreshRequired(tournamentIds);
          if (strategy === SERVER_FIRST) completion({ success: true, refreshRequired: true });
          return;
        }
        if (strategy === SERVER_FIRST)
          completion({ error: { message: t('mutationPrompts.tournamentChangedAwaitingAck') } });
        return;
      }
      ackReceived = true;
      // A receipt replay may follow a full reload that already includes this command. Refresh
      // the owned copy via the durable recovery signal rather than running business methods twice.
      if ((ack as any)?.deduplicated) return completion({ success: true, recovered: true });
      const missingTournament = isMissingTournament(ack);
      if (strategy === SERVER_FIRST && (ack?.success || missingTournament)) {
        (async () => {
          try {
            factoryResult = engineExecution({
              factoryEngine,
              methods: ack?.success ? (ack.appliedMethods ?? resolvedMethods) : resolvedMethods,
            });
            if (factoryResult.error) {
              if (!ack?.success) return completion(factoryResult);
              notifyAuthoritativeRefreshRequired(tournamentIds);
              return completion({ success: true, refreshRequired: true, localError: factoryResult.error });
            }
            if (ack?.success) advanceServerSync(ack.previousServerUpdatedAt, ack.serverUpdatedAt);
            try {
              await localSave(saveLocal || missingTournament);
            } catch (persistenceError) {
              // The server and engine accepted this edit. Finish the save without inviting a duplicate
              // retry, but expose the failed local persistence and its reduced offline availability.
              console.error('[mutationRequest] accepted edit could not be saved locally:', persistenceError);
              tmxToast({ message: t('storage.writeFailed'), intent: 'is-danger' });
              return completion({ ...factoryResult, persistenceError });
            }
            return completion(factoryResult);
          } catch (error) {
            console.error('[mutationRequest] accepted edit could not be applied locally:', error);
            notifyAuthoritativeRefreshRequired(tournamentIds);
            completion({ success: true, refreshRequired: true, localError: error });
          }
        })();
      } else if (strategy === LOCAL_FIRST && ack?.success) {
        // Ordinary local-first methods are already applied. A different canonical payload needs a
        // refresh, not a blind second application of potentially non-idempotent business methods.
        if (!ack.appliedMethods || JSON.stringify(ack.appliedMethods) === JSON.stringify(resolvedMethods)) {
          advanceServerSync(ack.previousServerUpdatedAt, ack.serverUpdatedAt);
        } else {
          notifyAuthoritativeRefreshRequired(tournamentIds);
        }
      } else if (strategy === SERVER_FIRST) {
        completion(ack?.error ? ack : { error: { message: t('mutationPrompts.rejected') } });
      }
    };
    if (debugConfig.get().log?.verbose) console.log('%c invoking remote', 'color: lightblue');
    const emitted = emitTmx({
      data: {
        type: 'executionQueue',
        payload: { methods: resolvedMethods, tournamentIds, rollbackOnError: true, warmCache, commandId },
      },
      ackCallback,
      // Local-first has already applied the edit here, so it must reach the server even across a reload.
      durable: strategy === LOCAL_FIRST,
    });
    if (strategy === LOCAL_FIRST) {
      await localSave(saveLocal || false);
      if (emitted?.persisted && !(await emitted.persisted)) {
        return completion({ error: { message: t('toasts.durableQueueFailed') } });
      }
    } else {
      setTimeout(() => {
        if (ackReceived) return;
        timedOut = true;
        // Offline, the mutation waits in socketIo's queue. Withdraw it: this edit is about to be
        // reported as failed (or preserved for the session replay below), and a late replay would
        // apply on the server what the UI has already said did not happen — or apply it twice.
        emitted?.cancel();
        // Distinguish an auth failure from a genuine outage. A logged-out /
        // expired session produces the same "no ack" symptom as a down server,
        // but the fix is completely different: the user must log in again, and
        // the tournament they're looking at (loaded from IndexedDB) is fine.
        // Preserve the edit and replay it once the session is restored, rather
        // than dropping it and blaming the server.
        if (!isSessionValid()) {
          reportSessionLost({
            source: 'mutation-timeout',
            ...(retryAfterLogin && {
              retry: () => {
                if (getSessionIdentity() !== initiatingIdentity) return;
                // The same resolved methods under the same commandId: the server deduplicates the replay.
                replayServerMutation({
                  methods: resolvedMethods,
                  factoryEngine,
                  tournamentIds,
                  saveLocal,
                  warmCache,
                  commandId,
                });
              },
            }),
          });
          return completion({ error: { message: t('mutationPrompts.sessionExpired'), code: 'SESSION_EXPIRED' } });
        }
        tmxToast({ message: t('toasts.serverNotResponding'), intent: 'is-danger' });
        completion({ error: { message: t('toasts.serverNotResponding') }, notified: true });
      }, serverConfig.get().serverTimeout ?? 10000);
    }
  }

  if (strategy === LOCAL_FIRST) return completion(factoryResult);
}

/**
 * Re-issue a server-first mutation that was preserved when the session expired.
 * Self-contained: it re-emits the executionQueue and, on a successful ack,
 * applies the methods locally and saves — WITHOUT re-invoking the original
 * caller's completion/callback (that already resolved with SESSION_EXPIRED so
 * the UI could move on). The session guard invokes this after the session is
 * restored and the socket has reconnected with a fresh token, so the user's
 * edit lands instead of being lost. Mirrors the ack-success branch of
 * makeMutation minus the completion call.
 */
export function replayServerMutation({
  methods,
  factoryEngine,
  tournamentIds,
  saveLocal,
  warmCache,
  commandId = factory.tools.UUID(),
}: {
  methods: any[];
  factoryEngine: any;
  tournamentIds: string[];
  saveLocal?: boolean;
  warmCache?: boolean;
  commandId?: string;
}): void {
  const isCurrent = captureTournamentOperation(tournamentIds);
  const isSelected = captureTournamentSelection(tournamentIds);
  const replayIdentity = getSessionIdentity();
  let acknowledged = false;
  const ackCallback = (ack: any) => {
    if (acknowledged) return;
    acknowledged = true;
    if (getSessionIdentity() !== replayIdentity || !isSelected()) return;
    if (!isCurrent()) {
      if (ack?.success) notifyAuthoritativeRefreshRequired(tournamentIds);
      return;
    }
    // A deduplicated answer proves the server applied this command earlier, not that this copy did: its first
    // answer was lost. Never advance sync on a receipt alone; pull the authoritative record instead.
    if (ack?.deduplicated) {
      notifyAuthoritativeRefreshRequired(tournamentIds);
      return;
    }
    const missingTournament = isMissingTournament(ack);
    if (!serverConfig.get().serverFirst || !(ack?.success || missingTournament)) return;
    const result = engineExecution({
      factoryEngine,
      methods: ack?.success ? (ack.appliedMethods ?? methods) : methods,
    });
    if (result.error) return;
    if (ack?.success) advanceServerSync(ack.previousServerUpdatedAt, ack.serverUpdatedAt);
    void localSave(saveLocal || missingTournament);
  };
  emitTmx({
    data: { type: 'executionQueue', payload: { methods, tournamentIds, rollbackOnError: true, warmCache, commandId } },
    ackCallback,
    // The edit the user was told was preserved: a reload must not lose it.
    durable: true,
  });
}

// Provider mutation gating lives at constants/mutationPermissions.ts
// (imported as `isMutationAllowed`).
