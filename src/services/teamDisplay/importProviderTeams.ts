import { cModal, normalizeTeamPalette } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { providerTeamPicker } from './providerTeamPicker';
import { baseApi } from 'services/apis/baseApi';

// constants and types
import { ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { t } from 'i18n';

const PROVIDER_ERROR_KEY = 'teamPresentation.providerError';
const PROVIDER_TEAM_FIELDS = ['participantId', 'participantName', 'participantType', 'participantRole', 'teamColors'];

/** Only identity and default branding come from a provider; anything else it sends never reaches the record. */
function providerTeam(participant: any) {
  return Object.fromEntries(
    PROVIDER_TEAM_FIELDS.filter((field) => participant[field] !== undefined).map((field) => [
      field,
      participant[field],
    ]),
  );
}

/** Fetch every selected provider before dispatching mutations; a failed fetch never clears defaults. */
export async function providerTeamMethods(providerIds: string[]) {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  if (!tournamentId) throw new Error(t('teamPresentation.tournamentChanged'));
  const participants: any[] = [];
  for (const providerId of new Set(providerIds)) {
    const response = await baseApi.get(`/provider/${encodeURIComponent(providerId)}/team-display`);
    const participant = response?.data?.participant;
    if (participant?.participantId !== providerId || participant?.participantType !== 'TEAM')
      throw new Error(t(PROVIDER_ERROR_KEY));
    if (participant.teamColors !== undefined && !normalizeTeamPalette(participant.teamColors))
      throw new Error(t(PROVIDER_ERROR_KEY));
    participants.push(participant);
  }
  if (tournamentEngine.getTournament()?.tournamentRecord?.tournamentId !== tournamentId)
    throw new Error(t('teamPresentation.tournamentChanged'));
  const existing = new Map(
    (tournamentEngine.getParticipants().participants ?? []).map((p: any) => [p.participantId, p]),
  );
  const methods: any[] = [];
  const added: any[] = [];
  for (const participant of participants) {
    const previous: any = existing.get(participant.participantId);
    if (previous && previous.participantType !== 'TEAM') throw new Error(t(PROVIDER_ERROR_KEY));
    if (!previous) added.push(providerTeam(participant));
    // A provider with no palette says nothing about colors: never clear a team's local palette on refresh.
    else if (participant.teamColors !== undefined)
      methods.push({
        method: MODIFY_PARTICIPANT,
        params: { participant: { participantId: participant.participantId, teamColors: participant.teamColors } },
      });
  }
  if (added.length) methods.push({ method: ADD_PARTICIPANTS, params: { participants: added } });
  return methods;
}

/**
 * One in-flight save at a time. The guard is released on every outcome: the mutation callback (ack, rejection,
 * server timeout, offline refusal all settle through it), a thrown fetch or request, a closed modal, or nothing to do.
 */
export function providerTeamSaver({
  isClosed,
  onSuccess,
  onError,
}: {
  isClosed: () => boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  let saving = false;
  return async (ids: string[]): Promise<void> => {
    if (saving || !ids.length) return;
    saving = true;
    try {
      const methods = await providerTeamMethods(ids);
      if (isClosed() || !methods.length) {
        saving = false;
        if (!isClosed()) onSuccess();
        return;
      }
      await mutationRequest({
        methods,
        callback: (result: any) => {
          saving = false;
          if (result?.success) onSuccess();
          else onError(result?.error?.message ?? t(PROVIDER_ERROR_KEY));
        },
      });
    } catch (cause) {
      saving = false;
      onError(cause instanceof Error ? cause.message : t(PROVIDER_ERROR_KEY));
    }
  };
}

export function importProviderTeams(refresh: () => void): void {
  const content = document.createElement('div');
  const picker = providerTeamPicker(content);
  const label = document.createElement('label');
  label.textContent = t('teamPresentation.providerIds');
  const input = document.createElement('textarea');
  input.rows = 6;
  label.appendChild(input);
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  content.append(label, error);
  let closed = false;
  const save = providerTeamSaver({
    isClosed: () => closed,
    onSuccess: () => {
      modal.close();
      refresh();
    },
    onError: (message) => {
      error.textContent = message;
    },
  });
  const modal = cModal.open({
    title: t('teamPresentation.importTeams'),
    content,
    onClose: () => {
      closed = true;
      picker.destroy();
    },
    buttons: [
      { label: t('common.cancel'), close: true },
      {
        label: t('common.save'),
        close: false,
        onClick: () => save([...picker.selected(), ...input.value.split(/[\s,]+/).filter(Boolean)]),
      },
    ],
  });
}
