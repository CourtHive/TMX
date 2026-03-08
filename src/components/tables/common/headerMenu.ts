import { context } from 'services/context';

const ICON_ON = 'fa-toggle-on';
const ICON_OFF = 'fa-toggle-off';

export const headerMenu = (displayTitles) => (_, column) => {
  const table = column.getTable();
  const columns = table.getColumns();
  const menu: Array<{ label: HTMLSpanElement; action: (e: any) => void }> = [];

  // Close button header row
  const closeLabel = document.createElement('span');
  closeLabel.style.display = 'flex';
  closeLabel.style.alignItems = 'center';
  closeLabel.style.justifyContent = 'flex-end';
  closeLabel.style.width = '100%';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'delete is-small';
  closeBtn.setAttribute('aria-label', 'close');
  closeLabel.appendChild(closeBtn);

  menu.push({
    label: closeLabel,
    action: () => {},
  });

  for (const column of columns) {
    const def = column.getDefinition();
    if (def.title) {
      const visible = column.isVisible();

      const icon = document.createElement('i');
      icon.classList.add('fas');
      icon.classList.add(visible ? ICON_ON : ICON_OFF);
      icon.style.color = visible ? 'var(--tmx-accent-blue)' : 'var(--tmx-text-muted)';
      icon.style.marginRight = '8px';
      icon.style.fontSize = '14px';
      icon.style.width = '20px';
      icon.style.textAlign = 'center';

      const label = document.createElement('span');
      label.style.display = 'flex';
      label.style.alignItems = 'center';

      const title = document.createElement('span');
      const displayTitle = displayTitles?.[def.field] || def.displayTitle || def.title;
      title.textContent = displayTitle;

      label.appendChild(icon);
      label.appendChild(title);

      menu.push({
        label: label,
        action: function (e) {
          e.stopPropagation();

          column.toggle();
          context.columns[column.getField()] = column.isVisible();
          table.redraw();

          if (column.isVisible()) {
            icon.classList.remove(ICON_OFF);
            icon.classList.add(ICON_ON);
            icon.style.color = 'var(--tmx-accent-blue)';
          } else {
            icon.classList.remove(ICON_ON);
            icon.classList.add(ICON_OFF);
            icon.style.color = 'var(--tmx-text-muted)';
          }
        },
      });
    }
  }

  return menu;
};
