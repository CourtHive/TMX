import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import { overviewControl } from './overviewControl';
import { env } from 'settings/env';

import { TOURNAMENT_OVERVIEW } from 'constants/tmxConstants';

export function renderOverview({ tournamentName }) {
  const element = document.getElementById(TOURNAMENT_OVERVIEW);
  element.style.minHeight = `${window.innerHeight * 0.9}px`;
  removeAllChildNodes(element);

  const header = document.createElement('div');
  header.style.fontWeight = 'bold';
  header.className = 'block';
  header.innerHTML = env.device.isMobile ? tournamentName ?? 'Tournament overview' : 'Tournament overview';
  element.appendChild(header);

  const controlAnchor = document.createElement('div');
  element.appendChild(controlAnchor);

  const notes = tournamentEngine.getTournament().tournamentRecord?.notes;
  const notesView = document.createElement('div');
  notesView.className = 'ql-container ql-snow';
  notesView.style.border = 'none';
  notesView.innerHTML = notes ?? '';
  notesView.id = 'notes';
  element.appendChild(notesView);
  overviewControl({ controlAnchor });
}
