/**
 * ONE ACTING PROVIDER PER BROWSER (Mentat/planning/MULTI_PROVIDER_CONTEXT_COMPLETION.md).
 *
 * The session token lives in localStorage, which every tab shares. When another tab switches provider (a new
 * token for another provider) or signs in as someone else, this tab would go on showing — and trying to write
 * to — the old provider, which the server now refuses. So it reloads into the new session. The `storage` event
 * fires only in the OTHER tabs, never in the one that wrote the token.
 */
import { getJwtTokenStorageKey } from 'config/localStorage';
import { jwtDecode } from 'jwt-decode';

function sessionIdentity(token: string | null): string {
  if (!token) return '';
  try {
    const claims: any = jwtDecode(token);
    return `${claims?.userId ?? claims?.email ?? ''}|${claims?.providerId ?? ''}`;
  } catch {
    return '';
  }
}

/** True when `next` is a different user or provider than `previous` (a silent refresh of the same session is not). */
export function sessionChanged(previous: string | null, next: string | null): boolean {
  return sessionIdentity(previous) !== sessionIdentity(next);
}

let watching = false;

export function watchSessionAcrossTabs(reload: () => void = () => globalThis.location?.reload()): void {
  if (watching || typeof globalThis.addEventListener !== 'function') return;
  watching = true;
  globalThis.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== getJwtTokenStorageKey()) return;
    if (sessionChanged(event.oldValue, event.newValue)) reload();
  });
}
