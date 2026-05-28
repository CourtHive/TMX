import { participantMatchUpActions } from 'components/popovers/participantMatchUpActions';
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { tournamentEngine } from 'services/factory/engine';

export const handleSideClick =
  (matchUp: any) =>
  ({ cell, event, ...params }: { cell: any; event: any; [key: string]: any }) => {
    const callback = (result: any) => {
      if (result.success) {
        const row = cell.getRow();
        const { drawId, matchUpId } = matchUp;
        const updatedMatchUp = tournamentEngine.q.matchUp({ drawId, matchUpId });
        const collectionId = row.getData().matchUp.collectionId;
        const collectionMatchUps = (updatedMatchUp?.tieMatchUps ?? []).filter((m: any) => m.collectionId === collectionId);
        const data = collectionMatchUps.map((collectionMatchUp: any) =>
          mapMatchUp({ ...collectionMatchUp, dualMatchUp: matchUp }),
        );
        const table = cell.getTable();
        table.updateData(data);
        table.redraw(true);
      }
    };
    participantMatchUpActions(event, cell, callback, params);
  };
