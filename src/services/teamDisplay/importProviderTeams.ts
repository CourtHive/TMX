import { cModal, normalizeTeamPalette } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { providerTeamPicker } from './providerTeamPicker';
import { baseApi } from 'services/apis/baseApi';

// constants and types
import { ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { t } from 'i18n';

const PROVIDER_ERROR_KEY = 'teamPresentation.providerError';

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
    if (previous)
      methods.push({
        method: MODIFY_PARTICIPANT,
        params: {
          participant: {
            participantId: participant.participantId,
            teamColors: participant.teamColors ?? {},
          },
        },
      });
    else added.push(participant);
  }
  if (added.length) methods.push({ method: ADD_PARTICIPANTS, params: { participants: added } });
  return methods;
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
  let saving = false;
  let closed = false;
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
        onClick: async () => {
          if (saving) return;
          const ids = [...picker.selected(), ...input.value.split(/[\s,]+/).filter(Boolean)];
          if (!ids.length) return;
          saving = true;
          try {
            const methods = await providerTeamMethods(ids);
            if (closed) return undefined;
            mutationRequest({
              methods,
              callback: (result: any) => {
                saving = false;
                if (result.success) {
                  modal.close();
                  refresh();
                } else error.textContent = result.error ?? t(PROVIDER_ERROR_KEY);
              },
            });
          } catch (cause) {
            saving = false;
            error.textContent = cause instanceof Error ? cause.message : t(PROVIDER_ERROR_KEY);
          }
        },
      },
    ],
  });
}
