import { participantConstants } from 'tods-competition-factory';
import { renderIndividuals } from './renderIndividuals';
import { renderGroupings } from './renderGroupings';

import { NONE } from 'constants/tmxConstants';

const { INDIVIDUAL, TEAM, GROUP } = participantConstants;

export function formatParticipantTab({ participantView = INDIVIDUAL }: { participantView?: string } = {}): void {
  const view = participantView.toUpperCase();
  const teams = [TEAM, GROUP].includes(view);

  const p = document.getElementById('individuals');
  const g = document.getElementById('participantGroupings');
  if (teams) {
    if (p) p.style.display = NONE;
    if (g) g.style.display = '';
  } else {
    if (g) g.style.display = NONE;
    if (p) p.style.display = '';
  }

  if (teams) {
    renderGroupings({ view });
  } else {
    renderIndividuals({ view });
  }
}
