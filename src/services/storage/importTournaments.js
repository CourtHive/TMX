import { mapTournamentRecord } from 'pgs/Tournaments/mapTournamentRecord';
import { dropzoneModal } from 'components/modals/dropzoneModal';
import { convertTMX2TODS } from 'tods-tmx-classic-converter';
import { tournamentEngine } from 'tods-competition-factory';
import { tmx2db } from 'services/storage/tmx2db';
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
          result = convertTMX2TODS({ tournament });
          if (result.tournamentRecord) {
            tournamentRecord = result.tournamentRecord;
          }
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
  // check whether tournament exists for provider in indexedDB
  updateLocalData({ existsInCalendar, tournamentRecord });
  isFunction(callback) && callback();
}

function updateLocalData({ existsInCalendar, tournamentRecord }) {
  const providerId = tournamentRecord.parentOrganisation?.organisationId;
  if (providerId) {
    const checkProvider = (provider) => {
      if (!provider) {
        createProvider({ providerId, tournamentRecord });
      } else {
        checkProviderCalendar({ provider, existsInCalendar, tournamentRecord });
      }
    };
    tmx2db.findProvider(providerId).then(checkProvider, handleError);
  } else {
    createProvider({ providerId, tournamentRecord });
  }
}

function handleError(error) {
  console.log('database error', { error });
}

function addOrUpdateTournament({ tournamentRecord }) {
  const tournamentAdded = () => {
    // console.log('updated or added', { tournamentRecord });
  };
  tmx2db.addTournament(tournamentRecord).then(tournamentAdded, handleError);
}

function addOrUpdateProvider({ provider, tournamentRecord }) {
  const success = () => {
    tournamentRecord && addOrUpdateTournament({ tournamentRecord });
  };
  tmx2db.addProvider(provider).then(success, handleError);
}

export function createProvider({ providerId = 'tmxDefault', tournamentRecord }) {
  const provider = tournamentRecord.parentOrganisation;
  if (provider) {
    provider.providerId = providerId;
    provider.calendar = [mapTournamentRecord(tournamentRecord)];
    addOrUpdateProvider({ provider, tournamentRecord });
  } else {
    const provider = {
      calendar: [mapTournamentRecord(tournamentRecord)],
      providerId,
    };
    addOrUpdateProvider({ provider, tournamentRecord });
  }
}

function checkProviderCalendar({ provider, existsInCalendar, tournamentRecord }) {
  const calendarConfirmed = provider.calendar?.find((item) => item.tournamentId === tournamentRecord.tournamentId);

  if (!existsInCalendar || !calendarConfirmed) {
    if (!provider.calendar) provider.calendar = [];
    provider.calendar.push(mapTournamentRecord(tournamentRecord));
    addOrUpdateProvider({ provider, tournamentRecord });
  } else {
    addOrUpdateTournament({ tournamentRecord });
  }
}
