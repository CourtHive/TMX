import { findAncestor, getChildrenByClassName } from 'services/dom/parentAndChild';

export const numericEditor =
  ({ maxValue, decimals, field }) =>
  (cell, onRendered, success) => {
    const regex = decimals ? /[^0-9.]/g : /[^0-9]/g;
    const editor = document.createElement('input');
    editor.style.backgroundColor = 'lightyellow';
    editor.style.boxSizing = 'border-box';
    editor.style.textAlign = 'center';
    editor.style.padding = '3px';
    editor.style.height = '100%';
    editor.style.width = '100%';
    editor.value = cell.getValue() || '';

    onRendered(() => {
      editor.focus();
      editor.select();
    });

    function onChange() {
      let result: any = editor.value;
      if (decimals) result = parseFloat(result).toFixed(2);
      success(!isNaN(result) ? result : undefined);
    }

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    editor.addEventListener('keyup', (e: any) => {
      const allNumeric = e.target.value.replace(regex, '') || '';
      e.target.value = allNumeric > maxValue ? '' : allNumeric;
      if (e.key === 'Tab' && e.shiftKey && field) {
        const row = findAncestor(e.target, 'tabulator-row');
        const previousRow = row.previousSibling;
        const editableCells = previousRow && getChildrenByClassName(previousRow, 'tabulator-editable');
        if (editableCells) {
          for (cell of editableCells) {
            if (cell.getAttribute('tabulator-field') === field) cell.focus();
          }
        }
      } else if ((e.key === 'Enter' || e.key === 'Tab') && field) {
        const row = findAncestor(e.target, 'tabulator-row');
        const nextRow = row.nextSibling;
        const editableCells = nextRow && getChildrenByClassName(nextRow, 'tabulator-editable');
        if (editableCells) {
          for (cell of editableCells) {
            if (cell.getAttribute('tabulator-field') === field) cell.focus();
          }
        }
      }
    });

    editor.addEventListener('blur', onChange);

    return editor;
  };
