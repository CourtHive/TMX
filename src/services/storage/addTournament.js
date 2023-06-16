import { mapTournamentRecord } from 'Pages/Tournaments/mapTournamentRecord';
import { getLoginState } from 'services/authentication/loginState';
import { isFunction } from 'functions/typeOf';
import { tmx2db } from './tmx2db';

export function addOrUpdateTournament({ tournamentRecord, callback }) {
  const providerId = getLoginState()?.providerId;

  const addComplete = () => isFunction(callback) && callback();
  const addTournament = () => tmx2db.addTournament(tournamentRecord).then(addComplete);
  const checkProviderCalendar = (provider) => {
    const existsInCalendar = provider?.calendar
      ?.map((item) => item.tournamentId)
      .includes(tournamentRecord.tournamentId);

    if (!existsInCalendar) {
      if (!provider.calendar) provider.calendar = [];
      provider.calendar.push(mapTournamentRecord(tournamentRecord));
      addOrUpdateProvider({ provider, callback: addTournament });
    } else {
      addTournament();
    }
  };

  if (providerId) {
    const withProvider = (provider) => {
      if (provider) {
        if (!tournamentRecord.parentOrganisation) {
          tournamentRecord.parentOrganisation = {
            organisationAbbreviation: provider.organisationAbbreviation,
            organisationName: provider.organisationName,
            organisationId: providerId
          };
        }
        checkProviderCalendar(provider);
      } else {
        addTournament();
      }
    };
    tmx2db.findProvider(providerId).then(withProvider);
  } else {
    addTournament();
  }
}

export function addOrUpdateProvider({ provider, callback }) {
  const success = () => isFunction(callback) && callback();
  tmx2db.addProvider(provider).then(success);
}
