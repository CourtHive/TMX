/**
 * Tippy-based popover for picking the draw-card visualization mode.
 * Lives alongside the cards/table toggle in the draws header.
 */

import tippy, { Instance } from 'tippy.js';

import { buildDisplayModeOptions, VizDataAvailability } from './drawCardVizGating';
import type { DrawCardDisplayMode } from './drawCardDisplayMode';

let tip: Instance | undefined;

function destroyTip(): void {
  if (tip) {
    tip.destroy();
    tip = undefined;
  }
}

export interface OpenDisplayOptionsPopoverParams {
  anchor: HTMLElement;
  current: DrawCardDisplayMode;
  drawCount: number;
  availability: VizDataAvailability;
  onChange: (mode: DrawCardDisplayMode) => void;
}

export function openDisplayOptionsPopover({
  anchor,
  current,
  drawCount,
  availability,
  onChange,
}: OpenDisplayOptionsPopoverParams): void {
  destroyTip();

  const container = document.createElement('div');
  container.style.cssText = 'padding: 0.5em; min-width: 220px;';

  const heading = document.createElement('div');
  heading.textContent = 'Card display';
  heading.style.cssText = 'font-weight: 600; margin-bottom: 0.5em; font-size: 0.9em;';
  container.appendChild(heading);

  const options = buildDisplayModeOptions({ drawCount, availability });
  for (const opt of options) {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex; align-items:center; gap:0.5em; padding:0.25em 0; cursor:pointer;';
    if (opt.disabled) {
      row.style.opacity = '0.5';
      row.style.cursor = 'not-allowed';
    }

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'drawCardDisplay';
    input.value = opt.value;
    input.checked = opt.value === current;
    input.disabled = !!opt.disabled;
    input.addEventListener('change', () => {
      if (input.checked) {
        onChange(opt.value as DrawCardDisplayMode);
        destroyTip();
      }
    });
    row.appendChild(input);

    const label = document.createElement('span');
    label.textContent = opt.label;
    row.appendChild(label);

    if (opt.disabled && opt.reason) {
      const reason = document.createElement('span');
      reason.textContent = opt.reason;
      reason.style.cssText = 'font-size:0.75em; color:#888; margin-left:auto;';
      row.appendChild(reason);
    }
    container.appendChild(row);
  }

  tip = tippy(anchor, {
    content: container,
    theme: 'light-border',
    placement: 'bottom-end',
    interactive: true,
    trigger: 'manual',
    appendTo: () => document.body,
    onClickOutside: () => destroyTip(),
  });
  tip.show();
}
