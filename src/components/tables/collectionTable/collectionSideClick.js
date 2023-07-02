import { participantActions } from 'components/popovers/participantMatchUpActions';
import { mapMatchUp } from 'Pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { tournamentEngine } from 'tods-competition-factory';

export const handleSideClick = (matchUp) => (e, cell) => {
  const callback = (result) => {
    if (result.success) {
      const row = cell.getRow();
      const { drawId, matchUpId } = matchUp;
      const updatedMatchUp = tournamentEngine.findMatchUp({ drawId, matchUpId }).matchUp;
      const collectionId = row.getData().matchUp.collectionId;
      const collectionMatchUps = updatedMatchUp.tieMatchUps.filter((m) => m.collectionId === collectionId);
      const data = collectionMatchUps.map((collectionMatchUp) =>
        mapMatchUp({ ...collectionMatchUp, dualMatchUp: matchUp })
      );
      const table = cell.getTable();
      table.updateData(data);
      table.redraw(e);
    }
  };
  participantActions(e, cell, callback);
};
