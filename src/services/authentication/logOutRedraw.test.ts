import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * `logOut` must not let the tournaments list render the departing user's tournaments.
 *
 * The list falls back to reading local IndexedDB once identity is cleared, and `logOut`
 * navigates SYNCHRONOUSLY while the IndexedDB wipe is still in flight. The fix chains a
 * redraw onto the wipe so the list re-reads once the delete has landed.
 *
 * ## Why this is a unit test and not the journey
 *
 * Journey 113 covers the post-logout end state and is worth having, but it cannot prove this:
 * with the fix reverted it stays GREEN, because locally the wipe simply wins the race and the
 * stale render never happens (600 ballast records did not open the window, and counting anchor
 * rebuilds does not separate the two states). What is being asserted here is an ORDERING, and
 * an ordering is deterministic only when the wipe's completion is controlled — which is what
 * the deferred promise below does.
 *
 * No production export was needed. `redrawTournamentsListAfterWipe` stays private on purpose:
 * testing it directly would only exercise its `contentEquals` guard, and the guard was never
 * the defect. The defect is whether the rebuild is *chained onto* the wipe or races it, and
 * that is only visible from `logOut`.
 */

const deleteProviderBoundTournaments = vi.fn();
const resetLocalCalendar = vi.fn();
const createTournamentsTable = vi.fn();
const navigate = vi.fn();
let content = 'tournaments';

vi.mock('services/storage/tmx2db', () => ({
  tmx2db: { deleteProviderBoundTournaments: () => deleteProviderBoundTournaments() },
}));
vi.mock('services/storage/localCalendar', () => ({ resetLocalCalendar: () => resetLocalCalendar() }));
vi.mock('components/tables/tournamentsTable/createTournamentsTable', () => ({
  createTournamentsTable: () => createTournamentsTable(),
}));
vi.mock('services/transitions/screenSlaver', () => ({ contentEquals: (what: string) => what === content }));

