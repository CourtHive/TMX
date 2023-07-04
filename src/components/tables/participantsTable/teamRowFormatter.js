import { removeFromTeam } from 'Pages/Tournament/Tabs/participantTab/controlBar/removeFromTeam';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTipster } from 'components/popovers/tipster';

import { LEFT, NONE, OVERLAY, RIGHT, SUB_TABLE } from 'constants/tmxConstants';
import { MODIFY_PARTICIPANT } from 'constants/mutationConstants';

export const teamRowFormatter = (row) => {
  const holderEl = document.createElement('div');

  const controlEl = document.createElement('div');
  controlEl.className = 'tableControl';
  controlEl.style.marginBottom = '1em';

  holderEl.appendChild(controlEl);

  const borderStyle = '1px solid #333';
  const tableEl = document.createElement('div');
  tableEl.style.backgroundColor = 'white'; // avoid artifact in select column
  tableEl.style.border = borderStyle;
  tableEl.style.width = '99%';

  holderEl.className = SUB_TABLE;
  holderEl.style.display = NONE;
  holderEl.style.boxSizing = 'border-box';
  holderEl.style.paddingLeft = '10px';
  holderEl.style.borderTop = borderStyle;
  holderEl.style.borderBotom = borderStyle;

  holderEl.appendChild(tableEl);

  row.getElement().appendChild(holderEl);

  const participant = row.getData();

  const getData = (individualParticipants) => {
    const genderCounts = {};
    return individualParticipants?.map((p) => {
      const sex = p.person?.sex || 'OTHER';
      if (!genderCounts[sex]) genderCounts[sex] = 0;
      genderCounts[sex] += 1;
      return { ...p, order: genderCounts[sex] };
    });
  };

  const data = getData(participant.individualParticipants);

  const ipTable = new Tabulator(tableEl, {
    placeholder: 'No individual participants',
    index: 'participantId',
    layout: 'fitColumns',
    movableRows: true,
    maxHeight: 400,
    data,
    columns: [
      {
        cellClick: (_, cell) => cell.getRow().toggleSelect(),
        titleFormatter: 'rowSelection',
        formatter: 'rowSelection',
        headerSort: false,
        responsive: false,
        hozAlign: LEFT,
        width: 5
      },
      { title: 'Order', headerSort: false, field: 'order', width: 70 },
      { title: 'Name', field: 'participantName', formatter: formatParticipant },
      { title: 'Gender', field: 'person.sex', width: 100 }
    ]
  });
  ipTable.on('scrollVertical', destroyTipster);
  ipTable.on('rowMoved', (row) => {
    const table = row.getTable();
    const tableData = table.getData().map((p, i) => ({ ...p, order: i + 1 }));
    const individualParticipantIds = tableData.map(({ participantId }) => participantId);
    const methods = [
      {
        params: { participant: { participantId: participant.participantId, individualParticipantIds } },
        method: MODIFY_PARTICIPANT
      }
    ];
    const postMutation = (result) => {
      if (result.success) {
        const rows = table.getRows();
        const individualParticipants = rows.map((r) => r.getData());
        const data = getData(individualParticipants);
        rows.forEach((r, i) => r.update(data[i]));
      }
    };
    mutationRequest({ methods, callback: postMutation });
  });

  const items = [
    {
      onClick: () => removeFromTeam({ table: ipTable, team: participant }),
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY
    },
    {
      label: 'Add players',
      intent: 'is-primary',
      location: RIGHT
    }
  ];

  controlBar({ table: ipTable, target: controlEl, items });
};
