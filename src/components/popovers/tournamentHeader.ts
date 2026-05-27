import { openEditTournamentNameModal } from 'components/modals/editTournamentName';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';

export function tournamentHeader(): void {
  const tournamentInfo = tournamentEngine.q.tournamentInfo();
  const offline = tournamentInfo?.timeItemValues?.TMX?.offline;
  if (offline) {
    const dnav = document.getElementById('dnav');
    if (dnav) dnav.style.backgroundColor = 'var(--tmx-bg-highlight)';
  }

  // Navigation back to /tournaments is owned by `initProviderSwitcher`'s
  // consolidated click handler — setting onclick here would race with it.
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement && tournamentInfo?.tournamentName) {
    removeAllChildNodes(tournamentElement);
    tournamentElement.innerHTML = `<div class='tmx-title' style='cursor:pointer'>${tournamentInfo?.tournamentName}</div>`;
    const titleDiv = tournamentElement.querySelector('.tmx-title');
    if (titleDiv) titleDiv.addEventListener('click', () => openEditTournamentNameModal());
  } else {
    context.router?.navigate('/tournaments');
  }
}
