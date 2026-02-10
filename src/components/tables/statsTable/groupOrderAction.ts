import { orderResolutionModal } from 'components/modals/orderResolutionModal';
import { tournamentEngine } from 'tods-competition-factory';

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

export const groupOrderAction =
  ({ eventId, drawId, structureId, table }) =>
  (_: MouseEvent, cell: any): void => {
    const row = cell.getRow();
    const callback = (result) => {
      // get all rows relevant to the drawPositions in the result and update their groupOrder value
      const rows = table.getRows();
      const resultPositions = new Set(result.map((r) => r.drawPosition));
      for (const row of rows) {
        const data = row.getData();
        if (resultPositions.has(data.drawPosition)) {
          const groupOrder = result?.find((r) => r.drawPosition === data.drawPosition)?.groupOrder || data.groupOrder;
          Object.assign(data, { groupOrder });
          row.update(data);
        }
      }
    };
    const playerRow = row?.getData();
    const ties = playerRow?.ties;
    if (ties) {
      const { drawDefinition } = tournamentEngine.getEvent({ eventId, drawId, structureId });
      if (drawDefinition) {
        const structure = findStructureById(drawDefinition.structures, structureId);
        const bracket = findBracket(structure, playerRow.drawPosition);
        const tiedAssignments = filterTiedAssignments(bracket.positionAssignments, playerRow.order);
        const participantIds = tiedAssignments.map((ta) => ta.participantId);
        const participants =
          tournamentEngine
            .getParticipants({
              participantFilters: { participantIds },
            })
            ?.participants?.sort((a, b) => {
              const aPosition = tiedAssignments.find((ta) => ta.participantId === a.participantId)?.drawPosition || 0;
              const bPosition = tiedAssignments.find((ta) => ta.participantId === b.participantId)?.drawPosition || 0;
              return aPosition - bPosition;
            }) || [];

        orderResolutionModal({
          tiedAssignments,
          participants,
          structureId,
          callback,
          drawId,
        });
      }
    }
  };
