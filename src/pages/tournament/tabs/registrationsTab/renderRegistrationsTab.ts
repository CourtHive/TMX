/**
 * HiveID Phase 2-B — Registrations tab.
 *
 * Lists applicants for the currently loaded tournament, surfaces
 * per-row accept / waitlist / reject actions, and provides a bulk
 * action bar on top of the Tabulator selection model. All mutations
 * flow through the new admin endpoints which run `addParticipants`
 * server-side via the existing executionQueue (no client-side
 * mutationRequest hop — the server owns the orchestration).
 */
import { tournamentEngine } from 'services/factory/engine';
import { controlBar } from 'courthive-components';

import {
  type RegistrationEntry,
  type RegistrationStatus,
  acceptRegistration,
  bulkRegistrationAction,
  getTournamentRegistrations,
  rejectRegistration,
  waitlistRegistration,
} from 'services/apis/registrationsApi';
import { createRegistrationsTable } from './createRegistrationsTable';
import { filterEntriesByValue, type FilterValue } from './buildRegistrationStatusFilter';
import { tmxToast } from 'services/notifications/tmxToast';
import { context } from 'services/context';

import { LEFT, REGISTRATIONS_CONTROL, RIGHT, TOURNAMENT_REGISTRATIONS } from 'constants/tmxConstants';

type AdminAction = 'accept' | 'waitlist' | 'reject';

const INTENT_SUCCESS = 'is-success';
const INTENT_WARNING = 'is-warning';
const INTENT_DANGER = 'is-danger';
const INTENT_INFO = 'is-info';

interface TabState {
  allEntries: RegistrationEntry[];
  selectedIds: string[];
  filter: FilterValue;
  setEntries?: (rows: RegistrationEntry[]) => void;
}

let state: TabState | undefined;

export async function renderRegistrationsTab(): Promise<void> {
  const tableTarget = document.getElementById(TOURNAMENT_REGISTRATIONS);
  const controlTarget = document.getElementById(REGISTRATIONS_CONTROL);
  if (!tableTarget || !controlTarget) return;
  tableTarget.innerHTML = '';
  controlTarget.innerHTML = '';

  const tournamentId = resolveTournamentId();
  if (!tournamentId) {
    tableTarget.innerHTML = `<div style="padding:2em;color:var(--tmx-text-secondary)">No tournament loaded.</div>`;
    return;
  }

  state = { allEntries: [], selectedIds: [], filter: 'open' };

  const { table, setEntries } = createRegistrationsTable({
    entries: [],
    onSelectionChange: (ids) => {
      if (!state) return;
      state.selectedIds = ids;
      renderControlBar(tournamentId, controlTarget);
    },
    onRowAction: (action, registrationId) => {
      void runSingleAction(tournamentId, action, registrationId);
    },
  });
  state.setEntries = setEntries;
  // Hold a reference so the bulk handler can clear selection after acting.
  (state as any).table = table;

  renderControlBar(tournamentId, controlTarget);
  await refresh(tournamentId);
}

async function refresh(tournamentId: string): Promise<void> {
  if (!state) return;
  try {
    const entries = await getTournamentRegistrations({ tournamentId });
    state.allEntries = entries;
    applyFilter();
  } catch (err: any) {
    tmxToast({ message: `Could not load registrations: ${err?.message ?? err}`, intent: INTENT_DANGER });
  }
}

function applyFilter(): void {
  if (!state?.setEntries) return;
  const filtered = filterEntriesByValue(state.allEntries, state.filter);
  state.setEntries(filtered);
}

