import { getPeerLinkedIds, buildLinkGroup, resolveLinkedRows, availableToLink } from './linkedTournamentsHelpers';
import { LINK_TOURNAMENTS, UNLINK_TOURNAMENT } from 'constants/mutationConstants';
import { getUserContext } from 'services/authentication/getUserContext';
import { requestTournament, getMyCalendars } from 'services/apis/servicesApi';
import { competitionEngine, tournamentEngine } from 'services/factory/engine';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

import type { SiblingTournament } from './linkedTournamentsHelpers';

// ─── data access ────────────────────────────────────────────────────────────

function currentRecord(): any {
  return tournamentEngine.q.tournament();
}

function normalizeSibling(entry: any): SiblingTournament {
  return {
    tournamentId: entry?.tournamentId,
    tournamentName: entry?.tournament?.tournamentName ?? entry?.tournamentName ?? entry?.tournamentId,
    providerId: entry?.providerId ?? entry?.tournament?.parentOrganisation?.organisationId,
    startDate: entry?.tournament?.startDate,
    endDate: entry?.tournament?.endDate,
  };
}

async function fetchSiblings(providerAbbr?: string): Promise<SiblingTournament[]> {
  // /provider/my-calendars is authenticated; calling it while logged out 401s, and baseApi's
  // interceptor treats a 401 as a full logout — which was breaking the settings tab entirely.
  if (!getUserContext()) return [];
  try {
    const result: any = await getMyCalendars(providerAbbr ? { providerAbbr } : {});
    const calendars = result?.data?.calendars ?? [];
    return calendars
      .flatMap((calendar: any) => (calendar?.tournaments ?? []).map(normalizeSibling))
      .filter((sibling: SiblingTournament) => sibling.tournamentId);
  } catch {
    return [];
  }
}

/** Load the primary plus every id in the group into the competitionEngine so a competition-level
 * mutation (linkTournaments/unlinkTournament) resolves the full set. Returns false if any peer
 * record could not be fetched. */
async function loadGroupIntoCompetitionEngine(group: string[], primaryRecord: any): Promise<boolean> {
  competitionEngine.setState(primaryRecord);
  for (const tournamentId of group) {
    if (tournamentId === primaryRecord.tournamentId) continue;
    const result: any = await requestTournament({ tournamentId, silent: true });
    const record = result?.data?.tournamentRecords?.[tournamentId];
    if (!record) return false;
    competitionEngine.setTournamentRecord(record);
  }
  return true;
}

/** After a link/unlink, re-pull the primary from the server and return the client to single-tournament
 * mode (the authoritative post-mutation record carries the updated linkedTournamentIds). */
async function restorePrimary(primaryId: string): Promise<void> {
  try {
    const result: any = await requestTournament({ tournamentId: primaryId, silent: true });
    const record = result?.data?.tournamentRecords?.[primaryId];
    if (record) {
      tournamentEngine.setState(record);
      competitionEngine.setState(record);
    }
  } catch {
    /* best-effort restore */
  }
}

async function dispatchLink(addIds: string[], onDone: () => void): Promise<void> {
  const primaryRecord = currentRecord();
  if (!primaryRecord?.tournamentId || !addIds.length) return;
  const group = buildLinkGroup(primaryRecord.tournamentId, getPeerLinkedIds(primaryRecord), addIds);
  if (group.length < 2) return;
  if (!(await loadGroupIntoCompetitionEngine(group, primaryRecord))) return;
  await mutationRequest({
    methods: [{ method: LINK_TOURNAMENTS, params: { tournamentIds: group } }],
    engine: COMPETITION_ENGINE,
    callback: () => void restorePrimary(primaryRecord.tournamentId).then(onDone),
  });
}