// Everything below is incidental to the ordering under test — stubbed so `logOut` can run
// outside a browser. Deliberately NOT stubbed with behaviour: if any of these grew a role in
// the wipe/redraw ordering, this test should be revisited rather than silently keep passing.
vi.mock('./tokenManagement', () => ({
  getToken: () => undefined,
  removeToken: vi.fn(),
  setToken: vi.fn(),
  getRefreshToken: () => undefined,
  setRefreshToken: vi.fn(),
  removeRefreshToken: vi.fn(),
}));
vi.mock('./authApi', () => ({ revokeRefreshToken: vi.fn(() => Promise.resolve()) }));
vi.mock('./getUserContext', () => ({ clearUserContext: vi.fn(), fetchUserContext: vi.fn() }));
vi.mock('./isProviderAdmin', () => ({ isActiveProviderAdmin: () => false }));
vi.mock('services/provider/providerState', () => ({ clearActiveProvider: vi.fn() }));
vi.mock('services/provider/initProviderSwitcher', () => ({ initProviderSwitcher: vi.fn() }));
vi.mock('services/session/sessionGuard', () => ({ notifySessionRecovered: vi.fn() }));
vi.mock('services/staleness/stalenessGuard', () => ({ resetActivityTimer: vi.fn() }));
vi.mock('services/messaging/socketIo', () => ({ disconnectSocket: vi.fn() }));
vi.mock('services/apis/baseApi', () => ({ refreshAccessToken: vi.fn() }));
vi.mock('services/factory/engine', () => ({ tournamentEngine: { reset: vi.fn() } }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('services/pdf/pdfFont', () => ({ ensurePdfFontReady: vi.fn() }));
vi.mock('config/providerConfig', () => ({ providerConfig: { reset: vi.fn(), set: vi.fn(), get: () => ({}) } }));
vi.mock('services/demoMode/demoEligibility', () => ({ clearDemoOverlay: vi.fn(), isDemoEligible: () => false }));
vi.mock('services/authentication/validateToken', () => ({ validateToken: () => undefined }));
vi.mock('pages/tournament/tabs/settingsTab/renderSettingsTab', () => ({ renderSettingsTab: vi.fn() }));
vi.mock('pages/tournament/tabs/overviewTab/renderOverview', () => ({ renderOverview: vi.fn() }));
vi.mock('components/modals/loginModal', () => ({ loginModal: vi.fn() }));
vi.mock('components/popovers/tipster', () => ({ tipster: vi.fn() }));
vi.mock('navigation', () => ({ setupChatIndicator: vi.fn() }));
vi.mock('functions/getLoginColor', () => ({ getLoginColor: () => '' }));
vi.mock('i18n', () => ({ t: (k: string) => k, i18next: { language: 'en' } }));
vi.mock('services/context', () => ({
  context: { router: { navigate: (r: string) => navigate(r) }, matchUpFilters: {} },
}));

import { logOut } from './loginState';

/** A promise whose resolution this test controls — the wipe, held open on purpose. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('logOut redraws the tournaments list only after the IndexedDB wipe lands', () => {
  // TMX runs vitest in a node environment — no jsdom or happy-dom in devDependencies — and
  // logOut ends in `styleLogin(false)`, which reads `document.getElementById('login')`. A
  // null-returning stub is enough: styleLogin early-returns when the element is absent, which
  // is what it does on any page without the avatar mounted.
  //
  // `vi.stubGlobal` per test rather than a bare `globalThis.document = …` at module scope, so
  // the fake is established and torn down with each test instead of persisting for the file's
  // lifetime.
  //
  // Honesty about why: this file was reported as order-dependent — passing alone, failing in a
  // full run with a count that varied between 2 and 3 (Mentat in-flight note, 2026-08-27) — and
  // a leaking module-scope global was the obvious suspect. It is NOT the cause. Vitest isolates
  // per file here (no `isolate: false`, no pool override), verified with a two-file probe: a
  // global set at module scope in one spec reads back `undefined` in the next. So the old form
  // could neither leak out nor be clobbered.
  //
  // The scoped stub is kept because it is the better shape regardless, not because it fixes
  // that. The reported failure was NOT reproduced — seven consecutive full runs across two
  // checkouts (1717 and 1727 collected). If it recurs, the failing output is the missing
  // evidence; do not assume this comment settled it.
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('document', { getElementById: () => null });
    content = 'tournaments';
    resetLocalCalendar.mockResolvedValue(undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('does not rebuild the list while the wipe is still in flight', async () => {
    const wipe = deferred();
    deleteProviderBoundTournaments.mockReturnValue(wipe.promise);

    logOut();
    await flush();

    // The navigate has already happened — this is the exact window in which the list rendered
    // the departing user's tournaments. The rebuild must NOT have fired yet, because the
    // records it would read are still in IndexedDB.
    expect(navigate).toHaveBeenCalled();
    expect(createTournamentsTable).not.toHaveBeenCalled();

    wipe.resolve();
    await flush();

    // ...and once the delete has landed, the list re-reads. Reverting the `.finally(redraw)`
    // chain in logOut fails HERE, with 0 calls: nothing ever re-reads, which is why the stale
    // rows survived until a manual reload.
    expect(createTournamentsTable).toHaveBeenCalledTimes(1);
  });

  it('rebuilds even when the wipe fails — identity is already cleared either way', async () => {
    deleteProviderBoundTournaments.mockRejectedValue(new Error('idb unavailable'));

    logOut();
    await flush();
    await flush();

    // `.finally`, not `.then`. A failed wipe still leaves a list that must be re-read: the
    // synchronous identity clears above already changed what it is entitled to show.
    expect(createTournamentsTable).toHaveBeenCalledTimes(1);
  });

  it('does not touch the list when the user is not looking at it', async () => {
    // Logging out from inside a tournament: `contentEquals(TMX_TOURNAMENTS)` is false, and
    // rebuilding a table that is not on screen would be work at best and a stray render at
    // worst. The wipe still runs — only the redraw is skipped.
    content = 'tournament';
    const wipe = deferred();
    deleteProviderBoundTournaments.mockReturnValue(wipe.promise);

    logOut();
    wipe.resolve();
    await flush();
    await flush();

    expect(deleteProviderBoundTournaments).toHaveBeenCalledTimes(1);
    expect(createTournamentsTable).not.toHaveBeenCalled();
  });
});
