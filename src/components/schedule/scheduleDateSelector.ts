/**
 * Shared schedule date selector — the calendar button (icon + day label +
 * per-date match-count badge + chevron) that opens a tippy popover of date
 * chips.
 *
 * Extracted from schedule2Header + schedulingHeader, which had each duplicated
 * this control; the 2026-07-05 badge-staleness fix (TMX 74979836) then had to
 * be applied to BOTH — the smell that prompted this component.
 *
 * The selector OWNS its `onMutationApplied` subscription: after every applied
 * mutation it re-counts the dates and re-renders the button badge + popover.
 * That subscription MUST live here — where the button is built — not in a
 * caller's render function; the render-function subscription did not run
 * reliably (the header renders via a path that skipped it). Behaviour is
 * locked by Playwright journey 59.
 */
import { countForDate, dateButtonHtml, formatDateLabel, isPublishedForDate } from './scheduleDateSelectorLogic';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { ScheduleDate } from 'courthive-components';

export interface ScheduleDateSelectorParams {
  /** The date whose count the button badge reflects and the popover highlights. */
  selectedDate: string;
  /** Initial per-date counts (already computed by the caller). */
  dates: ScheduleDate[];
  /** Re-count the per-date totals on demand (after a mutation). */
  recomputeDates: () => ScheduleDate[];
  /** Fired when the user picks a date chip in the popover. */
  onDateChange: (date: string) => void;
}

export interface ScheduleDateSelector {
  element: HTMLElement;
  /** Unsubscribe from mutations and destroy the tippy instance. Idempotent. */
  destroy: () => void;
}

export function buildScheduleDateSelector(params: ScheduleDateSelectorParams): ScheduleDateSelector {
  const { selectedDate, dates, recomputeDates, onDateChange } = params;

  const container = document.createElement('div');

  const dateBtn = document.createElement('button');
  dateBtn.style.cssText = [
    'font-size: 0.8125rem',
    'font-weight: 600',
    'padding: 5px 12px',
    'border-radius: 6px',
    'border: 1px solid var(--tmx-border-primary)',
    'background: var(--tmx-bg-primary)',
    'color: var(--tmx-color-primary)',
    'cursor: pointer',
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
  ].join('; ');
  dateBtn.innerHTML = dateButtonHtml(
    selectedDate,
    countForDate(dates, selectedDate),
    isPublishedForDate(dates, selectedDate),
  );

  let dateTippy: TippyInstance | undefined;
  let destroyed = false;

  const buildPopover = (ds: ScheduleDate[]): HTMLElement =>
    buildDatePopover(ds, selectedDate, (date) => {
      dateTippy?.hide();
      onDateChange(date);
    });
  let datePopoverContent = buildPopover(dates);

  container.appendChild(dateBtn);

  // Attach tippy after the button is in the DOM. Guard against a destroy() that
  // races ahead of this frame (rapid header rebuild) so we never leak a tippy
  // instance whose button has already been torn down.
  requestAnimationFrame(() => {
    if (destroyed) return;
    dateTippy = tippy(dateBtn, {
      content: datePopoverContent,
      trigger: 'click',
      interactive: true,
      placement: 'bottom-start',
      theme: 'light-border',
      appendTo: () => document.body,
      onShown: () => {
        const activeChip = datePopoverContent.querySelector(`[data-date="${selectedDate}"]`) as HTMLElement;
        activeChip?.scrollIntoView({ block: 'nearest' });
      },
    });
  });

  const applyDates = (next: ScheduleDate[]): void => {
    dateBtn.innerHTML = dateButtonHtml(selectedDate, countForDate(next, selectedDate), isPublishedForDate(next, selectedDate));
    datePopoverContent = buildPopover(next);
    dateTippy?.setContent(datePopoverContent);
  };

  // Keep the badge live: recompute after every applied mutation (local via
  // mutationRequest + remote broadcasts; fires after the matchUp caches
  // invalidate). Subscribing here guarantees it runs whenever a selector exists.
  const unsubscribe = onMutationApplied(() => applyDates(recomputeDates()));

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    dateTippy?.destroy();
    dateTippy = undefined;
  };

  return { element: container, destroy };
}

// ── Date popover ──

function buildDatePopover(dates: ScheduleDate[], selectedDate: string, onSelect: (date: string) => void): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 8px; max-height: 320px; overflow-y: auto; min-width: 220px;';

  for (const d of dates) {
    const chip = document.createElement('div');
    const isSelected = d.date === selectedDate;
    chip.dataset.date = d.date;
    chip.style.cssText = [
      'display: flex',
      'justify-content: space-between',
      'align-items: center',
      'padding: 8px 10px',
      'border-radius: 8px',
      'cursor: pointer',
      'margin-bottom: 2px',
      'transition: background 0.15s',
      isSelected ? 'background: var(--tmx-fill-accent, #2563eb); color: #fff;' : '',
    ].join('; ');

    chip.addEventListener('mouseenter', () => {
      if (!isSelected) chip.style.background = 'var(--tmx-bg-secondary, rgba(128,128,128,0.08))';
    });
    chip.addEventListener('mouseleave', () => {
      if (!isSelected) chip.style.background = '';
    });

    const leftSide = document.createElement('div');
    const dateLabel = document.createElement('div');
    dateLabel.style.cssText = 'font-weight: 700; font-size: 0.75rem;';
    dateLabel.textContent = formatDateLabel(d.date);
    const statusLabel = document.createElement('div');
    statusLabel.style.cssText = `font-size: 0.6875rem; ${isSelected ? 'color: rgba(255,255,255,0.8);' : 'color: var(--tmx-muted);'}`;
    // Positive-only publish cue: append "· Published" when the date's order of
    // play is published; never a negative for unpublished dates.
    statusLabel.textContent = `${d.isActive ? 'Active' : 'Inactive'}${d.isPublished ? ' · Published' : ''}`;
    leftSide.appendChild(dateLabel);
    leftSide.appendChild(statusLabel);

    const badges = document.createElement('div');
    badges.style.cssText = 'display: flex; gap: 4px; align-items: center;';

    if (d.isPublished) {
      const dot = document.createElement('span');
      dot.title = 'Order of play published';
      dot.style.cssText =
        'width: 7px; height: 7px; border-radius: 50%; background: var(--tmx-accent-green, #22c55e); flex: 0 0 auto;';
      badges.appendChild(dot);
    }

    if (d.matchUpCount != null && d.matchUpCount > 0) {
      const b = document.createElement('span');
      b.style.cssText = `font-size: 0.625rem; padding: 1px 6px; border-radius: 10px; font-weight: 600; ${isSelected ? 'background: rgba(255,255,255,0.25); color: #fff;' : 'background: rgba(127,127,127,0.25); color: currentColor;'}`;
      b.textContent = `${d.matchUpCount}`;
      badges.appendChild(b);
    }
    if (d.issueCount && d.issueCount > 0) {
      const b = document.createElement('span');
      b.style.cssText = `font-size: 0.625rem; padding: 1px 6px; border-radius: 10px; font-weight: 600; ${isSelected ? 'background: rgba(255,200,100,0.4); color: #fff;' : 'background: rgba(245, 158, 11, 0.15); color: var(--tmx-accent-orange, #f59e0b);'}`;
      b.textContent = `${d.issueCount} !`;
      badges.appendChild(b);
    }

    chip.appendChild(leftSide);
    chip.appendChild(badges);
    chip.addEventListener('click', () => onSelect(d.date));
    container.appendChild(chip);
  }

  return container;
}
