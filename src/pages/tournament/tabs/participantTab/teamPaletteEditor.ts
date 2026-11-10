import { normalizeTeamPalette } from 'courthive-components';
import { randomId } from 'functions/randomId';
import { t } from 'i18n';

// constants and types
import type { TeamColors, TeamPaletteColor } from 'courthive-components';

/** Own the full CODES palette; changing display selections never drops unselected entries. */
export function renderTeamPaletteEditor(target: HTMLElement, initial: unknown) {
  const normalized = normalizeTeamPalette(initial);
  const emptyObject =
    initial != null &&
    typeof initial === 'object' &&
    Object.prototype.toString.call(initial) === '[object Object]' &&
    !Object.keys(initial).length;
  const hasInitial = initial != null && !emptyObject;
  let unreadable = hasInitial && !normalized;
  let palette: TeamPaletteColor[] = normalized?.palette ?? [];
  let primary = normalized?.display.primary ?? '';
  let secondary = normalized?.display.secondary ?? '';
  const root = document.createElement('section');
  root.className = 'team-palette-editor';
  const title = document.createElement('h3');
  title.textContent = t('pages.participants.grouping.palette');
  const rows = document.createElement('div');
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  const first = select('primaryColor', (value) => {
    primary = value;
  });
  const second = select('secondaryColor', (value) => {
    secondary = value;
  });
  const add = button('addColor', () => {
    if (palette.length >= 32) return;
    palette.push({ colorId: randomId(), value: '' });
    unreadable = false;
    render();
  });
  const clear = button('clearPalette', () => {
    palette = [];
    primary = secondary = '';
    unreadable = false;
    render();
  });
  root.append(title, rows, first.wrapper, second.wrapper, add, clear, error);
  target.appendChild(root);
  render();

  function button(key: string, callback: () => void) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'button';
    element.textContent = t(`pages.participants.grouping.${key}`);
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      callback();
    });
    return element;
  }
  function select(key: string, change: (value: string) => void) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field font-medium';
    const label = document.createElement('label');
    label.textContent = t(`pages.participants.grouping.${key}`);
    const input = document.createElement('select');
    input.className = 'input font-medium';
    input.id = `team-palette-${randomId()}`;
    label.htmlFor = input.id;
    input.addEventListener('change', () => change(input.value));
    wrapper.append(label, input);
    return { wrapper, input };
  }
  function choices() {
    for (const [input, selected] of [
      [first.input, primary],
      [second.input, secondary],
    ] as const) {
      input.replaceChildren();
      const empty = new Option(t('pages.participants.grouping.chooseColor'), '');
      input.appendChild(empty);
      for (const [index, entry] of palette.entries()) {
        input.appendChild(
          new Option(entry.name || `${t('pages.participants.grouping.color')} ${index + 1}`, entry.colorId),
        );
      }
      if (selected && !palette.some((entry) => entry.colorId === selected)) {
        const missing = new Option(t('pages.participants.grouping.missingColor'), selected);
        missing.disabled = true;
        input.appendChild(missing);
      }
      input.value = selected;
    }
  }
  function field(row: HTMLElement, entry: TeamPaletteColor, key: 'name' | 'value' | 'group') {
    const label = document.createElement('label');
    label.className = 'field font-medium';
    label.style.display = 'block';
    label.textContent = t(`pages.participants.grouping.color${key}`);
    const input = document.createElement('input');
    input.className = 'input';
    input.value = entry[key] ?? '';
    input.placeholder = key === 'value' ? '#RRGGBB' : t(`pages.participants.grouping.color${key}`);
    input.maxLength = key === 'value' ? 7 : 100;
    input.addEventListener('input', () => {
      if (key === 'value') entry.value = input.value;
      else if (input.value.trim()) entry[key] = input.value;
      else delete entry[key];
      choices();
    });
    label.appendChild(input);
    row.appendChild(label);
  }
  function render() {
    rows.replaceChildren();
    for (const [index, entry] of palette.entries()) {
      const row = document.createElement('div');
      row.className = 'team-palette-row';
      row.style.marginBlockEnd = '1rem';
      row.style.borderBottom = '1px solid var(--tmx-border-primary)';
      row.dataset.colorId = entry.colorId;
      for (const key of ['name', 'value', 'group'] as const) field(row, entry, key);
      const move = button('moveColorUp', () => {
        [palette[index - 1], palette[index]] = [palette[index], palette[index - 1]];
        render();
      });
      move.disabled = index === 0;
      row.append(
        move,
        button('removeColor', () => {
          palette.splice(index, 1);
          render();
        }),
      );
      rows.appendChild(row);
    }
    choices();
    add.disabled = palette.length >= 32;
    error.textContent = unreadable ? t('pages.participants.grouping.invalidPalette') : '';
  }
  function read(): TeamColors | Record<string, never> | undefined {
    if (!unreadable && !palette.length) return {};
    const value = normalizeTeamPalette({ palette, display: { primary, ...(secondary && { secondary }) } });
    error.textContent = value ? '' : t('pages.participants.grouping.invalidPalette');
    return unreadable ? undefined : value;
  }
  return { read };
}
