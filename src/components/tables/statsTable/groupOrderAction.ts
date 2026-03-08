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
  ({ eventId, drawId, structureId, updateRows }) =>
  (_: MouseEvent, cell: any): void => {
    const row = cell.getRow();
    const table = cell.getTable();
    const callback = () => {
      if (updateRows) {
        // Re-fetch fresh data from the factory (same pattern as score entry)
        const allPositions = table.getRows().map((r) => r.getData().drawPosition);
        updateRows(allPositions);
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
