import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';

// constants
import { ADD_ADHOC_MATCHUPS } from 'constants/mutationConstants';
import { DRAWS_VIEW } from 'constants/tmxConstants';

function hasIncompleteMatchUps(structure: any): boolean {
  const matchUps = structure?.matchUps ?? [];
  return matchUps.some((m: any) => m.sides?.some((s: any) => s.participantId) && !m.winningSide);
}

export function generateSwissRound({
  structure,
  drawId,
  callback,
}: {
  structure: any;
  drawId: string;
  callback?: (params?: any) => void;
}): void {
  const structureId = structure?.structureId;

  if (hasIncompleteMatchUps(structure)) {
    tmxToast({ message: 'Complete all current round matches before generating the next round', intent: 'is-warning' });
    return;
  }

  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  const swissScaleExt = drawDefinition?.extensions?.find((e: any) => e.name === 'swissScaleName');
  const scaleName = swissScaleExt?.value;

  const result = tournamentEngine.generateSwissRound({ drawId, ...(scaleName && { scaleName }) });
  if (!result.success || !result.matchUps?.length) {
    tmxToast({ message: result.error?.message || 'Failed to generate Swiss round', intent: 'is-danger' });
    return;
  }

  const methods = [
    {
      params: { structureId, matchUps: result.matchUps, drawId },
      method: ADD_ADHOC_MATCHUPS,
    },
  ];

  const postMutation = (mutationResult: any) => {
    if (mutationResult.success && callback) {
      callback({ refresh: true });
    }
  };

  mutationRequest({ methods, callback: postMutation });
}

export function renderSwissGenerateButton({
  structure,
  drawId,
  callback,
}: {
  structure: any;
  drawId: string;
  callback?: (params?: any) => void;
}): void {
  const generatePanel = document.createElement('div');
  generatePanel.className = 'flexcol flexcenter';
  generatePanel.style.width = '100%';
  generatePanel.style.height = '300px';

  const button = document.createElement('button');
  button.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    generateSwissRound({ structure, drawId, callback });
  };
  button.className = 'button is-info';
  button.innerHTML = 'Generate round';
  generatePanel.appendChild(button);

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (drawsView) drawsView.appendChild(generatePanel);
}
