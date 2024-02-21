import { getLoginState } from 'services/authentication/loginState';
import { saveTournamentRecord } from './saveTournamentRecord';

export function addOrUpdateTournament({ tournamentRecord, callback }) {
  const provider = getLoginState()?.provider;

  if (provider && !tournamentRecord.parentOrganisation) tournamentRecord.parentOrganisation = provider;
  saveTournamentRecord({ tournamentRecord, callback });
}
