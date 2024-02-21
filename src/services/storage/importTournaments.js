import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { dropzoneModal } from 'components/modals/dropzoneModal';
import { saveTournamentRecord } from './saveTournamentRecord';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import * as safeJSON from 'utilities/safeJSON';
import { isFunction } from 'functions/typeOf';

export function importTournaments(table) {
  const tournamentIds = table.getData().map((t) => t.tournamentId);

  dropzoneModal({
    callback: (data) => {
      const tournament = safeJSON.parse({ data });
      if (tournament) {
        let result, tournamentRecord;
        if (tournament.tournamentId && tournament.startDate) {
          tournamentRecord = tournament;
        } else if (tournament.tuid && tournament.start) {
          tmxToast({ message: 'TMX Classic file not converted' });
        }

        result = tournamentEngine.setState(tournamentRecord);

        if (result.success) {
          addTournament({ tournamentRecord, tournamentIds, table });
        } else {
          console.log(result);
        }
      }
    },
  });
}

export function addTournament({ tournamentRecord, tournamentIds, table, callback }) {
  const rowData = mapTournamentRecord(tournamentRecord);
  const existsInCalendar = tournamentIds?.includes(tournamentRecord.tournamentId);
  if (existsInCalendar) {
    // tournament exists in calendar; update details
    // unsure whether, true inserts rows being added at top of table...
    table?.updateOrAddData([rowData], true);
  } else {
    table?.addData([rowData], true);
  }
  addOrUpdateTournament({ tournamentRecord });
  isFunction(callback) && callback();
}

function addOrUpdateTournament({ tournamentRecord }) {
  const tournamentAdded = () => {
    // console.log('updated or added', { tournamentRecord });
  };
  saveTournamentRecord({ tournamentRecord, callback: tournamentAdded });
}
