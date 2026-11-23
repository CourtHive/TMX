/** Tab-local isolation. The ledger outlives an isolation session to refuse late sandbox callbacks. */
const sandboxIds = new Set<string>();
const pendingWrites = new Set<object>();
const suspenders = new Set<() => void>();
const refusalListeners = new Set<(error: NetworkIsolationError) => void>();
const refusals = new Map<string, number>();
let isolated = false;
let epoch = 0;
let controller = new AbortController();

export class NetworkIsolationError extends Error {
  readonly code = 'NETWORK_ISOLATED';
  readonly reason: 'active' | 'sandbox-id' | 'stale';
  constructor(reason: 'active' | 'sandbox-id' | 'stale' = 'active') {
    super('Server access is disabled for this isolated session');
    this.name = 'NetworkIsolationError';
    this.reason = reason;
  }
}

export function isNetworkIsolationError(error: unknown): error is NetworkIsolationError {
  return !!error && typeof error === 'object' && (error as any).code === 'NETWORK_ISOLATED';
}

/** Boundary diagnostics fire before rejection, even when a caller catches the error. No payload is retained. */
export function onNetworkRefusal(listener: (error: NetworkIsolationError) => void): () => void {
  refusalListeners.add(listener);
  return () => refusalListeners.delete(listener);
}
export function networkRefusalCount(reason: string): number {
  return refusals.get(reason) ?? 0;
}
export function noteNetworkRefusal(reason: NetworkIsolationError['reason']): NetworkIsolationError {
  const error = new NetworkIsolationError(reason);
  refusals.set(reason, networkRefusalCount(reason) + 1);
  for (const listener of refusalListeners) {
    try {
      listener(error);
    } catch (observerError) {
      console.error('[network] refusal observer failed', observerError);
    }
  }
  return error;
}

export const networkIsIsolated = (): boolean => isolated;
export const serverRequestEpoch = (): number => epoch;
export const serverRequestSignal = (): AbortSignal => controller.signal;
export const pendingServerWriteCount = (): number => pendingWrites.size;
export const registerSandboxId = (id: string): void => {
  sandboxIds.add(id);
};
// This exact namespace is reserved for disposable copies, including exports reopened after reload.
// Keeping recognition here makes storage, mutation and server boundaries agree without an in-memory ledger.
export const isSandboxId = (id: unknown): boolean =>
  typeof id === 'string' && (sandboxIds.has(id) || /^time-warp-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id));

export function setNetworkIsolation(active: boolean): void {
  isolated = active;
  epoch++;
  controller.abort();
  controller = new AbortController();
  if (active) for (const suspend of suspenders) suspend();
}

/** Network owners register teardown here; the policy does not depend on any application transport. */
export function onNetworkIsolation(suspend: () => void): () => void {
  suspenders.add(suspend);
  return () => suspenders.delete(suspend);
}

export function trackServerWrite(request: object, method = 'GET'): () => void {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) pendingWrites.add(request);
  return () => pendingWrites.delete(request);
}

const ID_FIELDS = new Set(['tournamentId', 'sourceTournamentId', 'linkedTournamentId', 'targetTournamentId']);
const IDS_FIELDS = new Set(['tournamentIds', 'linkedTournamentIds']);

/** Inspect identity fields, never names/notes/string content. No serialization or copy of an upload is required. */
function containsSandboxIdentity(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsSandboxIdentity(item, seen));
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    const item = value[key];
    if (ID_FIELDS.has(key) && isSandboxId(item)) return true;
    if (IDS_FIELDS.has(key) && Array.isArray(item) && item.some(isSandboxId)) return true;
    if (key === 'tournamentRecords' && item && typeof item === 'object' && Object.keys(item).some(isSandboxId))
      return true;
    if (containsSandboxIdentity(item, seen)) return true;
  }
  return false;
}

function urlContainsSandboxIdentity(value?: string | URL): boolean {
  if (!value) return false;
  const url = new URL(String(value), 'https://network.invalid');
  const parts = (url.pathname + '/' + url.hash.replace(/^#/, '')).split('/').map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  for (let i = 1; i < parts.length; i++) {
    if (['tournament', 'tournaments'].includes(parts[i - 1]) && isSandboxId(parts[i].split('?')[0])) return true;
  }
  for (const [key, id] of url.searchParams) {
    if (ID_FIELDS.has(key) && isSandboxId(id)) return true;
    if (IDS_FIELDS.has(key) && id.split(',').some(isSandboxId)) return true;
  }
  return false;
}

/** Public protocol payloads pass directly; HTTP callers also supply their URL separately. */
export function assertServerAccess(payload?: unknown, url?: string | URL): void {
  if (isolated) throw noteNetworkRefusal('active');
  if (containsSandboxIdentity(payload) || urlContainsSandboxIdentity(url)) throw noteNetworkRefusal('sandbox-id');
}

export function assertServerEpoch(owner: number): void {
  if (owner !== epoch) throw noteNetworkRefusal('stale');
  if (isolated) throw noteNetworkRefusal('active');
}

export function requestSignal(signal?: AbortSignal | null): AbortSignal {
  return signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
}
