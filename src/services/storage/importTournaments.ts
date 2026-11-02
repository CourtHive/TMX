/**
 * Import tournament records from file via dropzone modal or native dialog.
 * Parses CODES JSON and adds tournaments to calendar table with conflict handling, then warns
 * (without blocking) when the record fails CODES schema or integrity validation.
 */
import { warnOnRecordValidation } from 'components/modals/recordValidationWarning';
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { loadImportedTournament } from './loadImportedTournament';
import { addOrUpdateTournament } from './addOrUpdateTournament';
import { dropzoneModal } from 'components/modals/dropzoneModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { platform } from 'platform';
import { t } from 'i18n';

function processImportData(data: string, tournamentIds: string[], table: any): void {
  // Validation runs after the record is loaded and never blocks it; findings arrive as a warning.
  const result = loadImportedTournament({
    data,
    onLoaded: (tournamentRecord) => addTournament({ tournamentRecord, tournamentIds, table }),
    onValidated: warnOnRecordValidation,
  });
  if (result.classic) {
    tmxToast({ message: t('toasts.tmxClassicNotConverted') });
  } else if (result.error) {
    console.log(result);
  }
}

export function importTournaments({ table }: { table: any }): void {
  const tournamentIds = table.getData().map((t: any) => t.tournamentId);

  if (platform.canAccessFileSystem() && platform.openFiles) {
    platform
      .openFiles({
        title: t('storage.importTournament'),
        filters: [{ name: 'CODES JSON', extensions: ['json'] }],
        multiple: true,
      })
      .then((files) => {
        for (const file of files ?? []) processImportData(new TextDecoder().decode(file.data), tournamentIds, table);
      })
      .catch((err) => console.error('[import] native open failed', err));
    return;
  }

  dropzoneModal({
    callback: (data: string) => processImportData(data, tournamentIds, table),
    extensions: ['json'],
    accept: 'application/json',
  });
}

export async function addTournament({
  tournamentRecord,
  tournamentIds,
  table,
  callback,
}: {
  tournamentRecord: any;
  tournamentIds?: string[];
  table?: any;
  callback?: () => void;
}): Promise<void> {
  const rowData = mapTournamentRecord(tournamentRecord);
  const existsInCalendar = tournamentIds?.includes(tournamentRecord.tournamentId);
  if (existsInCalendar) {
    table?.updateOrAddData([rowData], true);
  } else {
    table?.addData([rowData], true);
  }
  await addOrUpdateTournament({ tournamentRecord });
  callback?.();
}
