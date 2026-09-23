import { TournamentSearchResult } from 'services/apis/searchTournaments';

/**
 * Drives the tournaments search box against the SERVER instead of the loaded page.
 *
 * Three things this exists to get right, none of which the in-memory filter had to care about:
 *
 * 1. **Debounce.** `buildSearchItem` calls `setSearchQuery` on every keystroke (`onKeyUp`). That is
 *    free against an array and a request per character against a service.
 * 2. **Out-of-order responses.** "ope" issued before "open" can resolve AFTER it, and the slower,
 *    staler answer would win and show results for a query the box no longer contains. Every request
 *    carries a sequence number and only the newest may render — the same defect class as the
 *    calendar walk that resolved into a logged-out browser on 2026-09-15.
 * 3. **A short query is not a query.** One character against 49,749 tournaments is a page of noise,
 *    so below `minLength` the page goes back to filtering what it has, which is instant and local.
 *
 * Errors are reported, never swallowed into an empty result set: "no matches" and "the request
 * failed" must not look the same, because the first is an answer and the second is a missing one.
 */

export interface OnlineSearchDeps {
  /** Issues the search. Rejections reach `onError`; it is never expected to swallow them. */
  search: (query: string) => Promise<TournamentSearchResult>;
  /** A newer, complete result set for the query the box currently holds. */
  onResults: (result: TournamentSearchResult, query: string) => void;
  /** Go back to filtering the rows already loaded (query cleared, or too short to send). */
  onLocal: () => void;
  onError: (error: unknown, query: string) => void;
  debounceMs?: number;
  minLength?: number;
}

export interface OnlineSearchController {
  setQuery(query: string): void;
  /** Cancel anything pending — nothing may render after this. */
  dispose(): void;
}

const DEFAULT_DEBOUNCE_MS = 300;
/** Two characters. One is not a search, it is the whole corpus with extra steps. */
const DEFAULT_MIN_LENGTH = 2;

export function createOnlineSearchController(deps: OnlineSearchDeps): OnlineSearchController {
  const debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const minLength = deps.minLength ?? DEFAULT_MIN_LENGTH;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let issued = 0;
  let applied = 0;
  let disposed = false;

  const cancelPending = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const issue = (query: string) => {
    issued += 1;
    const sequence = issued;
    deps.search(query).then(
      (result) => {
        // Only the newest answer may render. A stale one is discarded, not queued.
        if (disposed || sequence <= applied || sequence !== issued) return;
        applied = sequence;
        deps.onResults(result, query);
      },
      (error) => {
        if (disposed || sequence !== issued) return;
        deps.onError(error, query);
      },
    );
  };

  return {
    setQuery(query: string) {
      if (disposed) return;
      cancelPending();
      const trimmed = query.trim();
      if (trimmed.length < minLength) {
        // Abandon any in-flight answer: the user has backspaced out of searching, and a result
        // arriving afterwards would re-replace the list they just asked to get back.
        issued += 1;
        deps.onLocal();
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        issue(trimmed);
      }, debounceMs);
    },
    dispose() {
      disposed = true;
      cancelPending();
    },
  };
}
