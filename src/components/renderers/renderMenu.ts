/**
 * Render menu with items, inputs, and dividers.
 * 
 * OVERVIEW:
 * Creates a hierarchical menu structure with clickable items, sections, dividers,
 * and embedded form inputs. Used for context menus, dropdowns, and list pickers.
 * Supports nested item groups with optional labels, custom styling, and disabled states.
 * 
 * PARAMETERS:
 * @param elem - Container element where menu will be rendered
 * @param menu - Array of menu section/item configuration objects
 * @param close - Optional callback to close the menu after item click
 * @returns Object with { focusElement } - Element to receive focus (if focus: true)
 * 
 * ============================================================================
 * MENU STRUCTURE
 * ============================================================================
 * 
 * MENU SECTIONS:
 * - text: String - section label (rendered as bold menu-label)
 * - items: Array - menu items within this section
 * - hide: Boolean - if true, section is not rendered
 * 
 * MENU ITEMS (within items array):
 * - heading: String - bold item text (acts as heading, not clickable)
 * - text: String - regular item text
 * - label: String - alternative to text
 * - onClick: Function(e) - callback when item is clicked
 * - disabled: Boolean - if true, item is grayed out (opacity: 0.4) and not clickable
 * - close: Boolean - if false, prevents automatic menu close after click (default: true)
 * - divider: Boolean - if true, renders horizontal divider line
 * - hide: Boolean - if true, item is not rendered
 * - style: String - custom CSS for the list item
 * - class: String - CSS class to add to anchor element
 * - color: String - custom text color
 * - fontSize: String - custom font size (default: '1em')
 * 
 * INPUT FIELDS:
 * - type: 'input' - marks this as an input field (uses renderField)
 * - field: String - field name (used as key in inputs object)
 * - focus: Boolean - if true, this input receives focus
 * - (all renderField properties apply - see renderField.ts documentation)
 * 
 * DIVIDERS:
 * - type: 'divider' - renders horizontal divider line
 * 
 * ============================================================================
 * BEHAVIOR
 * ============================================================================
 * 
 * CLICK FLOW:
 * 1. User clicks menu item
 * 2. Event propagation is stopped (e.stopPropagation)
 * 3. If close callback provided and item.close !== false:
 *    - close() is called to close menu
 *    - item.onClick() is called
 * 4. If no close callback or item.close === false:
 *    - Only item.onClick() is called
 * 
 * DISABLED ITEMS:
 * - Rendered with opacity: 0.4
 * - No onClick handler attached
 * - Visual indicator only - cannot be clicked
 * 
 * AUTO-CLOSE:
 * - By default, menu closes after clicking any item (if close callback provided)
 * - Set item.close = false to keep menu open after click
 * - Useful for: validation items, preview actions, multi-select scenarios
 * 
 * FOCUS:
 * - Input fields can have focus: true to receive initial focus
 * - Focus element returned for manual focus control if needed
 * - Uses renderField focus timing (200ms delay in renderForm)
 * 
 * ============================================================================
 * STYLING
 * ============================================================================
 * 
 * MENU STRUCTURE:
 * - Container: <aside class="menu">
 * - Section labels: <p class="menu-label"> (bold)
 * - Item lists: <ul class="menu-list">
 * - Items: <li> with <a> for clickable items
 * 
 * CUSTOMIZATION:
 * - item.heading: font-weight: bold
 * - item.disabled: opacity: 0.4
 * - item.color: custom text color
 * - item.fontSize: custom font size (default: 1em)
 * - item.style: custom CSS string for list item
 * - item.class: CSS class added to anchor element
 * 
 * ============================================================================
 * EXAMPLE USAGE
 * ============================================================================
 * 
 * @example
 * // Simple list picker menu
 * const menu = [
 *   {
 *     items: [
 *       { text: 'Option 1', onClick: () => selectOption(1) },
 *       { text: 'Option 2', onClick: () => selectOption(2) },
 *       { text: 'Option 3', onClick: () => selectOption(3) }
 *     ]
 *   }
 * ];
 * renderMenu(container, menu, closeMenu);
 * 
 * @example
 * // Menu with sections and labels
 * const menu = [
 *   {
 *     text: 'File Operations',
 *     items: [
 *       { text: 'New File', onClick: createFile },
 *       { text: 'Open File', onClick: openFile },
 *       { divider: true },
 *       { text: 'Save', onClick: saveFile },
 *       { text: 'Save As...', onClick: saveFileAs }
 *     ]
 *   },
 *   {
 *     text: 'Edit Operations',
 *     items: [
 *       { text: 'Cut', onClick: cut },
 *       { text: 'Copy', onClick: copy },
 *       { text: 'Paste', disabled: !hasClipboard, onClick: paste }
 *     ]
 *   }
 * ];
 * renderMenu(container, menu, closeMenu);
 * 
 * @example
 * // Menu with custom styling
 * const menu = [
 *   {
 *     items: [
 *       { heading: 'Recent Items', fontSize: '1.2em' },
 *       { text: 'Document 1', onClick: openDoc1 },
 *       { text: 'Document 2', onClick: openDoc2 },
 *       { divider: true },
 *       { 
 *         text: 'Delete All', 
 *         color: 'red', 
 *         onClick: deleteAll,
 *         disabled: isEmpty
 *       }
 *     ]
 *   }
 * ];
 * renderMenu(container, menu);
 * 
 * @example
 * // Menu with input field
 * const menu = [
 *   {
 *     items: [
 *       { text: 'Filter options:' }
 *     ]
 *   },
 *   {
 *     type: 'input',
 *     field: 'searchFilter',
 *     placeholder: 'Search...',
 *     focus: true
 *   },
 *   { type: 'divider' },
 *   {
 *     items: [
 *       { text: 'Option 1', onClick: select1 },
 *       { text: 'Option 2', onClick: select2 }
 *     ]
 *   }
 * ];
 * const { focusElement } = renderMenu(container, menu);
 * 
 * @example
 * // Menu with close control
 * const menu = [
 *   {
 *     items: [
 *       { 
 *         text: 'Preview', 
 *         close: false,  // Keep menu open
 *         onClick: () => showPreview()
 *       },
 *       { 
 *         text: 'Confirm', 
 *         onClick: () => confirmAction()  // Closes menu
 *       }
 *     ]
 *   }
 * ];
 * renderMenu(container, menu, closeMenu);
 */
