import { convertTMX2TODS } from 'tods-tmx-classic-converter';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { addTournament } from './importTournaments';
import { db } from './db';

export function legacyImport(table) {
  const tournamentIds = table.getData().map((t) => t.tournamentId);

  const processLegacyTournaments = (tournaments) => {
    if (tournaments?.length) {
      let importedCount = 0;
      for (const tournament of tournaments) {
        const result = convertTMX2TODS({ tournament });
        const tournamentRecord = result?.tournamentRecord;
        if (tournamentRecord) {
          const result = tournamentEngine.setState(tournamentRecord);

          if (result.success) {
            addTournament({ tournamentRecord, tournamentIds, table });
            importedCount += 1;
          } else {
            console.log(result);
          }
        } else {
          console.log('error');
        }
      }
      tmxToast({ message: `Imported ${importedCount} tournaments(s)`, intent: 'is-success' });
    } else {
      tmxToast({ message: 'No tournaments found', intent: 'is-warning' });
    }
    db.db.close();
  };
  const checkForLegacy = () => db.findAllTournaments().then(processLegacyTournaments);

  if (!db?.db?.isOpen()) {
    db.initDB().then(checkForLegacy);
  } else {
    checkForLegacy();
  }
}
