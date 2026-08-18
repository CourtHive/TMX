/**
 * Add a tournament venue by picking it out of the canonical facility registry.
 *
 * The alternative — the hand-typed Add Venue form — mints a venueId and courtIds local to this
 * tournament, so the same physical club entered at two tournaments becomes two unrelated venues.
 * A registry venue arrives carrying its canonical `facilityId` and court ids, which is what makes
 * "every tournament at this facility" a join rather than a fuzzy name match, and what lets a court
 * closure logged once reach every tournament there.
 *
 * Flow: search (candidates) → choose → preview the venue and its courts → add.
 *
 * Nothing here resolves. The registry returns candidates and a person picks one; a sole result is
 * still only a candidate and is never auto-selected. See Mentat/planning/REGISTRY_SEARCH_PATTERN.md.
 */
import {
  MIN_FACILITY_QUERY,
  fetchRegistryVenue,
  searchFacilities,
  FacilityCandidate,
  RegistryVenue,
} from 'services/apis/facilitiesApi';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { buildVenueLocator } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { ADD_VENUE } from 'constants/mutationConstants';

const SEARCH_DEBOUNCE_MS = 250;

export function addVenueFromRegistry({ callback }: { callback?: (result: any) => void } = {}): void {
  let timer: any;
  let inFlight: AbortController | undefined;
  let chosen: { candidate: FacilityCandidate; venue: RegistryVenue } | undefined;

  const content = document.createElement('div');

  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'search';
  input.placeholder = t('pages.venues.registry.searchPlaceholder');
  input.setAttribute('aria-label', t('pages.venues.registry.searchPlaceholder'));
  content.appendChild(input);

  const status = document.createElement('div');
  status.style.cssText = 'margin: .5em 0; color: var(--tmx-text-secondary); font-size: .85rem;';
  status.setAttribute('role', 'status');
  content.appendChild(status);

  const results = document.createElement('div');
  results.id = 'facilityResults';
  results.style.cssText = 'max-height: 40vh; overflow-y: auto;';
  content.appendChild(results);

  const preview = document.createElement('div');
  preview.id = 'facilityPreview';
  content.appendChild(preview);

  const setStatus = (message: string) => (status.textContent = message);

  // --- search -------------------------------------------------------------

  const renderCandidates = (candidates: FacilityCandidate[]) => {
    results.replaceChildren();
    for (const candidate of candidates) {
      results.appendChild(candidateRow(candidate, () => choose(candidate)));
    }
  };

  const runSearch = async (query: string) => {
    // Abort the previous request rather than letting a slow early keystroke resolve after a
    // faster later one and repaint stale candidates over the current query's results.
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;

    if (query.trim().length < MIN_FACILITY_QUERY) {
      results.replaceChildren();
      setStatus(t('pages.venues.registry.keepTyping'));
      return;
    }

    setStatus(t('pages.venues.registry.searching'));
    try {
      const { results: candidates } = await searchFacilities(query, { signal: controller.signal });
      if (controller.signal.aborted) return;
      renderCandidates(candidates);
      setStatus(
        candidates.length
          ? t('pages.venues.registry.candidateCount', { count: candidates.length })
          : t('pages.venues.registry.noMatches'),
      );
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') return;
      results.replaceChildren();
      setStatus(t('pages.venues.registry.searchFailed'));
    }
  };

  input.addEventListener('input', () => {
    preview.replaceChildren();
    chosen = undefined;
    clearTimeout(timer);
    const query = input.value;
    timer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  });

  // --- choose + preview ---------------------------------------------------

  async function choose(candidate: FacilityCandidate) {
    setStatus(t('common.loading'));
    let venue: RegistryVenue | null;
    try {
      venue = await fetchRegistryVenue(candidate.facilityId);
    } catch {
      setStatus(t('pages.venues.registry.venueFailed'));
      return;
    }
    if (!venue) {
      // A candidate whose venue is gone is a registry inconsistency, not a user error — say so
      // rather than silently doing nothing.
      setStatus(t('pages.venues.registry.venueMissing'));
      return;
    }

    chosen = { candidate, venue };
    results.replaceChildren();
    setStatus('');
    preview.replaceChildren(buildPreview(venue));
  }

  // --- add ----------------------------------------------------------------

  const addChosenVenue = () => {
    if (!chosen) {
      tmxToast({ message: t('pages.venues.registry.selectFirst'), intent: 'is-warning' });
      return;
    }
    // The registry shapes this as a TODS Venue with its courts inline, and `addVenue` pushes it
    // whole — so there is no companion addCourts call and no translation step to drift.
    const methods = [{ method: ADD_VENUE, params: { venue: chosen.venue, returnDetails: true } }];
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('pages.venues.registry.added'), intent: 'is-success' });
          if (isFunction(callback) && callback) callback(result);
        } else {
          tmxToast({ intent: 'is-danger', message: result?.error?.message || t('common.error') });
        }
      },
    });
  };

  openModal({
    title: t('pages.venues.registry.title'),
    content,
    config: { maxWidth: 620, padding: '1' },
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('pages.venues.registry.addVenue'), intent: 'is-info', onClick: addChosenVenue, close: true },
    ],
  });

  setStatus(t('pages.venues.registry.keepTyping'));
  setTimeout(() => input.focus(), 100);
}

