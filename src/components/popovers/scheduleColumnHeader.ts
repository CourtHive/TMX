import { renameCourt } from 'components/modals/renameCourt';
import { tipster } from 'components/popovers/tipster';
import { env } from 'settings/env';
import { t } from 'i18n';

export function setScheduleColumnHeader(e: any, column: any, courtInfo: any): void {
  const courtIdentifiers = env.schedule.court_identifiers !== false;
  const addremove = courtIdentifiers ? t('remove') : t('add');

  const options = [
    {
      option: `${addremove} ${t('settings.courtidentifiers')}`,
      onClick: toggleCourtIdentifiers,
    },
    {
      option: t('rename'),
      onClick: () => renameCourt({ column, courtInfo }),
    },
  ];

  const target = e.target;
  tipster({ options, target });

  function toggleCourtIdentifiers() {
    env.schedule.court_identifiers = !courtIdentifiers;

    const table = column.getTable();
    const columns = table.getColumns();

    // Skip the first column (control column) and update court column titles
    columns.slice(1).forEach((col: any) => {
      const def = col.getDefinition();
      if (!def.field) return;

      const headerEl = col.getElement().querySelector('.tabulator-col-title');
      if (!headerEl) return;

      if (env.schedule.court_identifiers === false) {
        headerEl.textContent = '';
      } else {
        headerEl.textContent = def.title;
      }
    });
  }
}
