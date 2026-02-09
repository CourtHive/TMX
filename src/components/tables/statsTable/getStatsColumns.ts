import { formatParticipant } from '../common/formatters/participantFormatter';
import { percentFormatter } from '../common/formatters/percentFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { percentSorter } from '../common/sorters/percentSorter';
import { tournamentEngine } from 'tods-competition-factory';
import { orderSorter } from '../common/sorters/orderSorter';
import { headerMenu } from '../common/headerMenu';

import { groupOrderFormatter } from '../common/formatters/groupOderFormatter';
import { CENTER, LEFT } from 'constants/tmxConstants';

function findStructureById(structures: any[], structureId: string) {
  return structures?.find((s) => s.structureId === structureId);
}

function hasDrawPosition(positionAssignments: any[], drawPosition: number) {
  return positionAssignments?.some((pa) => pa.drawPosition === drawPosition);
}

function findBracket(structure: any, drawPosition: number) {
  return structure.structures?.find((s) => hasDrawPosition(s.positionAssignments, drawPosition));
}

function filterTiedAssignments(positionAssignments: any[], order: any) {
  return positionAssignments
    ?.filter((pa) => pa.extensions?.find((ex) => ex.name === 'tally')?.value?.groupOrder === order)
    .map((pa) => ({ drawPosition: pa.drawPosition, participantId: pa.participantId }));
}

export function getStatsColumns({ eventId, drawId, structureId }): any[] {
  const orderActions =
    () =>
    (_: MouseEvent, cell: any): void => {
      const row = cell.getRow();
      const playerRow = row?.getData();
      const ties = playerRow?.ties;
      if (ties) {
        const { drawDefinition } = tournamentEngine.getEvent({ eventId, drawId, structureId });
        if (drawDefinition) {
          const structure = findStructureById(drawDefinition.structures, structureId);
          const bracket = findBracket(structure, playerRow.drawPosition);
          const tiedAssignments = filterTiedAssignments(bracket.positionAssignments, playerRow.order);
          const participantIds = tiedAssignments.map((ta) => ta.participantId);
          const participants = tournamentEngine.getParticipants({
            participantFilters: { participantIds },
          })?.participants;
          console.log(tiedAssignments, participants);
        }
      }
    };
  return [
    {
      headerMenu: headerMenu({}),
      field: 'drawPosition',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
    },
    {
      formatter: 'responsiveCollapse',
      hozAlign: CENTER,
      responsive: false,
      headerSort: false,
      resizable: false,
      width: 50,
    },
    {
      formatter: formatParticipant(({ event, cell, ...params }: any) =>
        console.log('cell clicked', { event, cell, undefined, params }),
      ),
      sorter: participantSorter,
      field: 'participantName',
      responsive: false,
      resizable: false,
      maxWidth: 400,
      minWidth: 200,
      widthGrow: 2,
      title: 'Name',
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Match W/L',
      hozAlign: CENTER,
      maxWidth: 80,
      field: 'result',
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'matchUpsPct',
      title: 'Match Win%',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'setsResult',
      title: 'Sets W/L',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Set Win%',
      hozAlign: CENTER,
      field: 'setsPct',
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'gamesResult',
      title: 'Games W/L',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Game Win%',
      hozAlign: CENTER,
      field: 'gamesPct',
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'pointsResult',
      title: 'Points W/L',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Points Win%',
      field: 'pointsPct',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      field: 'averageVariation',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: 'RV',
    },
    {
      formatter: percentFormatter,
      field: 'averagePressure',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: 'PS',
    },
    {
      headerHozAlign: CENTER,
      field: 'pressureOrder',
      sorter: orderSorter,
      title: 'PS#',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: groupOrderFormatter,
      cellClick: orderActions(),
      headerHozAlign: CENTER,
      sorter: orderSorter,
      hozAlign: CENTER,
      title: 'Order',
      field: 'order', // render with icon fir ties if present
      maxWidth: 80,
    },
    {
      field: 'groupName',
      visible: false,
      title: 'Group',
    },
  ];
}