function renderControlBar(tournamentId: string, target: HTMLElement): void {
  if (!state) return;
  const tabState = state;
  const counts = countByStatus(tabState.allEntries);
  const filterOptions: Array<{ label: string; value: FilterValue; onClick: () => void }> = [
    { label: `Open (${counts.applied + counts.waitlisted})`, value: 'open', onClick: () => setFilter('open') },
    { label: `Applied (${counts.applied})`, value: 'applied', onClick: () => setFilter('applied') },
    { label: `Waitlisted (${counts.waitlisted})`, value: 'waitlisted', onClick: () => setFilter('waitlisted') },
    { label: `Accepted (${counts.accepted + counts.seeded})`, value: 'accepted', onClick: () => setFilter('accepted') },
    { label: `Rejected (${counts.rejected})`, value: 'rejected', onClick: () => setFilter('rejected') },
    { label: `All (${state.allEntries.length})`, value: 'all', onClick: () => setFilter('all') },
  ];
  const selectedCount = tabState.selectedIds.length;
  const buildBulkItem = (
    action: AdminAction,
    baseLabel: string,
    intent: string,
    id: string,
  ) => ({
    onClick: () => void runBulkAction(tournamentId, action),
    label: selectedCount ? `${baseLabel} ${selectedCount}` : baseLabel,
    intent,
    disabled: !selectedCount,
    location: RIGHT,
    id,
  });
  const items = [
    {
      options: filterOptions,
      label: filterOptions.find((o) => o.value === tabState.filter)?.label ?? 'Open',
      modifyLabel: true,
      intent: INTENT_INFO,
      location: LEFT,
      id: 'registrationsFilter',
    },
    buildBulkItem('accept', 'Accept', INTENT_SUCCESS, 'bulkAccept'),
    buildBulkItem('waitlist', 'Waitlist', INTENT_WARNING, 'bulkWaitlist'),
    buildBulkItem('reject', 'Reject', INTENT_DANGER, 'bulkReject'),
  ];
  target.innerHTML = '';
  controlBar({ target, items });
}

function setFilter(value: FilterValue): void {
  if (!state) return;
  state.filter = value;
  applyFilter();
  const tournamentId = resolveTournamentId();
  const controlTarget = document.getElementById(REGISTRATIONS_CONTROL);
  if (tournamentId && controlTarget) renderControlBar(tournamentId, controlTarget);
}

async function runSingleAction(
  tournamentId: string,
  action: AdminAction,
  registrationId: string,
): Promise<void> {
  try {
    if (action === 'accept') {
      await acceptRegistration({ tournamentId, registrationId });
      tmxToast({ message: 'Applicant accepted into the tournament.', intent: INTENT_SUCCESS });
    } else if (action === 'waitlist') {
      await waitlistRegistration({ tournamentId, registrationId });
      tmxToast({ message: 'Applicant moved to waitlist.', intent: INTENT_INFO });
    } else {
      await rejectRegistration({ tournamentId, registrationId });
      tmxToast({ message: 'Applicant rejected.', intent: INTENT_INFO });
    }
    await refresh(tournamentId);
  } catch (err: any) {
    tmxToast({ message: `${action} failed: ${err?.message ?? err}`, intent: INTENT_DANGER });
  }
}

async function runBulkAction(tournamentId: string, action: AdminAction): Promise<void> {
  if (!state?.selectedIds.length) return;
  try {
    const { results } = await bulkRegistrationAction({
      tournamentId,
      action,
      registrationIds: state.selectedIds,
    });
    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    tmxToast({
      message: failCount
        ? `${action}: ${okCount} succeeded, ${failCount} failed.`
        : `${action}: ${okCount} processed.`,
      intent: failCount ? INTENT_WARNING : INTENT_SUCCESS,
    });
    state.selectedIds = [];
    (state as any).table?.deselectRow?.();
    await refresh(tournamentId);
  } catch (err: any) {
    tmxToast({ message: `Bulk ${action} failed: ${err?.message ?? err}`, intent: INTENT_DANGER });
  }
}

function countByStatus(entries: RegistrationEntry[]): Record<RegistrationStatus, number> {
  const counts: Record<RegistrationStatus, number> = {
    applied: 0,
    accepted: 0,
    seeded: 0,
    waitlisted: 0,
    rejected: 0,
    withdrawn: 0,
  };
  for (const entry of entries) counts[entry.status]++;
  return counts;
}

function resolveTournamentId(): string | null {
  const tournamentId = (context as any).tournamentId;
  if (tournamentId) return tournamentId;
  const { tournamentRecord } = tournamentEngine.getTournament();
  return tournamentRecord?.tournamentId ?? null;
}
