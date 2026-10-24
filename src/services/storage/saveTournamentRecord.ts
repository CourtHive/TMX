import { maintainLocalCalendarEntry } from './localCalendar';
import { tournamentEngine } from 'services/factory/engine';
import { serverConfig } from 'config/serverConfig';
import { debugConfig } from 'config/debugConfig';
import { isHeldOffline } from './offlineCustody';
import { tmx2db } from './tmx2db';

export async function saveTournamentRecord(params?: { tournamentRecord?: any }): Promise<void> {
  const tournamentRecord = params?.tournamentRecord ?? tournamentEngine.q.tournament();
  if (!tournamentRecord) return;

  // Provider-owned tournaments are only saved locally if "Save local copies" is enabled — they are
  // caches of the server's copy. One held offline is not: its local copy is the only one, so it is
  // always saved. Without this, "Go offline" kept every offline edit in memory alone (offlineCustody.ts).
  const hasProvider = !!tournamentRecord.parentOrganisation?.organisationId;
  if (hasProvider && !serverConfig.get().saveLocal && !isHeldOffline(tournamentRecord)) {
    debugConfig.get().log?.verbose && console.log('%c localSave skipped (saveLocal disabled)', 'color: orange');
    return;
  }

  debugConfig.get().log?.verbose && console.log('%c localSave', 'color: yellow');
  await tmx2db.addTournament(tournamentRecord);
  // Maintain the lightweight local calendar entry so the tournaments list renders
  // from entries instead of loading every full record (mirror of the server's
  // calendar side-effect). Kept in step with what is actually in IndexedDB.
  await maintainLocalCalendarEntry(tournamentRecord);
}
