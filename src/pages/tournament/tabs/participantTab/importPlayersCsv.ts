/**
 * Drag/drop CSV/TSV participant import orchestrator.
 *
 * Opens the dropzone modal scoped to CSV/TSV files, then runs the dropped
 * file through the import pipeline:
 *
 *   parseDelimited → openImportParticipantsView → commitParticipantImport
 *
 * The mapping view (M3) lets the user inspect and adjust the auto-detected
 * column mapping before committing.
 */
import { openImportParticipantsView } from 'components/modals/importParticipantsView';
import { parseDelimited } from 'services/import/parseDelimited';
import { dropzoneModal } from 'components/modals/dropzoneModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

export function importPlayersCsv({ callback }: { callback?: () => void } = {}): void {
  dropzoneModal({
    title: t('pages.participants.importFromCsv'),
    extensions: ['csv', 'tsv'],
    accept: '.csv,.tsv,text/csv,text/tab-separated-values',
    callback: (fileContent: string) => {
      const { headers, rows } = parseDelimited(fileContent);
      if (!rows.length) {
        tmxToast({ message: t('toasts.noNewParticipants'), intent: 'is-primary' });
        if (callback) callback();
        return;
      }

      openImportParticipantsView({
        headers,
        rows,
        callback: () => {
          if (callback) callback();
        },
      });
    },
  });
}
