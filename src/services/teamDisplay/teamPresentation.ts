import { cModal, renderTeamPresentationEditor } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { extensionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

// constants and types
import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';

const EDITOR_KEYS = [
  'title',
  'scope',
  'allTeams',
  'reset',
  'inherit',
  'theme',
  'color',
  'colorValue',
  'palette',
  'paletteValue',
  'choosePalette',
  'missingTeam',
  'missingColor',
  'invalid',
];
// Role captions are the same strings the team palette editor shows; one translation serves both.
const ROLE_KEYS = ['team.surface', 'team.text', 'team.accent', 'score.surface', 'score.text'];

export function teamPresentationLabels(): Record<string, string> {
  return Object.fromEntries([
    ...EDITOR_KEYS.map((key) => [key, t(`teamPresentation.${key}`)]),
    ...ROLE_KEYS.map((key) => [key, t(`pages.participants.grouping.${key}`)]),
  ]);
}

/** The DISPLAY extension carries more than team presentation; replace only that key. */
export function displayExtensionWithTeamPresentation(existing: unknown, teamPresentation: unknown) {
  const value = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  return { name: extensionConstants.DISPLAY, value: { ...value, teamPresentation } };
}

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
  const editor = renderTeamPresentationEditor(content, current.teamPresentation, teams, teamPresentationLabels());
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
                params: { extension: displayExtensionWithTeamPresentation(existing, teamPresentation) },
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
