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
 * Renders `null` — not an empty box — once a venue zone is set or inferred from
 * venue addresses, so the action bar's flex gap does not reserve space for a
 * notice that isn't there.
 *
 * **A refused frame is a different notice, not this one.** When the factory
 * refuses the tournament's zone (venues disagree, or the record's zone is not a
 * zone), times are not shown at all and automatic calls stop. That is an error to
 * fix, so it renders red and says what is wrong; reusing the yellow "shown in
 * this device's zone" pill would claim a fallback that is not happening.
 */
import { openEditDatesModal } from 'pages/tournament/tabs/overviewTab/editDatesModal';
import { resolveVenueFrame } from 'functions/venueTimeFrame';
import { factoryConstants } from 'tods-competition-factory';
import { t } from 'i18n';

export function buildVenueFrameNotice(onZoneSet?: () => void): HTMLElement | null {
  const frame = resolveVenueFrame();
  if (frame.error) return buildFrameErrorNotice(frame.error.code, onZoneSet);
  const { timeZone, source } = frame;
  if (source !== 'browser') return null;

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.dataset.tmx = 'venue-frame-notice';
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

function buildFrameErrorNotice(code: string, onZoneSet?: () => void): HTMLElement {
  const conflicting = code === factoryConstants.errorConditionConstants.CONFLICTING_TIME_ZONES.code;
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.dataset.tmx = 'venue-frame-error';
  pill.dataset.code = code;
  pill.title = conflicting ? t('schedule.venueFrame.conflictingTitle') : t('schedule.venueFrame.invalidTitle');
  pill.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'padding: 3px 9px',
    'font-size: 0.78rem',
    'line-height: 1.4',
    'border-radius: 6px',
    'cursor: pointer',
    'background: var(--tmx-panel-red-bg)',
    'border: 1px solid var(--tmx-panel-red-border)',
    'color: var(--tmx-text-primary)',
  ].join('; ');

  const icon = document.createElement('i');
  icon.className = 'fa fa-triangle-exclamation';
  icon.style.color = 'var(--tmx-accent-red)';
  pill.appendChild(icon);

  const label = document.createElement('span');
  label.textContent = conflicting ? t('schedule.venueFrame.conflicting') : t('schedule.venueFrame.invalid');
  pill.appendChild(label);

  pill.addEventListener('click', () => openEditDatesModal({ onSave: () => onZoneSet?.() }));

  return pill;
}
