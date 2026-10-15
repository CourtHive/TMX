import { isPipelineActive, isPipelineModified } from 'services/pipeline/pipelineFeatures';
import { openEditTournamentNameModal } from 'components/modals/editTournamentName';
import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'services/factory/engine';
import { pipelineConfig } from 'config/pipelineConfig';
import { context } from 'services/context';
import { t } from 'i18n';

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
    syncPipelineBadge();
  } else {
    context.router?.navigate('/tournaments');
  }
}

const PIPELINE_BADGE_ID = 'pipelineFeaturesBadge';

/**
 * A badge beside the tournament name while Settings → Pipeline features changes anything: results entered here
 * follow modified propagation rules, and anyone testing needs to see that without opening Settings.
 */
export function syncPipelineBadge(): void {
  const title = document.getElementById('pageTitle');
  const existing = document.getElementById(PIPELINE_BADGE_ID);
  const record = tournamentEngine.q.tournament();
  const shown = isPipelineActive(record, !!getLoginState()) && isPipelineModified(record, pipelineConfig.get());

  if (!shown || !title) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const badge = document.createElement('span');
  badge.id = PIPELINE_BADGE_ID;
  badge.className = 'tag is-warning is-light';
  badge.style.marginLeft = '8px';
  badge.textContent = t('settings.pipelineFeatures.badge');
  badge.title = t('settings.pipelineFeatures.badgeTitle');
  title.appendChild(badge);
}
