/**
 * Import tournament records from file via dropzone modal.
 * Parses TODS JSON and adds tournaments to calendar table with conflict handling.
 */
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { addOrUpdateTournament } from './addOrUpdateTournament';
import { dropzoneModal } from 'components/modals/dropzoneModal';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import * as safeJSON from 'utilities/safeJSON';
import { isFunction } from 'functions/typeOf';

export function importTournaments({ table }: { table: any }): void {
  const tournamentIds = table.getData().map((t: any) => t.tournamentId);

  (dropzoneModal as any)({
    callback: (data: string) => {
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

export function addTournament({ tournamentRecord, tournamentIds, table, callback }: { tournamentRecord: any; tournamentIds?: string[]; table?: any; callback?: () => void }): void {
  const rowData = mapTournamentRecord(tournamentRecord);
  const existsInCalendar = tournamentIds?.includes(tournamentRecord.tournamentId);
  if (existsInCalendar) {
    table?.updateOrAddData([rowData], true);
  } else {
    table?.addData([rowData], true);
  }
  addOrUpdateTournament({ tournamentRecord });
  isFunction(callback) && callback && callback();
}
