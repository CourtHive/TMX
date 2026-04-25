import { getLoginState } from 'services/authentication/loginState';
import { saveTournamentRecord } from './saveTournamentRecord';

export async function addOrUpdateTournament({
  tournamentRecord,
  callback,
}: {
  tournamentRecord: any;
  callback?: () => void;
}): Promise<void> {
  const provider = getLoginState()?.provider;

  if (provider && !tournamentRecord.parentOrganisation) tournamentRecord.parentOrganisation = provider;
  await saveTournamentRecord({ tournamentRecord });
  callback?.();
}