/** One candidate row. `matchedOn` is shown so the list is explainable rather than magic. */
function candidateRow(candidate: FacilityCandidate, onSelect: () => void): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'facility-candidate';
  row.dataset.facilityId = candidate.facilityId;
  row.style.cssText = [
    'display: flex',
    'width: 100%',
    'justify-content: space-between',
    'align-items: center',
    'gap: 1em',
    'padding: .6em .8em',
    'margin-bottom: .35em',
    'text-align: left',
    'cursor: pointer',
    'border: 1px solid var(--tmx-border-primary)',
    'border-radius: 6px',
    'background: var(--tmx-bg-primary)',
    'color: var(--tmx-text-primary)',
  ].join(';');

  const place = [candidate.city, candidate.state, candidate.countryCode].filter(Boolean).join(', ');
  const left = document.createElement('div');
  const name = document.createElement('div');
  name.style.fontWeight = '600';
  name.textContent = candidate.name;
  left.appendChild(name);
  if (place) {
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size: .8rem; color: var(--tmx-text-secondary);';
    sub.textContent = place;
    left.appendChild(sub);
  }

  const right = document.createElement('div');
  right.style.cssText = 'text-align: right; font-size: .8rem; color: var(--tmx-text-secondary); white-space: nowrap;';
  const courts = document.createElement('div');
  courts.textContent = t('pages.venues.registry.courtCount', { count: candidate.courtCount ?? 0 });
  right.appendChild(courts);
  if (candidate.matchedOn) {
    const why = document.createElement('div');
    why.style.fontStyle = 'italic';
    why.textContent = t('pages.venues.registry.matchedOn', { field: candidate.matchedOn });
    right.appendChild(why);
  }

  row.append(left, right);
  row.addEventListener('click', onSelect);
  return row;
}

/**
 * What the user is about to add. `buildVenueLocator` degrades on its own when the facility has no
 * coordinates (or when leaflet is absent), rendering the header and court list without a map, so
 * there is no separate no-geo branch to keep in step here.
 */
function buildPreview(venue: RegistryVenue): HTMLElement {
  const address: any = Array.isArray(venue.addresses) ? venue.addresses[0] : undefined;
  const addressFormatted = [address?.city, address?.state, address?.countryCode].filter(Boolean).join(', ');

  return buildVenueLocator({
    venueId: venue.venueId,
    venueName: venue.venueName,
    ...(addressFormatted ? { addressFormatted } : {}),
    latitude: address?.latitude,
    longitude: address?.longitude,
    courts: (venue.courts ?? []).map((court: any) => ({
      courtId: court.courtId,
      courtName: court.courtName,
      indoorOutdoor: court.indoorOutdoor,
      surfaceCategory: court.surfaceCategory,
      floodlit: court.floodlit,
      courtOrder: court.courtOrder,
    })),
  });
}
