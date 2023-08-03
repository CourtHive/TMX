import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { downloadUTRmatches } from 'services/export/UTR';
import { downloadJSON } from 'services/export/download';
import { openModal } from './baseModal/baseModal';
import { lang } from 'services/translator';

export function exportTournamentRecord() {
  const { tournamentRecord } = tournamentEngine.getState();
  if (!tournamentRecord) return;

  const exportTODS = () => {
    if (tournamentRecord) {
      downloadJSON(`${tournamentRecord.tournamentId}.tods.json`, tournamentRecord);
    } else {
      tmxToast({ message: 'Error' });
    }
  };

  const buttons = [
    { label: 'Cancel', intent: 'none' },
    { label: 'UTR', intent: 'is-warning', onClick: downloadUTRmatches, close: true },
    { label: 'TODS', intent: 'is-primary', onClick: exportTODS, close: true }
  ];
  const title = `${lang.tr('phrases.export')}: ${lang.tr('trn')}`;

  openModal({ title, content: tournamentRecord.tournamentName, buttons });
}
