import { tournamentEngine } from 'tods-competition-factory';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';
import { tmx2db } from './tmx2db';

export async function saveTournamentRecord(params?: { tournamentRecord?: any }): Promise<void> {
  const tournamentRecord = params?.tournamentRecord ?? tournamentEngine.getTournament()?.tournamentRecord;
  if (!tournamentRecord) return;

  // Provider-owned tournaments are only saved locally if "Save local copies" is enabled
  const hasProvider = !!tournamentRecord.parentOrganisation?.organisationId;
  if (hasProvider && !serverConfig.get().saveLocal) {
    debugConfig.get().log?.verbose && console.log('%c localSave skipped (saveLocal disabled)', 'color: orange');
    return;
  }

  debugConfig.get().log?.verbose && console.log('%c localSave', 'color: yellow');
  await tmx2db.addTournament(tournamentRecord);
}
