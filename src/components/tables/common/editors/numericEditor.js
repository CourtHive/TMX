export const numericEditor =
  (maxValue, regex = /[^0-9]/g) =>
  (cell, onRendered, success) => {
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
      success(editor.value);
    }

    editor.addEventListener('keyup', (e) => {
      // const allNumeric = parseInt(e.target.value.replace(/[^0-9]/g, '') || 0) || '';
      const allNumeric = parseInt(e.target.value.replace(regex, '') || 0) || '';
      e.target.value = allNumeric > maxValue ? '' : allNumeric;
    });
    editor.addEventListener('change', onChange);
    editor.addEventListener('blur', onChange);

    return editor;
  };
