/**
 * Time-zone-not-set warning for the publishing tab.
 *
 * Tournament start/end dates are calendar days and render correctly regardless
 * of zone, but published match *times* (order of play) are shown to the public
 * relative to a time zone. When a tournament has no `localTimeZone` set, those
 * times are ambiguous for viewers elsewhere — so flag it here, on the page where
 * the director publishes, with a one-click path to set it. Renders nothing once
 * a zone is set.
 */
import { openEditDatesModal } from 'pages/tournament/tabs/overviewTab/editDatesModal';
import { tournamentEngine } from 'services/factory/engine';
import { renderPublishingTab } from './renderPublishingTab';
import { t } from 'i18n';

export function renderTimezoneWarning(grid: HTMLElement): void {
  const localTimeZone = tournamentEngine.q.tournament()?.localTimeZone;
  if (localTimeZone) return;

  const panel = document.createElement('div');
  panel.className = 'pub-panel pub-panel-yellow pub-grid-full';

  const header = document.createElement('h3');
  header.innerHTML = `<i class="fa fa-triangle-exclamation"></i> ${t('publishing.timeZoneNotSetTitle', {
    defaultValue: 'Time zone not set',
  })}`;
  panel.appendChild(header);

  const body = document.createElement('div');
  body.style.cssText = 'font-size:0.85rem; color:var(--tmx-text-muted); margin:6px 0 12px;';
  body.textContent = t('publishing.timeZoneNotSetBody', {
    defaultValue:
      'This tournament has no time zone set. Published match times may be ambiguous for viewers in other time zones. Set a time zone before publishing.',
  });
  panel.appendChild(body);

  const btn = document.createElement('button');
  btn.className = 'pub-tz-set-btn';
  btn.innerHTML = `<i class="fa fa-earth-americas"></i> ${t('publishing.setTimeZone', {
    defaultValue: 'Set time zone',
  })}`;
  btn.addEventListener('click', () => openEditDatesModal({ onSave: () => renderPublishingTab() }));
  panel.appendChild(btn);

  grid.appendChild(panel);
}
