import { refreshTournamentFromServer } from 'services/messaging/remoteMutations';
import { isActiveProviderAdmin } from 'services/authentication/isProviderAdmin';
import { isStandaloneLocal } from 'services/authentication/isStandaloneLocal';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { serverConfig } from 'config/serverConfig';
import { cannot } from 'services/capability/can';
import { t } from 'i18n';

// constants and types
import { INDIVIDUAL_MERGE_CONFIRM, INDIVIDUAL_MERGE_TARGET, INDIVIDUAL_MERGE_STATUS } from 'constants/tmxConstants';
import { MERGE_INDIVIDUAL_PARTICIPANTS } from 'constants/mutationConstants';

const WARNING = 'is-warning';

type Choice = 'source' | 'target';
type MergePreview = {
  canMerge?: boolean;
  error?: { message?: string };
  fingerprint?: string;
  participant?: { participantName?: string };
  conflicts?: { path: string; source: unknown; target: unknown }[];
  blockers?: { code: string; path: string; eventId?: string; drawId?: string }[];
  changedPaths?: string[];
};
type MergeEngine = {
  getIndividualParticipantMergePreview?: (params: {
    sourceParticipantId: string;
    targetParticipantId: string;
    resolutions: Record<string, Choice>;
  }) => MergePreview;
};

export function supportsIndividualMerge(): boolean {
  return typeof (tournamentEngine as unknown as MergeEngine).getIndividualParticipantMergePreview === 'function';
}

function isStandalone(): boolean {
  const tournamentRecord = tournamentEngine.getTournament()?.tournamentRecord;
  return isStandaloneLocal(tournamentRecord ? [tournamentRecord] : []);
}

/**
 * The answer `mutationRequest` gives, plus the server's role rule. A provider-bound tournament needs the provider's
 * opt-in (with delete and edit allowed too) and a provider administrator. A standalone one (logged out, no parent
 * organisation) has neither a provider nor a server, so the opt-in holds by default and only demo mode can remove it.
 */
export function mayMergeIndividuals(): boolean {
  const standalone = isStandalone();
  if (cannot('mergeParticipants', { standalone })) return false;
  if (cannot('deleteParticipants') || cannot('editParticipantDetails')) return false;
  return standalone || isActiveProviderAdmin();
}

export async function mergeSelectedIndividuals(table: any, callback: () => void): Promise<void> {
  if (!mayMergeIndividuals()) return undefined;
  const selected = table.getSelectedData();
  if (selected.length !== 2) {
    tmxToast({ message: t('participantMerge.selectTwo'), intent: WARNING });
    return undefined;
  }
  if (!supportsIndividualMerge() || !(await serverSupportsMerge())) {
    tmxToast({ message: t('participantMerge.unavailable'), intent: WARNING });
    return undefined;
  }
  openMergeReview(selected, callback);
}

export function activateIndividualMergeAction(element: HTMLElement | undefined, table: any): void {
  if (!element || !supportsIndividualMerge() || !mayMergeIndividuals()) return undefined;
  let supported = false;
  const update = () => {
    if (element.isConnected) element.style.display = supported && table.getSelectedData().length === 2 ? '' : 'none';
  };
  table.on('rowSelectionChanged', update);
  serverSupportsMerge().then((available) => {
    supported = available;
    update();
  });
}

async function serverSupportsMerge(): Promise<boolean> {
  if (isStandalone()) return true; // the merge runs on the local engine only; no server is consulted
  try {
    const base = serverConfig.get().socketPath || globalThis.location.origin;
    const response = await fetch(`${base}/factory/capabilities`, { cache: 'no-store' });
    return response.ok && (await response.json()).individualParticipantMerge === true;
  } catch {
    return false;
  }
}

