/**
 * Export tournament record modal.
 * Provides options to export as TODS JSON or UTR format.
 */
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { downloadUTRmatches } from 'services/export/UTR';
import { downloadJSON } from 'services/export/download';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';
import { UTR } from 'constants/tmxConstants';

export function exportTournamentRecord(): void {
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (!tournamentRecord) return;

  const exportTODS = () => {
    if (tournamentRecord) {
      downloadJSON(`${tournamentRecord.tournamentId}.tods.json`, tournamentRecord);
    } else {
      tmxToast({ message: t('common.error') });
    }
  };

  const buttons = [
    { label: t('common.cancel'), intent: 'none' },
    { label: UTR, intent: 'is-warning', onClick: downloadUTRmatches, close: true },
    { label: t('modals.exportTournament.tods'), intent: 'is-primary', onClick: exportTODS, close: true },
  ];
  const title = `${t('phrases.export')}: ${t('trn')}`;

  openModal({ title, content: tournamentRecord.tournamentName, buttons });
}