async function dispatchUnlink(removeId: string, onDone: () => void): Promise<void> {
  const primaryRecord = currentRecord();
  if (!primaryRecord?.tournamentId) return;
  const group = buildLinkGroup(primaryRecord.tournamentId, getPeerLinkedIds(primaryRecord), []);
  if (!(await loadGroupIntoCompetitionEngine(group, primaryRecord))) return;
  await mutationRequest({
    methods: [{ method: UNLINK_TOURNAMENT, params: { tournamentId: removeId } }],
    engine: COMPETITION_ENGINE,
    callback: () => void restorePrimary(primaryRecord.tournamentId).then(onDone),
  });
}

// ─── UI ───────────────────────────────────────────────────────────────────

/** Full-width Settings panel listing linked tournaments with add/remove controls. */
export function buildLinkedTournamentsPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'settings-panel panel-teal';
  panel.style.gridColumn = '1 / -1';
  void renderPanelContents(panel);
  return panel;
}

function refresh(panel: HTMLElement): void {
  void renderPanelContents(panel);
}

async function renderPanelContents(panel: HTMLElement): Promise<void> {
  const primaryRecord = currentRecord();
  const primaryId = primaryRecord?.tournamentId;
  const providerId = primaryRecord?.parentOrganisation?.organisationId;
  const providerAbbr = primaryRecord?.parentOrganisation?.organisationAbbreviation;
  const peerIds = getPeerLinkedIds(primaryRecord);

  const siblings = await fetchSiblings(providerAbbr);
  const rows = resolveLinkedRows(peerIds, siblings);
  const candidates = availableToLink(primaryId, providerId, peerIds, siblings);

  panel.innerHTML = `<h3><i class="fa-solid fa-link"></i> Linked tournaments</h3>`;

  const description = document.createElement('p');
  description.style.cssText = 'margin: 0 0 12px 0; color: var(--tmx-text-secondary); font-size: 0.85rem;';
  description.textContent =
    'Tournaments sharing this facility. Linking lets their schedules account for each other on shared courts.';
  panel.appendChild(description);

  if (rows.length) {
    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;';
    for (const row of rows) list.appendChild(buildLinkedRow(row, () => refresh(panel)));
    panel.appendChild(list);
  } else {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: var(--tmx-text-secondary); font-size: 0.85rem; margin-bottom: 12px;';
    empty.textContent = 'No linked tournaments yet.';
    panel.appendChild(empty);
  }

  const linkButton = document.createElement('button');
  linkButton.className = 'button is-small';
  linkButton.textContent = 'Link tournaments';
  linkButton.disabled = !candidates.length;
  linkButton.onclick = () => openLinkPicker(candidates, () => refresh(panel));
  panel.appendChild(linkButton);
}

function buildLinkedRow(row: SiblingTournament, onChange: () => void): HTMLElement {
  const item = document.createElement('div');
  item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';
  const name = document.createElement('span');
  name.textContent = row.tournamentName;
  const remove = document.createElement('button');
  remove.className = 'button is-small is-danger is-light';
  remove.setAttribute('aria-label', `Unlink ${row.tournamentName}`);
  remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  remove.onclick = () => void dispatchUnlink(row.tournamentId, onChange);
  item.append(name, remove);
  return item;
}

function openLinkPicker(candidates: SiblingTournament[], onDone: () => void): void {
  const content = document.createElement('div');
  const checks = new Map<string, HTMLInputElement>();
  for (const candidate of candidates) {
    const label = document.createElement('label');
    label.className = 'checkbox';
    label.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px 0;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = candidate.tournamentId;
    checks.set(candidate.tournamentId, input);
    const span = document.createElement('span');
    span.textContent = candidate.tournamentName;
    label.append(input, span);
    content.appendChild(label);
  }

  openModal({
    title: 'Link tournaments',
    content,
    buttons: [
      { label: 'Cancel', intent: 'is-light', close: true },
      {
        label: 'Link',
        intent: 'is-success',
        close: true,
        onClick: () => {
          const selected = [...checks.entries()].filter(([, input]) => input.checked).map(([id]) => id);
          if (selected.length) void dispatchLink(selected, onDone);
        },
      },
    ],
  });
}
