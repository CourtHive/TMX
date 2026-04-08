import tippy, { Instance } from 'tippy.js';

import { LEFT } from 'constants/tmxConstants';

const FILTER_BUTTON_ID = 'filterPopoverButton';

type FilterSection = {
  label: string;
  options: any[];
  isFiltered: () => boolean;
  activeIndex?: () => number;
};

let tip: Instance | undefined;

function destroyTip() {
  if (tip) {
    tip.destroy();
    tip = undefined;
  }
}

export function filterPopoverButton(
  sections: FilterSection[],
): { item: any; updateBadge: () => void; clearAllFilters: () => void } {
  const visibleSections = sections.filter((s) => s.options.length > 0);

  const clearAllFilters = () => {
    for (const section of visibleSections) {
      const resetOption = section.options.filter((opt: any) => !opt.divider && !opt.heading)[0];
      if (resetOption?.onClick) resetOption.onClick();
    }
    updateBadge();
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

    const selects: { select: HTMLSelectElement; resetOption: any }[] = [];

    // Header row: Clear All + close button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;';

    const clearAll = document.createElement('button');
    clearAll.className = 'button is-small is-light font-medium';
    clearAll.textContent = 'Clear All';
    clearAll.onclick = (e) => {
      e.stopPropagation();
      for (const { select, resetOption } of selects) {
        select.value = '0';
        if (resetOption?.onClick) resetOption.onClick();
      }
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

    for (const section of visibleSections) {
      const selectableOptions = section.options.filter((opt: any) => !opt.divider && !opt.heading);
      if (!selectableOptions.length) continue;

      const label = document.createElement('label');
      label.className = 'font-medium';
      label.style.cssText = 'display: block; font-weight: 600; margin-bottom: 0.25em; font-size: 0.85em; color: #888;';
      label.textContent = section.label;
      container.appendChild(label);

      const select = document.createElement('select');
      select.className = 'input font-medium';
      select.style.cssText = 'width: 100%; margin-bottom: 0.75em; padding: 0.35em 0.5em; font-size: 0.9em;';

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
        updateBadge();
      });

      selects.push({ select, resetOption: selectableOptions[0] });
      container.appendChild(select);
    }

    return container;
  };

  const anyActiveOnInit = visibleSections.some((s) => s.isFiltered());
  const item = {
    id: FILTER_BUTTON_ID,
    location: LEFT,
    label: `<span style="position:relative;display:inline-flex;align-items:center"><i class="fa-solid fa-filter"></i><span class="filter-badge" style="display:${anyActiveOnInit ? '' : 'none'};position:absolute;top:-4px;right:-6px;width:8px;height:8px;background:#3273dc;border-radius:50%;"></span></span>`,
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
