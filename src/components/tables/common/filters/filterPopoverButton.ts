import { chipsFit, paintChipColor, type ChipSection } from './chipFilter';
import tippy, { Instance } from 'tippy.js';

import { LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';

const FILTER_BUTTON_ID = 'filterPopoverButton';
const IS_FILTERING = 'is-filtering';

/**
 * A popover section: a dropdown of `options`, or toggle chips (CA 2026-11-08). A section with chips shows them
 * when they fit two rows of the popover; otherwise its `options`, when it has them, as the dropdown.
 */
type FilterSection = {
  label: string;
  /** the label above chips, when the dropdown's ("All events") reads oddly there ("Event") */
  chipsLabel?: string;
  options?: any[];
  chips?: ChipSection;
  isFiltered: () => boolean;
  activeIndex?: () => number;
};

const selectableOf = (section: FilterSection) =>
  (section.options ?? []).filter((opt: any) => !opt.divider && !opt.heading);

const showsChips = (section: FilterSection) =>
  !!section.chips &&
  section.chips.options.length > 1 &&
  (!section.options?.length || chipsFit(section.chips.options.map(({ label }) => label)));

function resetSection(section: FilterSection) {
  if (section.chips) section.chips.clear();
  const resetOption = selectableOf(section)[0];
  if (!section.chips && resetOption?.onClick) resetOption.onClick();
}

let tip: Instance | undefined;

function destroyTip() {
  if (tip) {
    tip.destroy();
    tip = undefined;
  }
}

export function filterPopoverButton(
  sections: FilterSection[],
  onClearAll?: () => void,
  /** after any filter in the popover changes: another surface showing the same filters can repaint */
  onChange?: () => void,
): { item: any; updateBadge: () => void; clearAllFilters: () => void } {
  const visibleSections = sections.filter((s) => (s.chips?.options.length ?? 0) > 1 || (s.options?.length ?? 0) > 0);

  const clearAllFilters = () => {
    for (const section of visibleSections) resetSection(section);
    updateBadge();
    onClearAll?.();
    onChange?.();
  };

  const updateBadge = () => {
    const button = document.getElementById(FILTER_BUTTON_ID);
    if (!button) return;
    const badge = button.querySelector('.filter-badge') as HTMLElement;
    const anyActive = visibleSections.some((s) => s.isFiltered());
    if (badge) badge.style.display = anyActive ? '' : 'none';
    button.classList.toggle('filter-active', anyActive);
  };

  if (!visibleSections.length) {
    return { item: { hide: true }, updateBadge, clearAllFilters };
  }

  const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, '').trim() || '';

  const buildPopoverContent = () => {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 0.75em; min-width: 200px;';

    const selects: { select: HTMLSelectElement; resetOption: any; row: HTMLElement }[] = [];
    const chipRows: { section: FilterSection; row: HTMLElement; paint: () => void }[] = [];

    // Header row: Clear All + close button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;';

    const clearAll = document.createElement('button');
    clearAll.className = 'button is-small is-light font-medium';
    clearAll.textContent = t('schedule.filterClearAll');
    clearAll.onclick = (e) => {
      e.stopPropagation();
      for (const { select, resetOption, row } of selects) {
        select.value = '0';
        if (resetOption?.onClick) resetOption.onClick();
        row.classList.remove(IS_FILTERING);
      }
      for (const { section, row, paint } of chipRows) {
        section.chips?.clear();
        paint();
        row.classList.remove(IS_FILTERING);
      }
      updateBadge();
      onClearAll?.();
      onChange?.();
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

    for (const section of visibleSections) {
      if (showsChips(section)) {
        chipRows.push(chipRow(section, container));
        continue;
      }
      const selectableOptions = selectableOf(section);
      if (!selectableOptions.length) continue;

      const row = document.createElement('div');
      row.className = 'filter-popover-row';
      if (section.isFiltered()) row.classList.add(IS_FILTERING);

      const label = document.createElement('label');
      label.className = 'filter-popover-label font-medium';
      label.textContent = section.label;
      row.appendChild(label);

      const select = document.createElement('select');
      select.className = 'filter-popover-select input font-medium';

      const activeIdx = section.activeIndex ? section.activeIndex() : 0;
      selectableOptions.forEach((opt: any, index: number) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = stripHtml(opt.label || opt.text || '');
        if (index === activeIdx) option.selected = true;
        select.appendChild(option);
      });

      select.addEventListener('change', () => {
        const selectedOpt = selectableOptions[parseInt(select.value)];
        if (selectedOpt?.onClick) selectedOpt.onClick();
        row.classList.toggle(IS_FILTERING, section.isFiltered());
        updateBadge();
        onChange?.();
      });

      row.appendChild(select);
      selects.push({ select, resetOption: selectableOptions[0], row });
      container.appendChild(row);
    }

    return container;
  };

  const chipRow = (section: FilterSection, container: HTMLElement) => {
    const chips = section.chips as ChipSection;
    const row = document.createElement('div');
    row.className = 'filter-popover-row';
    if (section.isFiltered()) row.classList.add(IS_FILTERING);

    const label = document.createElement('label');
    label.className = 'filter-popover-label font-medium';
    label.textContent = section.chipsLabel ?? section.label;

    const group = document.createElement('div');
    group.className = 'filter-popover-chips';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', section.chipsLabel ?? section.label);

    const buttons = chips.options.map(({ label: text, value, color, ink }) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-popover-chip font-medium';
      chip.dataset.value = value;
      paintChipColor(chip, { color, ink });
      chip.textContent = text;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        chips.toggle(value);
        paint();
        row.classList.toggle(IS_FILTERING, section.isFiltered());
        updateBadge();
        onChange?.();
      });
      return chip;
    });
    // every chip's state, after any toggle: turning off the last chip turns them all back on
    const paint = () => {
      for (const chip of buttons) {
        const on = chips.isOn(chip.dataset.value as string);
        chip.setAttribute('aria-pressed', String(on));
        chip.dataset.on = String(on);
      }
    };
    paint();

    group.append(...buttons);
    row.append(label, group);
    container.appendChild(row);
    return { section, row, paint };
  };

  const anyActiveOnInit = visibleSections.some((s) => s.isFiltered());
  const item = {
    id: FILTER_BUTTON_ID,
    location: LEFT,
    label: `<span style="position:relative;display:inline-flex;align-items:center"><i class="fa-solid fa-filter"></i><span class="filter-badge" style="display:${anyActiveOnInit ? '' : 'none'};position:absolute;top:-4px;right:-6px;width:8px;height:8px;background:var(--tmx-status-warning);border-radius:50%;"></span></span>`,
    intent: 'is-light',
    onClick: () => {
      const button = document.getElementById(FILTER_BUTTON_ID);
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

  return { item, updateBadge, clearAllFilters };
}
