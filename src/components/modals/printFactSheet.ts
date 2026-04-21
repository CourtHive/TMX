/**
 * Print Fact Sheet Modal — generates tournament fact sheet PDF
 */
import { generateFactSheet, listFactSheetTemplates } from 'pdf-factory';
import { openPDF, savePDF } from 'services/pdf/export/pdfExport';
import { tournamentEngine } from 'tods-competition-factory';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

export function printFactSheet(): void {
  const tournamentRecord = tournamentEngine.getTournament()?.tournamentRecord;
  if (!tournamentRecord) return;

  const tournamentName = tournamentRecord.tournamentName || 'Tournament';
  const templates = listFactSheetTemplates();

  const formItems = [
    {
      field: 'templateId',
      label: 'Template',
      options: templates.map((tmpl) => ({
        label: tmpl.name,
        value: tmpl.id,
        selected: tmpl.id === 'national-federation',
      })),
    },
    {
      text: tournamentName,
      style: 'font-weight: bold; margin-top: 8px;',
    },
  ];

  const content = document.createElement('div');
  content.style.padding = '1em';
  const inputs = renderForm(content, formItems);

  const generate = (action: 'open' | 'download') => {
    const templateId = inputs.templateId?.value || 'national-federation';
    const doc = generateFactSheet(tournamentRecord, { templateId });
    const safeName = tournamentName.replaceAll(/[^a-zA-Z0-9-_ ]/g, '').replaceAll(/\s+/g, '-');
    const date = new Date().toISOString().split('T')[0];
    const filename = `fact-sheet-${safeName}-${date}.pdf`;

    if (action === 'open') {
      openPDF({ doc });
    } else {
      savePDF({ doc, filename });
    }
  };

  const buttons = [
    { label: t('common.cancel'), intent: 'none', close: true },
    {
      label: t('view'),
      intent: 'is-info',
      onClick: () => generate('open'),
      close: true,
    },
    {
      label: t('dl'),
      intent: 'is-primary',
      onClick: () => generate('download'),
      close: true,
    },
  ];

  openModal({
    title: 'Print Fact Sheet',
    content,
    buttons,
  });
}