function openMergeReview(selected: any[], callback: () => void): void {
  const engine = tournamentEngine as unknown as MergeEngine;
  const tournamentId = tournamentEngine.getTournamentId();
  let targetId = selected[0].participantId;
  let resolutions: Record<string, Choice> = {};
  let preview: MergePreview;
  let pending = false;
  let closed = false;
  const content = document.createElement('div');
  const status = document.createElement('p');
  status.id = INDIVIDUAL_MERGE_STATUS;
  status.setAttribute('role', 'status');
  const sourceId = () => selected.find((p) => p.participantId !== targetId).participantId;
  const params = () => ({ tournamentId, sourceParticipantId: sourceId(), targetParticipantId: targetId, resolutions });
  const render = () => {
    preview = engine.getIndividualParticipantMergePreview!(params());
    content.replaceChildren();
    const label = document.createElement('label');
    label.htmlFor = INDIVIDUAL_MERGE_TARGET;
    label.textContent = t('participantMerge.keep');
    const survivor = document.createElement('select');
    survivor.id = INDIVIDUAL_MERGE_TARGET;
    survivor.className = 'input';
    for (const participant of selected) {
      const option = document.createElement('option');
      option.value = participant.participantId;
      option.textContent = `${participant.participantName} (${participant.participantId.slice(-8)})`;
      option.selected = option.value === targetId;
      survivor.appendChild(option);
    }
    survivor.disabled = pending;
    survivor.onchange = () => {
      targetId = survivor.value;
      resolutions = {};
      render();
    };
    const explanation = document.createElement('p');
    explanation.textContent = t('participantMerge.remove');
    content.append(label, survivor, explanation);
    appendComparison(content, selected);
    const summary = document.createElement('p');
    summary.textContent = t('participantMerge.references', { count: preview.changedPaths?.length ?? 0 });
    content.appendChild(summary);
    renderBlockers(content, preview);
    for (const conflict of preview.conflicts ?? []) {
      appendConflict(content, conflict, resolutions, pending, render);
    }
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'button';
    refresh.textContent = t('participantMerge.refresh');
    refresh.disabled = pending;
    refresh.onclick = () => {
      resolutions = {};
      render();
    };
    content.append(refresh, status);
    const confirm = document.getElementById(INDIVIDUAL_MERGE_CONFIRM) as HTMLButtonElement | null;
    if (confirm) confirm.disabled = pending || !preview.canMerge;
  };
  const submit = () => {
    if (pending || closed || !preview.canMerge) return undefined;
    if (tournamentEngine.getTournamentId() !== tournamentId) {
      closeModal();
      return undefined;
    }
    pending = true;
    const intent = { ...params(), expectedFingerprint: preview.fingerprint };
    status.textContent = t('participantMerge.pending');
    render();
    mutationRequest({
      methods: [{ method: MERGE_INDIVIDUAL_PARTICIPANTS, params: intent }],
      callback: async (result) => {
        pending = false;
        if (result.success) callback();
        if (closed) return undefined;
        if (result.success) {
          closeModal();
          tmxToast({
            message: t('participantMerge.success', { name: preview.participant?.participantName }),
            intent: 'is-success',
          });
        } else {
          status.textContent = t('participantMerge.failed');
          pending = true;
          render();
          if (!isStandalone()) await refreshTournamentFromServer(tournamentId);
          pending = false;
          resolutions = {};
          if (!closed) render();
        }
      },
    });
  };
  openModal({
    title: t('participantMerge.title'),
    content,
    config: { maxWidth: 720, content: { padding: '1' } },
    onClose: () => {
      closed = true;
    },
    buttons: [
      { label: t('common.cancel'), close: true },
      {
        id: INDIVIDUAL_MERGE_CONFIRM,
        label: t('participantMerge.confirm'),
        intent: WARNING,
        close: false,
        disabled: true,
        onClick: submit,
      },
    ],
  });
  render();
}

