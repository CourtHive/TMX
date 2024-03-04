import { context } from 'services/context';

const CHECKBOX = 'fa-check-square';

export const headerMenu = (displayTitles) => (_, column) => {
  const table = column.getTable();
  const columns = table.getColumns();
  const menu = [];

  for (const column of columns) {
    const def = column.getDefinition();
    if (def.title) {
      const icon = document.createElement('i');
      icon.classList.add('fas');
      icon.classList.add(column.isVisible() ? CHECKBOX : 'fa-square');

      const label = document.createElement('span');
      const title = document.createElement('span');

      const displayTitle = displayTitles?.[def.field] || def.displayTitle || def.title;
      title.textContent = ' ' + displayTitle;

      label.appendChild(icon);
      label.appendChild(title);

      //create menu item
      menu.push({
        label: label,
        action: function (e) {
          //prevent menu closing
          e.stopPropagation();

          //toggle current column visibility
          column.toggle();
          context.columns[column.getField()] = column.isVisible();
          table.redraw();

          //change menu item icon
          if (column.isVisible()) {
            icon.classList.remove('fa-square');
            icon.classList.add(CHECKBOX);
          } else {
            icon.classList.remove(CHECKBOX);
            icon.classList.add('fa-square');
          }
        },
      });
    }
  }

  return menu;
};
