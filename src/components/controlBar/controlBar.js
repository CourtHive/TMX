import { validator } from 'components/renderers/renderValidator';
import { removeAllChildNodes } from 'services/dom/transformers';
import { dropDownButton } from '../buttons/dropDownButton';
import { selectItem } from 'components/modals/selectItem';
import { barButton } from 'components/buttons/barButton';
import { isFunction, isObject } from 'functions/typeOf';
import { toggleOverlay } from './toggleOverlay';

import { CENTER, HEADER, EMPTY_STRING, LEFT, NONE, OVERLAY, RIGHT, BUTTON_BAR, TOP } from 'constants/tmxConstants';

/* controlBar can generate a search field, buttons an dropDownButtons
 * There are three locations: standard (LEFT, CENTER, RIGHT), OVERLAY, and HEADER
 * when { hide: true } an element is not generated
 * when { visible: false } an element is generated with { display: NONE }
 * { input: true } or { placeholder: true } will create an input field
 * { search: true } will create an input field and add a search icon
 * { options: [] } will create a dropDownButton
 * { selection: { options: [], actions: [], threshold }} will create either a dropDownButton or a selection modal, depending on threshold
 */

export function controlBar(params) {
  const { table, targetClassName, items = [], onSelection } = params;
  let { target } = params;
  const buildElement = !!target;
  target = target || (targetClassName && document.getElementsByClassName(targetClassName)?.[0]);
  if (!target) return;

  let overlayCount = 0;
  let headerCount = 0;

  const elements = {};
  const inputs = {};
  let focus;

  if (buildElement) {
    removeAllChildNodes(target);
    const result = createControlElement();
    Object.assign(elements, result.elements);
    target.appendChild(result.anchor);
  }

  const locations = Object.assign(
    {},
    ...[OVERLAY, LEFT, CENTER, RIGHT, HEADER]
      .map((location) => {
        const elem = target.getElementsByClassName(`options_${location}`)?.[0];
        removeAllChildNodes(elem);
        return { [location]: elem };
      })
      .filter(Boolean),
  );

  const stateChange = toggleOverlay({ table, target });

  const onClick = (e, itemConfig) => {
    if (!isFunction(itemConfig.onClick)) return;
    e.stopPropagation();
    !itemConfig.disabled && itemConfig.onClick(e, table);
    itemConfig.stateChange && stateChange();
  };

  const defaultItem = { onClick: () => {}, location: RIGHT };
  for (const item of items) {
    const itemConfig = { ...defaultItem };
    if (isObject(item)) Object.assign(itemConfig, item);

    const location = locations[itemConfig.location];
    if (!location) {
      console.log(itemConfig.location, locations);
      continue;
    }

    if (itemConfig.location === OVERLAY) overlayCount += 1;
    if (itemConfig.location === HEADER) {
      if (isFunction(itemConfig.headerClick)) {
        const headerElement = target.getElementsByClassName('panelHeader')[0];
        if (headerElement) headerElement.onclick = itemConfig.headerClick;
      }
      headerCount += 1;
    }

    if (!itemConfig.hide && (itemConfig.input || itemConfig.placeholder || itemConfig.search)) {
      const elem = document.createElement('p');
      elem.style = 'margin-right: 1em';
      elem.className = `control ${itemConfig.search ? 'has-icons-left has-icons-right' : ''}`;
      const input = document.createElement('input');
      if (itemConfig.focus) focus = input;
      input.className = 'input font-medium';
      input.setAttribute('type', 'text');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('placeholder', item.placeholder || EMPTY_STRING);
      if (itemConfig.id) inputs[itemConfig.id] = input;
      if (itemConfig.id) input.setAttribute('id', itemConfig.id);
      if (itemConfig.onKeyDown) input.addEventListener('keydown', (e) => itemConfig.onKeyDown(e, itemConfig));
      if (itemConfig.onChange) input.addEventListener('change', (e) => itemConfig.onChange(e, itemConfig));
      if (itemConfig.onKeyUp)
        input.addEventListener('keyup', (e) => {
          if (itemConfig.clearSearch && e.key === 'Escape') {
            e.stopPropagation();
            input.value = '';
            itemConfig.clearSearch();
          }
          itemConfig.onKeyUp(e, itemConfig);
        });
      if (itemConfig.class) input.classList.add(itemConfig.class);
      if (itemConfig.visible === false) elem.style.display = NONE;
      if (itemConfig.value) input.value = itemConfig.value;
      elem.appendChild(input);

      if (itemConfig.search) {
        const span = document.createElement('span');
        span.className = 'icon is-small is-left font-medium';
        span.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>`;
        elem.appendChild(span);

        if (isFunction(itemConfig.clearSearch)) {
          const clear = document.createElement('span');
          clear.className = 'icon is-small is-right font-medium';
          // NOTE: "pointer-events: all" necessary to capture the onclick event
          clear.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: #dddada; pointer-events: all; cursor: pointer"></i>`;
          clear.onclick = (e) => {
            e.stopPropagation();
            input.value = '';
            itemConfig.clearSearch();
          };
          elem.appendChild(clear);
        }
      }

      if (item.validator) {
        const help = document.createElement('p');
        help.className = 'help font-medium';
        elem.appendChild(help);
        input.addEventListener('input', (e) => validator(item, e, input, help, item.validator));
      }

      if (itemConfig.id) {
        elements[itemConfig.id] = elem;
        elem.id = itemConfig.id;
      }

      location?.appendChild(elem);

      continue;
    }

    if (!itemConfig.hide && itemConfig.text) {
      const elem = document.createElement('div');
      elem.className = 'font-medium';
      if (itemConfig.id) {
        elements[itemConfig.id] = elem;
        elem.id = itemConfig.id;
      }
      elem.innerHTML = itemConfig.text;
      elem.onclick = (e) => onClick(e, itemConfig);
      location?.appendChild(elem);
      continue;
    }

    if (!itemConfig.id && (!itemConfig?.label || itemConfig.hide)) {
      continue;
    }
    if (itemConfig.options) {
      const elem = dropDownButton({ target: location, button: itemConfig, stateChange });
      if (itemConfig.visible === false) elem.style.display = NONE;
      if (itemConfig.id) elements[itemConfig.id] = elem;
    } else if (isObject(itemConfig.selection)) {
      const {
        selection: { options, actions },
        actionPlacement,
        threshold = 8, // default threshold value
        ...rest
      } = itemConfig;
      if (options?.length < threshold) {
        if (options.length)
          actionPlacement === TOP ? options.unshift({ divider: true }) : options.push({ divider: true });
        actions.forEach((action) => {
          const { label: text, ...attribs } = action;
          const option = { ...attribs, label: `<p style="font-weight: bold">${text}</p>` };
          actionPlacement === TOP ? options.unshift(option) : options.push(option);
        });
        const buttonConfig = { ...rest, options };
        const elem = dropDownButton({ target: location, button: buttonConfig, stateChange });
        if (buttonConfig.visible === false) elem.style.display = NONE;
        if (buttonConfig.id) elements[itemConfig.id] = elem;
      } else {
        const elem = barButton(itemConfig);
        elem.onclick = (e) => {
          e.stopPropagation();
          selectItem({ title: 'Select team', options });
        };
        if (itemConfig.id) elements[itemConfig.id] = elem;
        location?.appendChild(elem);
      }
    } else if (itemConfig.tabs) {
      const elem = document.createElement('div');
      elem.className = 'tabs is-toggle is-toggle-rounded';
      const ul = document.createElement('ul');
      elem.appendChild(ul);
      itemConfig.tabs.forEach((tab) => {
        const li = document.createElement('li');
        if (tab.active) li.classList.add('is-active');
        const a = document.createElement('a');
        li.appendChild(a);
        a.onclick = (e) => {
          ul.querySelectorAll('li').forEach((li) => li.classList.remove('is-active'));
          li.classList.add('is-active');
          if (isFunction(tab.onClick)) tab.onClick(e, itemConfig);
        };
        const span = document.createElement('span');
        span.innerHTML = tab.label;
        a.appendChild(span);
        ul.appendChild(li);
      });
      if (itemConfig.id) elements[itemConfig.id] = elem;
      location.appendChild(elem);
    } else {
      const elem = barButton(itemConfig);
      elem.onclick = (e) => onClick(e, itemConfig);
      if (itemConfig.id) elements[itemConfig.id] = elem;
      location?.appendChild(elem);
    }

    if ((!(itemConfig?.label || itemConfig.tabs) || itemConfig.hide) && elements[itemConfig.id]) {
      elements[itemConfig.id].style.display = NONE;
    }
  }

  const panelHeader = target.getElementsByClassName('panelHeader')[0];
  if (panelHeader) panelHeader.style.display = headerCount ? EMPTY_STRING : NONE;

  table?.on('rowSelectionChanged', (data, rows) => {
    isFunction(onSelection) && onSelection(rows);
    overlayCount && stateChange(rows);
  });

  stateChange();
  if (focus) setTimeout(() => focus.focus(), 200);

  return { elements, inputs };
}

function createControlElement() {
  const anchor = document.createElement('div');
  anchor.className = 'panel_container flexcol flexcenter';
  const header = document.createElement('div');
  header.className = 'panelHeader options_header';
  header.style.display = NONE;

  anchor.appendChild(header);

  const control = document.createElement('div');
  control.className = BUTTON_BAR;
  // control.style = 'flex-wrap: wrap-reverse;';

  // IMPORTANT: order of the elements cannot be changed
  const elements = {
    optionsOverlay: document.createElement('div'),
    optionsLeft: document.createElement('div'),
    optionsCenter: document.createElement('div'),
    optionsRight: document.createElement('div'),
  };
  elements.optionsOverlay.className = 'options_overlay';
  elements.optionsCenter.className = 'options_center';
  elements.optionsRight.className = 'options_right';
  elements.optionsLeft.className = 'options_left';

  for (const element of Object.values(elements)) {
    control.appendChild(element);
  }
  anchor.appendChild(control);

  return { elements, anchor, header };
}
