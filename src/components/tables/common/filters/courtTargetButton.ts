/**
 * Court target popover button for schedule control bar.
 * Shows a crosshair icon; opens a popover with checkboxes for each court.
 * Selected courts limit which courts auto-schedule targets.
 */
import { competitionEngine } from 'tods-competition-factory';
import tippy, { Instance } from 'tippy.js';
import { t } from 'i18n';

import { LEFT } from 'constants/tmxConstants';

const COURT_TARGET_ID = 'courtTargetButton';

let tip: Instance | undefined;

function destroyTip() {
  if (tip) {
    tip.destroy();
    tip = undefined;
  }
}

export function courtTargetButton(): { item: any; getSelectedCourtIds: () => string[] } {
  const selectedCourtIds = new Set<string>();

  const { venues = [] } = competitionEngine.getVenuesAndCourts() || {};
  const allCourts: { courtId: string; courtName: string; venueName: string }[] = [];
  for (const venue of venues) {
    for (const court of venue.courts || []) {
      allCourts.push({ courtId: court.courtId, courtName: court.courtName, venueName: venue.venueName });
    }
  }

  const getSelectedCourtIds = (): string[] => Array.from(selectedCourtIds);

  const updateBadge = () => {
    const button = document.getElementById(COURT_TARGET_ID);
    if (!button) return;
    const badge = button.querySelector('.target-badge') as HTMLElement;
    if (badge) badge.style.display = selectedCourtIds.size ? '' : 'none';
  };

  if (!allCourts.length) {
    return { item: { hide: true }, getSelectedCourtIds };
  }

  const buildPopoverContent = () => {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 0.75em; min-width: 220px;';

    // Header row
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;';

    const clearAll = document.createElement('button');
    clearAll.className = 'button is-small is-light font-medium';
    clearAll.textContent = t('schedule.allcourts');
    clearAll.onclick = (e) => {
      e.stopPropagation();
      selectedCourtIds.clear();
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
      updateBadge();
    };
    header.appendChild(clearAll);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'delete is-small';
    closeBtn.setAttribute('aria-label', 'close');
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      destroyTip();
    };
    header.appendChild(closeBtn);

    container.appendChild(header);

    // Group courts by venue
    const venueGroups = new Map<string, typeof allCourts>();
    for (const court of allCourts) {
      const group = venueGroups.get(court.venueName) || [];
      group.push(court);
      venueGroups.set(court.venueName, group);
    }

    for (const [venueName, courts] of venueGroups) {
      if (venueGroups.size > 1) {
        const venueLabel = document.createElement('label');
        venueLabel.className = 'font-medium';
        venueLabel.style.cssText =
          'display: block; font-weight: 600; margin-bottom: 0.25em; margin-top: 0.5em; font-size: 0.85em; color: #888;';
        venueLabel.textContent = venueName;
        container.appendChild(venueLabel);
      }

      for (const court of courts) {
        const row = document.createElement('label');
        row.style.cssText =
          'display: flex; align-items: center; gap: 8px; padding: 3px 0; cursor: pointer; font-size: 0.9em;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedCourtIds.has(court.courtId);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            selectedCourtIds.add(court.courtId);
          } else {
            selectedCourtIds.delete(court.courtId);
          }
          updateBadge();
        });

        const text = document.createElement('span');
        text.textContent = court.courtName;

        row.appendChild(checkbox);
        row.appendChild(text);
        container.appendChild(row);
      }
    }

    return container;
  };

  const item = {
    id: COURT_TARGET_ID,
    location: LEFT,
    label: `<span style="position:relative;display:inline-flex;align-items:center"><i class="fa-solid fa-crosshairs"></i><span class="target-badge" style="display:none;position:absolute;top:-4px;right:-6px;width:8px;height:8px;background:#3273dc;border-radius:50%;"></span></span>`,
    intent: 'is-light',
    onClick: () => {
      const button = document.getElementById(COURT_TARGET_ID);
      if (!button) return;

      destroyTip();

      tip = tippy(button, {
        content: buildPopoverContent(),
        theme: 'light-border',
        placement: 'bottom-start',
        interactive: true,
        trigger: 'manual',
        appendTo: () => document.body,
        onClickOutside: () => destroyTip(),
      });
      tip.show();
    },
  };

  return { item, getSelectedCourtIds };
}
