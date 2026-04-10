/**
 * Drag/drop CSV/TSV participant import orchestrator.
 *
 * Opens the dropzone modal scoped to CSV/TSV files, then runs the dropped
 * file through the import pipeline:
 *
 *   parseDelimited → autoMapColumns → commitParticipantImport
 *
 * Milestone 2 ships with auto-mapping only — there is no manual mapping UI
 * yet. Columns the auto-mapper does not recognize are silently ignored at
 * commit time. The mapping view is added in Milestone 3, at which point
 * this orchestrator will be extended to open it between the auto-mapper
 * and the committer.
 */
import { commitParticipantImport } from 'services/import/commitParticipantImport';
import { autoMapColumns } from 'services/import/autoMapColumns';
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

      const mapping = autoMapColumns(headers);

      commitParticipantImport({
        headers,
        rows,
        mapping,
        callback: () => {
          if (callback) callback();
        },
      });
    },
  });
}
