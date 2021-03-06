import i18n from 'i18next';
import { db } from 'services/storage/db';
import { tmxStore } from 'stores/tmxStore';

export function deleteTournamentRecord({ tournamentId, onDelete }) {
  if (!tournamentId) return;
  db.findTournament(tournamentId).then(doIt, (err) => console.log({ err }));
  function doIt(tournament) {
    tmxStore.dispatch({
      type: 'alert dialog',
      payload: {
        title: i18n.t('actions.delete_tournament'),
        content: `Delete ${tournament.tournamentName}?`,
        cancel: true,
        okTitle: 'Delete',
        ok: okAction
      }
    });

    function okAction() {
      deleteTournament({ tournament, onDelete });
    }
  }
}

function deleteTournament({ tournament, onDelete }) {
  const tournamentId = tournament.unifiedTournamentId?.tournamentId || tournament.tournamentId;

  tmxStore.dispatch({ type: 'clear tournament' });
  db.deleteTournament(tournamentId).then(done, (err) => console.log({ err }));
  function done() {
    if (typeof onDelete === 'function') onDelete();
  }
}
