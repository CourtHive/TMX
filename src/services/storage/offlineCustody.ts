/**
 * Offline custody: a provider-bound tournament that a director has taken offline.
 *
 * "Go offline" stamps a `TMX` timeItem whose `itemValue.offline` names the director's email. From then
 * until "Go online" succeeds, the copy in IndexedDB is the ONLY place the director's edits exist —
 * every mutation runs `local-only` (`mutationRequest.ts`). So for storage purposes such a record is
 * not a cache of a server copy, and the rules written for caches must not apply to it:
 *
 * - it is always saved locally, whatever "Save local copies" says (`saveTournamentRecord`);
 * - it survives the logout/login wipe of provider-bound records (`tmx2db.deleteProviderBoundTournaments`);
 * - it is listed and opened only for the email that holds it, which keeps the wipe's purpose — one
 *   user's records never surface to the next user of a shared browser — without destroying the work.
 */
import { getSessionEmail } from 'services/authentication/sessionIdentity';

type OfflineMarker = { email?: string } | true | undefined;

function offlineMarker(tournamentRecord: any): OfflineMarker {
  return tournamentRecord?.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;
}

/** True when the record carries an offline marker, i.e. its local copy holds edits the server lacks. */
export function isHeldOffline(tournamentRecord: any): boolean {
  return Boolean(offlineMarker(tournamentRecord));
}

/** The email holding the record offline, lowercased; undefined when not held or held anonymously. */
export function offlineHolder(tournamentRecord: any): string | undefined {
  const marker = offlineMarker(tournamentRecord);
  return typeof marker === 'object' ? marker.email?.toLowerCase() || undefined : undefined;
}

/**
 * Whether the current session may see a record. Anything not held offline is visible as before; a
 * record held offline is visible only to its holder. A marker with no email cannot be attributed, so
 * it stays visible rather than becoming unreachable — the one direction that cannot lose work.
 */
export function visibleToSession(tournamentRecord: any, sessionEmail = getSessionEmail()): boolean {
  if (!isHeldOffline(tournamentRecord)) return true;
  const holder = offlineHolder(tournamentRecord);
  return !holder || holder === sessionEmail;
}
