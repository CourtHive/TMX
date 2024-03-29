import { participantMatchUpActions } from 'components/popovers/participantMatchUpActions';
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { tournamentEngine } from 'tods-competition-factory';

export const handleSideClick =
  (matchUp) =>
  ({ cell, event, ...params }) => {
    const callback = (result) => {
      if (result.success) {
        const row = cell.getRow();
        const { drawId, matchUpId } = matchUp;
        const updatedMatchUp = tournamentEngine.findMatchUp({ drawId, matchUpId }).matchUp;
        const collectionId = row.getData().matchUp.collectionId;
        const collectionMatchUps = updatedMatchUp.tieMatchUps.filter((m) => m.collectionId === collectionId);
        const data = collectionMatchUps.map((collectionMatchUp) =>
          mapMatchUp({ ...collectionMatchUp, dualMatchUp: matchUp }),
        );
        const table = cell.getTable();
        table.updateData(data);
        table.redraw(true);
      }
    };
    participantMatchUpActions(event, cell, callback, params);
  };