import { renderField } from './renderField';

export function renderMenu(elem: HTMLElement, menu: any[], close?: () => void): { focusElement?: HTMLElement } {
  if (!elem) return {};

  const aside = document.createElement('aside');
  aside.classList.add('menu');
  const inputs: Record<string, HTMLElement> = {};

  const getClickAction = (item: any) => {
    if (close && item.close !== false) {
      return (e: Event) => {
        e.stopPropagation();
        close();
        item.onClick();
      };
    }
    return (e: Event) => {
      e.stopPropagation();
      item.onClick();
    };
  };

  let i = 0;
  const getIndex = () => {
    i += 1;
    return i;
  };
  const genericItem = (item: any) => item?.heading || item?.text || item?.label || `Item ${getIndex()}`;
  const createMenuItem = (subItem: any) => {
    const menuItem = document.createElement('li');
    menuItem.className = 'font-medium';
    if (subItem.style) menuItem.style.cssText = subItem.style;
    if (subItem.onClick) {
      const fontSize = subItem.fontSize || '1em';
      if (subItem.divider) {
        const item = document.createElement('hr');
        item.classList.add('dropdown-divider');
        menuItem.appendChild(item);
      } else {
        const anchor = document.createElement('a');
        const opacity = subItem.disabled ? '0.4' : '1';
        anchor.style.cssText = `text-decoration: none; opacity: ${opacity}; font-size: ${fontSize}`;
        if (subItem.class) anchor.classList.add(subItem.class);
        if (subItem.color) anchor.style.color = subItem.color;
        if (subItem.heading) anchor.style.fontWeight = 'bold';
        if (!subItem.disabled) anchor.onclick = getClickAction(subItem);
        anchor.innerHTML = genericItem(subItem);
        menuItem.appendChild(anchor);
      }
    } else {
      menuItem.innerHTML = genericItem(subItem);
      if (!subItem.disabled) menuItem.onclick = subItem.onClick;
    }
    return menuItem;
  };

  let focusElement: HTMLElement | undefined;

  for (const item of menu || []) {
    if (item.hide) continue;
    if (item.items) {
      if (item.text) {
        const menuLabel = document.createElement('p');
        menuLabel.className = 'menu-label font-medium';
        menuLabel.innerHTML = item.text;
        aside.appendChild(menuLabel);
      }

      const menuList = document.createElement('ul');
      menuList.className = 'menu-list';
      for (const subItem of item.items) {
        if (!subItem.hide) menuList.appendChild(createMenuItem(subItem));
      }
      aside.appendChild(menuList);
    } else if (item.type === 'input') {
      const { field, inputElement } = renderField(item);
      if (item.focus) focusElement = inputElement as HTMLElement;
      inputs[item.field] = inputElement as HTMLElement;
      aside.appendChild(field);
    } else if (item.type === 'divider') {
      const item = document.createElement('hr');
      item.classList.add('dropdown-divider');
      aside.appendChild(item);
    }
  }

  elem.appendChild(aside);

  return { focusElement };
}
