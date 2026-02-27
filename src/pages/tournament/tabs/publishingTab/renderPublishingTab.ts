/**
 * Publishing tab — comprehensive publishing management page.
 * Surfaces the full publishing capabilities of the competition factory:
 * tournament-level controls, event/draw tree, and embargo management.
 */
import { getTournamentPublishData, getPublishingTableData } from './publishingData';
import { getPublicTournamentUrl } from 'services/publishing/publicUrl';
import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { renderTournamentControls } from './tournamentControls';
import { tournamentEngine } from 'tods-competition-factory';
import { renderPublishingTable } from './publishingTable';
import { renderEmbargoSummary } from './embargoSummary';
import { renderQRimage, getQRuri } from 'services/qrFx';
import { downloadURI } from 'services/export/download';
import { context } from 'services/context';
import { t } from 'i18n';

import { TOURNAMENT_PUBLISHING } from 'constants/tmxConstants';

const STYLE_ID = 'publishing-tab-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .pub-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
      padding: 16px;
    }
    .pub-grid-full { grid-column: 1 / -1; }
    .pub-panel {
      border-radius: 8px;
      padding: 20px;
      border-left: 4px solid;
    }
    .pub-panel-yellow { border-color: var(--tmx-panel-yellow-border); background: var(--tmx-panel-yellow-bg); }
    .pub-panel-blue   { border-color: var(--tmx-panel-blue-border); background: var(--tmx-panel-blue-bg); }
    .pub-panel-orange { border-color: var(--tmx-panel-orange-border); background: var(--tmx-panel-orange-bg); }
    .pub-panel h3 {
      margin: 0 0 12px 0;
      font-size: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pub-panel h3 i { font-size: 0.9rem; }

    .pub-toggle-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--tmx-border-secondary);
    }
    .pub-toggle-row:last-child { border-bottom: none; }
    .pub-toggle-row .pub-label {
      font-weight: 500;
      min-width: 120px;
    }

    .pub-toggle {
      position: relative;
      width: 44px;
      height: 24px;
      cursor: pointer;
    }
    .pub-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .pub-toggle .pub-slider {
      position: absolute;
      inset: 0;
      background: var(--tmx-accent-red);
      border-radius: 12px;
      transition: background 0.2s;
    }
    .pub-toggle .pub-slider::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      top: 3px;
      background: var(--tmx-bg-primary);
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .pub-toggle input:checked + .pub-slider {
      background: var(--tmx-accent-blue);
    }
    .pub-toggle input:checked + .pub-slider::before {
      transform: translateX(20px);
    }

    .pub-embargo-input {
      padding: 4px 8px;
      border: 1px solid var(--tmx-border-primary);
      border-radius: 4px;
      font-size: 0.85rem;
      background: var(--tmx-bg-primary);
      color: var(--tmx-text-primary);
    }

    .pub-state-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 3px;
      color: var(--tmx-text-inverse);
    }
    .pub-state-live     { background: var(--tmx-accent-blue); }
    .pub-state-embargoed { background: var(--tmx-accent-orange); }
    .pub-state-off       { background: var(--tmx-accent-red); }

    .pub-date-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .pub-date-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.8rem;
      border: 1px solid var(--tmx-border-primary);
      background: var(--tmx-bg-primary);
      color: var(--tmx-text-primary);
      cursor: pointer;
      transition: background 0.15s;
    }
    .pub-date-chip:hover { background: var(--tmx-bg-secondary); }
    .pub-date-chip.active {
      background: var(--tmx-accent-blue);
      color: var(--tmx-text-inverse);
      border-color: var(--tmx-accent-blue);
    }

    .pub-embargo-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--tmx-border-secondary);
      font-size: 0.85rem;
    }
    .pub-embargo-row:last-child { border-bottom: none; }
    .pub-embargo-type {
      font-weight: 500;
      min-width: 140px;
    }
    .pub-embargo-time {
      color: var(--tmx-text-secondary);
    }
    .pub-embargo-remove {
      margin-left: auto;
      padding: 2px 8px;
      border: 1px solid var(--tmx-accent-red);
      border-radius: 3px;
      background: transparent;
      color: var(--tmx-accent-red);
      cursor: pointer;
      font-size: 0.75rem;
    }
    .pub-embargo-remove:hover {
      background: var(--tmx-panel-red-bg);
    }

    .pub-panel-green { border-color: var(--tmx-panel-green-border); background: var(--tmx-panel-green-bg); }
    .pub-qr-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-align: center;
    }
    .pub-qr-download {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: 1px solid var(--tmx-panel-green-border);
      border-radius: 4px;
      background: transparent;
      color: var(--tmx-accent-green);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .pub-qr-download:hover { background: var(--tmx-panel-green-bg); }
    .pub-qr-placeholder {
      color: var(--tmx-text-muted);
      font-size: 0.85rem;
    }

    .pub-login-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
      margin: 16px 16px 0;
      border-radius: 6px;
      background: var(--tmx-panel-green-bg);
      border: 1px solid var(--tmx-panel-green-border);
      color: var(--tmx-text-primary);
      font-size: 1.1rem;
      font-weight: 500;
    }
    .pub-login-banner i { color: var(--tmx-accent-green); font-size: 1.2rem; }
    .pub-grid-disabled {
      pointer-events: none;
      opacity: 0.6;
    }

    @media (max-width: 900px) {
      .pub-grid { grid-template-columns: 1fr; gap: 12px; padding: 12px; }
      .pub-grid > * { grid-column: 1 / -1 !important; }
    }
  `;
  document.head.appendChild(style);
}

function isAnythingPublished(): boolean {
  const data = getTournamentPublishData();
  if (data.participantsPublished || data.oopPublished) return true;
  return getPublishingTableData().some((row) => row.published);
}

function renderQRPanel(grid: HTMLElement): void {
  const tournamentRecord = tournamentEngine.getTournament()?.tournamentRecord;
  const tournamentId = tournamentRecord?.tournamentId;
  const tournamentName = tournamentRecord?.tournamentName || 'tournament';

  const panel = document.createElement('div');
  panel.className = 'pub-panel pub-panel-green pub-qr-panel';

  const header = document.createElement('h3');
  header.innerHTML = `<i class="fa fa-qrcode"></i> ${t('phrases.qrcode')}`;
  panel.appendChild(header);

  if (tournamentId) {
    const url = getPublicTournamentUrl(tournamentId);
    const img = renderQRimage(panel, url, 200);

    if (img && isAnythingPublished()) {
      img.style.cursor = 'pointer';
      img.title = url;
      img.addEventListener('click', () => window.open(url, '_blank'));
    }

    const dlBtn = document.createElement('button');
    dlBtn.className = 'pub-qr-download';
    dlBtn.innerHTML = `<i class="fa fa-download"></i> ${t('dl')}`;
    dlBtn.addEventListener('click', () => {
      const qruri = getQRuri({ value: url, qr_dim: 500 });
      downloadURI(qruri.src, `${tournamentName}-QR.png`);
    });
    panel.appendChild(dlBtn);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'pub-qr-placeholder';
    placeholder.textContent = t('publishing.noEvents');
    panel.appendChild(placeholder);
  }

  grid.appendChild(panel);
}

export function renderPublishingTab(): void {
  const container = document.getElementById(TOURNAMENT_PUBLISHING);
  if (!container) return;

  ensureStyles();
  removeAllChildNodes(container);

  const state = getLoginState();
  const activeProvider = context.provider || state?.provider;
  const canPublish = !!state && !!activeProvider;

  if (!canPublish) {
    const banner = document.createElement('div');
    banner.className = 'pub-login-banner';
    banner.innerHTML = `<i class="fa fa-circle-info"></i> ${t('publishing.loginRequired')}`;
    container.appendChild(banner);
  }

  const grid = document.createElement('div');
  grid.className = canPublish ? 'pub-grid' : 'pub-grid pub-grid-disabled';

  renderTournamentControls(grid);
  renderQRPanel(grid);
  renderPublishingTable(grid);
  renderEmbargoSummary(grid);

  container.appendChild(grid);
}
