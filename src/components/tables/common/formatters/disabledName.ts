import { t } from 'i18n';

/**
 * A name cell that carries an "Not in use" tag when `isDisabled(rowData)` holds. Built from
 * text nodes, so a court or venue name is never read as HTML.
 */
export function disabledNameFormatter(isDisabled: (rowData: any) => boolean) {
  return (cell: any): HTMLElement => {
    const wrap = document.createElement('span');
    wrap.textContent = cell.getValue() ?? '';
    if (isDisabled(cell.getRow().getData())) {
      const tag = document.createElement('span');
      tag.textContent = t('courtUse.disabled');
      tag.style.cssText =
        'margin-left: 0.5rem; padding: 0 0.375rem; font-size: 0.6875rem; border-radius: 4px; ' +
        'color: var(--chc-text-muted); border: 1px solid var(--chc-text-muted);';
      wrap.appendChild(tag);
    }
    return wrap;
  };
}
