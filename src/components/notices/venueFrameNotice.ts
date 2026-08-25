/**
 * "Times shown in …" — the notice that makes the venue-frame fallback visible.
 *
 * Every instant TMX renders is converted in the tournament's own zone
 * (`Mentat/planning/DECISION_VENUE_TIME_FRAME.md`). When the tournament record
 * carries no `localTimeZone`, the browser's zone stands in — and this pill says
 * so, with one click to set the real one.
 *
 * **Why it exists at all.** Refusing to render times for a zone-less tournament
 * would break the running desk for most tournaments as they stand today, so the
 * fallback has to stay. But a *silent* fallback reproduces, through a different
 * door, exactly the failure this whole change set removes: a page that is right
 * for the director standing at the venue and wrong for the one running it from
 * another zone, with nothing on screen to say which you are looking at. So the
 * one case where the page can be wrong is the one case where it says so.
 *
 * Renders `null` — not an empty box — once a venue zone is set, so the action
 * bar's flex gap does not reserve space for a notice that isn't there.
 */
import { openEditDatesModal } from 'pages/tournament/tabs/overviewTab/editDatesModal';
import { resolveVenueFrame } from 'functions/venueTimeFrame';
import { t } from 'i18n';

export function buildVenueFrameNotice(onZoneSet?: () => void): HTMLElement | null {
  const { timeZone, source } = resolveVenueFrame();
  if (source === 'tournament') return null;

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.setAttribute('data-tmx', 'venue-frame-notice');
  pill.title = t('schedule.venueFrame.noticeTitle', {
    defaultValue:
      'This tournament has no time zone set, so times are shown in this device’s zone ({{timeZone}}). Set the venue’s time zone so every operator reads the same clock.',
    timeZone,
  });
  pill.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'padding: 3px 9px',
    'font-size: 0.78rem',
    'line-height: 1.4',
    'border-radius: 6px',
    'cursor: pointer',
    'background: var(--tmx-panel-yellow-bg)',
    'border: 1px solid var(--tmx-panel-yellow-border)',
    'color: var(--tmx-text-primary)',
  ].join('; ');

  const icon = document.createElement('i');
  icon.className = 'fa fa-earth-americas';
  icon.style.color = 'var(--tmx-accent-orange)';
  pill.appendChild(icon);

  const label = document.createElement('span');
  label.textContent = t('schedule.venueFrame.notice', {
    defaultValue: 'Times in {{timeZone}} — venue zone not set',
    timeZone,
  });
  pill.appendChild(label);

  pill.addEventListener('click', () => openEditDatesModal({ onSave: () => onZoneSet?.() }));

  return pill;
}