function renderBlockers(content: HTMLElement, preview: MergePreview) {
  if (!preview.error && !preview.blockers?.length) return undefined;
  const heading = document.createElement('p');
  heading.textContent = preview.error?.message || t('participantMerge.blocked');
  const list = document.createElement('ul');
  for (const blocker of preview.blockers ?? []) {
    const item = document.createElement('li');
    const message = t(`participantMerge.${blocker.code}`);
    item.textContent = `${message} ${blockerLocation(blocker)}`;
    list.appendChild(item);
  }
  content.append(heading, list);
}

function appendConflict(
  content: HTMLElement,
  conflict: NonNullable<MergePreview['conflicts']>[number],
  resolutions: Record<string, Choice>,
  pending: boolean,
  render: () => void,
) {
  const label = document.createElement('label');
  label.style.display = 'block';
  label.textContent = fieldLabel(conflict.path);
  const select = document.createElement('select');
  select.className = 'input';
  select.disabled = pending;
  const choices = [
    ['', t('participantMerge.choose')],
    ['target', `${t('participantMerge.target')}: ${JSON.stringify(conflict.target)}`],
    ['source', `${t('participantMerge.source')}: ${JSON.stringify(conflict.source)}`],
  ];
  for (const [value, text] of choices) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = (resolutions[conflict.path] ?? '') === value;
    select.appendChild(option);
  }
  select.onchange = () => {
    if (select.value) resolutions[conflict.path] = select.value as Choice;
    else delete resolutions[conflict.path];
    render();
  };
  label.appendChild(select);
  content.appendChild(label);
}

function fieldLabel(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const field = segments.at(-1) || path;
  const labels: Record<string, string> = {
    birthDate: t('participantMerge.birthDate'),
    standardGivenName: t('participantMerge.givenName'),
    standardFamilyName: t('participantMerge.familyName'),
    nationalityCode: t('participantMerge.nationality'),
    participantName: t('participantMerge.name'),
    entryStatus: t('participantMerge.entryStatus'),
    entryStage: t('participantMerge.entryStage'),
    sex: t('participantMerge.sex'),
  };
  const label = labels[field] || field.replaceAll(/([a-z])([A-Z])/g, '$1 $2');
  // Entry choices are keyed by record position (/events/<i>/entries/<j>/<field>); name the event they belong to.
  const eventName = segments[0] === 'events' ? eventNameAt(Number(segments[1])) : undefined;
  return eventName ? `${eventName} — ${label}` : label;
}
function eventNameAt(index: number): string | undefined {
  if (!Number.isInteger(index)) return undefined;
  return tournamentEngine.getEvents().events?.[index]?.eventName;
}
function blockerLocation(blocker: NonNullable<MergePreview['blockers']>[number]): string {
  if (blocker.eventId) {
    const event = tournamentEngine.getEvent({ eventId: blocker.eventId }).event;
    const draw = event?.drawDefinitions?.find((d) => d.drawId === blocker.drawId);
    return [event?.eventName, draw?.drawName].filter(Boolean).join(' — ');
  }
  return fieldLabel(blocker.path);
}
function appendComparison(content: HTMLElement, selected: any[]): void {
  const comparison = document.createElement('div');
  comparison.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-block:1rem';
  const participants =
    tournamentEngine.getParticipants({
      participantFilters: { participantIds: selected.map((p) => p.participantId) },
      withDraws: true,
    }).participants ?? [];
  for (const participant of participants) {
    const card = document.createElement('section');
    card.style.cssText = 'border:1px solid var(--tmx-border-primary);padding:0.75rem;border-radius:4px';
    const name = document.createElement('strong');
    name.textContent = participant.participantName ?? participant.participantId;
    card.appendChild(name);
    const facts = [
      participant.participantId.slice(-8),
      participant.person?.birthDate,
      participant.person?.nationalityCode,
      participant.person?.sex,
    ];
    for (const fact of facts.filter(Boolean)) {
      const paragraph = document.createElement('p');
      paragraph.textContent = String(fact);
      card.appendChild(paragraph);
    }
    comparison.appendChild(card);
  }
  content.appendChild(comparison);
}
