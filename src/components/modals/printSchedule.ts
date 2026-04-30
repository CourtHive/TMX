/**
 * Print Schedule Modal
 *
 * Provides options for generating a PDF of the schedule for a specific date.
 * Routes through pdf-factory's print dispatcher with a CompositionConfig
 * resolved from provider defaults + tournament overrides + modal-runtime
 * tweaks. See Mentat/planning/PRINT_DISPATCHER_SCHEDULE_BRANCH.md.
 */
import { competitionEngine } from 'tods-competition-factory';
import { executePrint, resolveCompositionConfig } from 'pdf-factory';
import type { PrintCompositionConfig as PrintComposition } from 'courthive-components';
import { providerConfig } from 'config/providerConfig';
import { openPDF, savePDF } from 'services/pdf/export/pdfExport';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

interface PrintScheduleOptions {
  scheduledDate: string;
  /** Schedule grid courts — used only for the modal context display + landscape default. */
  courts: any[];
  /** Schedule grid rows — used only for the modal context display. */
  rows: any[];
}

export function printSchedule(options: PrintScheduleOptions): void {
  const { scheduledDate, courts, rows } = options;
  const tournamentInfo = competitionEngine.getTournamentInfo()?.tournamentInfo;
  const tournamentName = tournamentInfo?.tournamentName || 'Tournament';

  const content = `
    <div style="padding: 20px;">
      <h3 class="title is-5">${t('modals.printSchedule.title')}</h3>
      <p class="mb-4">${t('modals.printSchedule.generatePdf')} ${scheduledDate}</p>

      <form id="printScheduleForm">
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="includeHeader" checked>
            ${t('modals.printSchedule.includeHeader')}
          </label>
        </div>

        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="includeFooter" checked>
            ${t('modals.printSchedule.includeFooter')}
          </label>
        </div>

        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="landscapeOrientation" ${courts.length >= 5 ? 'checked' : ''}>
            ${t('modals.printSchedule.landscapeOrientation')}
          </label>
        </div>

        <div class="notification is-info is-light mt-4">
          <p><strong>${t('sch')}:</strong> ${scheduledDate}</p>
          <p><strong>${t('crt')}:</strong> ${courts.length}</p>
          <p><strong>${t('modals.printSchedule.rows')}:</strong> ${rows.length}</p>
        </div>
      </form>
    </div>
  `;

  function gatherRuntimeComposition(): Partial<PrintComposition> {
    const includeHeader = (document.getElementById('includeHeader') as HTMLInputElement).checked;
    const includeFooter = (document.getElementById('includeFooter') as HTMLInputElement).checked;
    const landscape = (document.getElementById('landscapeOrientation') as HTMLInputElement).checked;

    const runtime: Partial<PrintComposition> = {};
    if (includeHeader) {
      runtime.header = {
        layout: 'itf',
        tournamentName,
        subtitle: `ORDER OF PLAY — ${scheduledDate}`,
      };
    } else {
      runtime.header = { layout: 'none' };
    }
    if (includeFooter) {
      runtime.footer = { layout: 'standard', showTimestamp: true, showPageNumbers: true };
    } else {
      runtime.footer = { layout: 'none' };
    }
    runtime.page = { orientation: landscape ? 'landscape' : 'portrait' };
    return runtime;
  }

  function buildPdf(): { doc: any; filename: string } | null {
    const composition = resolveCompositionConfig({
      providerConfig: providerConfig.get() as any,
      tournamentRecord: tournamentInfo as any,
      printType: 'schedule',
      runtime: gatherRuntimeComposition() as any,
    });

    const result = executePrint(
      { type: 'schedule', scheduledDate, composition: composition as any },
      { tournamentEngine: competitionEngine },
    );

    if (!result.success || !result.doc) {
      console.error('executePrint failed:', result.error);
      alert(t('modals.printSchedule.generateError'));
      return null;
    }
    return { doc: result.doc, filename: result.filename ?? `Schedule_${scheduledDate}.pdf` };
  }

  const buttons = [
    { label: t('common.cancel'), close: true },
    {
      label: t('view'),
      intent: 'is-info',
      onClick: () => {
        const pdf = buildPdf();
        if (pdf) openPDF({ doc: pdf.doc });
      },
    },
    {
      label: t('dl'),
      intent: 'is-primary',
      onClick: () => {
        const pdf = buildPdf();
        if (pdf) savePDF({ doc: pdf.doc, filename: pdf.filename });
      },
    },
  ];

  openModal({ title: t('modals.printSchedule.title'), content, buttons });
}
