import { groupOrderFormatter } from '../common/formatters/groupOderFormatter';
import { percentFormatter } from '../common/formatters/percentFormatter';
import { groupOrderAction } from '../statsTable/groupOrderAction';
import { bracketScoreFormatter } from './bracketScoreFormatter';
import { applyColumnVisibility, saveColumnVisibility } from '../common/columnIsVisible';
import { context } from 'services/context';
import tippy from 'tippy.js';

import { CENTER, LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';

type GroupParticipant = {
  drawPosition: number;
  participantName: string;
  participantId: string;
};

type GetBracketColumnsParams = {
  participants: GroupParticipant[];
  scoreClick: (_: any, cell: any) => void;
  participantClick: (_: any, cell: any) => void;
  updateRows: (drawPositions: number[]) => void;
  eventId: string;
  drawId: string;
  structureId: string;
};

const STATS_FIELDS = new Set(['result', 'matchUpsPct', 'setsPct', 'order']);
const CHECKBOX = 'fa-check-square';

// Header menu that only shows stats columns as toggleable options
const statsHeaderMenu = () => (_: any, column: any) => {
  const table = column.getTable();
  const columns = table.getColumns();
  const menu: Array<{ label: HTMLSpanElement; action: (e: any) => void }> = [];

  for (const col of columns) {
    const def = col.getDefinition();
    if (!def.title || !STATS_FIELDS.has(def.field)) continue;

    const icon = document.createElement('i');
    icon.classList.add('fas', col.isVisible() ? CHECKBOX : 'fa-square');

    const label = document.createElement('span');
    const title = document.createElement('span');
    title.textContent = ' ' + (def.displayTitle || def.title);

    label.appendChild(icon);
    label.appendChild(title);

    menu.push({
      label,
      action(e) {
        e.stopPropagation();
        col.toggle();
        context.columns[col.getField()] = col.isVisible();
        saveColumnVisibility();
        table.redraw();
        if (col.isVisible()) {
          icon.classList.remove('fa-square');
          icon.classList.add(CHECKBOX);
        } else {
          icon.classList.remove(CHECKBOX);
          icon.classList.add('fa-square');
        }
      },
    });
  }

  return menu;
};

// Attach a tippy tooltip on mouseenter for header elements with truncated text
function attachHeaderTooltip(column: any, fullName: string) {
  const colEl = column.getElement();
  // The text truncation happens on the inner .tabulator-col-title element
  const titleEl = colEl?.querySelector('.tabulator-col-title');
  if (!titleEl || !fullName) return;

  let tip: any;
  const onMouseEnter = () => {
    if (titleEl.scrollWidth > titleEl.clientWidth) {
      tip = tippy(titleEl, {
        content: fullName,
        trigger: 'manual',
        placement: 'top',
      });
      tip.show();
    }
  };
  const onMouseLeave = () => {
    if (tip) {
      tip.destroy();
      tip = undefined;
    }
  };
  titleEl.addEventListener('mouseenter', onMouseEnter);
  titleEl.addEventListener('mouseleave', onMouseLeave);
}

export function getBracketColumns({
  participants,
  scoreClick,
  participantClick,
  updateRows,
  eventId,
  drawId,
  structureId,
}: GetBracketColumnsParams): any[] {
  // Build a name lookup for headerTooltip attachment
  const nameByField: Record<string, string> = {};
  for (const p of participants) {
    nameByField[`opponent_${p.participantId}`] = p.participantName;
  }

  const columns: any[] = [
    {
      headerMenu: statsHeaderMenu(),
      field: 'drawPosition',
      title: '#',
      headerSort: false,
      hozAlign: CENTER,
      width: 45,
    },
    {
      field: 'participantName',
      title: t('tables.bracket.participant'),
      cellClick: participantClick,
      headerSort: false,
      hozAlign: LEFT,
      // Fixed width (rather than min/max + widthGrow) so every group's
      // table renders at the same column-row width — `fitDataTable` would
      // otherwise size each group to its own widest name and produce a
      // jagged stack of tables.
      width: 180,
    },
  ];

  // One column per draw position in the group, titled by participant name
  for (const p of participants) {
    columns.push({
      field: `opponent_${p.participantId}`,
      title: p.participantName || String(p.drawPosition),
      formatter: bracketScoreFormatter,
      cellClick: scoreClick,
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: false,
      width: 130,
    });
  }

  // Stats suffix columns — fixed widths for the same reason as above.
  columns.push(
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.bracket.winLoss'),
      field: 'result',
      hozAlign: CENTER,
      width: 60,
      headerSort: false,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.bracket.winPct'),
      field: 'matchUpsPct',
      hozAlign: CENTER,
      width: 60,
      headerSort: false,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.bracket.setPct'),
      field: 'setsPct',
      hozAlign: CENTER,
      width: 60,
      headerSort: false,
    },
    {
      cellClick: groupOrderAction({ eventId, drawId, structureId, updateRows }),
      formatter: groupOrderFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: t('tables.bracket.pos'),
      field: 'order',
      hozAlign: CENTER,
      width: 60,
      headerSort: false,
    },
  );

  return applyColumnVisibility(columns);
}

export { attachHeaderTooltip };
