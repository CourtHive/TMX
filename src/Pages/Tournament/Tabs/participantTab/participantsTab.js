import { participantConstants } from 'tods-competition-factory';
import { renderIndividuals } from './renderIndividuals';
import { renderGroupings } from './renderGroupings';

import { NONE } from 'constants/tmxConstants';

const { INDIVIDUAL, TEAM, GROUP } = participantConstants;

export function renderParticipantTab({ participantView = INDIVIDUAL } = {}) {
  const view = participantView.toUpperCase();
  const teams = [TEAM, GROUP].includes(view);

  const p = document.getElementById('individuals');
  const g = document.getElementById('participantGroupings');
  if (teams) {
    p.style.display = NONE;
    g.style.display = '';
  } else {
    g.style.display = NONE;
    p.style.display = '';
  }

  if (teams) {
    renderGroupings({ view });
  } else {
    renderIndividuals({ view });
  }
}
