import { cModal, renderTeamPresentationEditor } from 'courthive-components';
import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { extensionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

export function tournamentTeamPresentation() {
  return tournamentEngine
    .getTournament()
    ?.tournamentRecord?.extensions?.find((entry: any) => entry.name === extensionConstants.DISPLAY)?.value
    ?.teamPresentation;
}

export function editTournamentTeamPresentation(): void {
  const current =
    tournamentEngine
      .getTournament()
      ?.tournamentRecord?.extensions?.find((entry: any) => entry.name === extensionConstants.DISPLAY)?.value ?? {};
  const content = document.createElement('div');
  const teams =
    tournamentEngine.getParticipants({ participantFilters: { participantTypes: ['TEAM'] } }).participants ?? [];
  const keys = ['title', 'scope', 'allTeams', 'reset', 'inherit', 'theme', 'color', 'reference', 'invalid'];
  const labels = Object.fromEntries(keys.map((key) => [key, t(`teamPresentation.${key}`)]));
  const editor = renderTeamPresentationEditor(content, current.teamPresentation, teams, labels);
  const modal = cModal.open({
    title: t('teamPresentation.title'),
    content,
    buttons: [
      { label: t('common.cancel'), close: true },
      {
        label: t('common.save'),
        close: false,
        onClick: () => {
          const teamPresentation = editor.read();
          if (!teamPresentation) return;
          // Re-read on Save so an unrelated display edit is not overwritten by this draft.
          const existing =
            tournamentEngine
              .getTournament()
              ?.tournamentRecord?.extensions?.find((entry: any) => entry.name === extensionConstants.DISPLAY)?.value ??
            {};
          mutationRequest({
            methods: [
              {
                method: ADD_TOURNAMENT_EXTENSION,
                params: { extension: { name: extensionConstants.DISPLAY, value: { ...existing, teamPresentation } } },
              },
            ],
            callback: (result: any) => {
              if (result.success) modal.close();
            },
          });
        },
      },
    ],
  });
}
