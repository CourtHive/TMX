/**
 * Print Schedule Modal
 * Provides options for generating a PDF of the schedule for a specific date
 */
import { generateSchedulePDF } from 'services/pdf/generators/scheduleGenerator';
import { competitionEngine } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

interface PrintScheduleOptions {
  scheduledDate: string;
  courts: any[];
  rows: any[];
}

export function printSchedule(options: PrintScheduleOptions): void {
  const { scheduledDate, courts, rows } = options;
  const tournament = competitionEngine.getTournamentInfo().tournamentInfo;

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

        <div class="field">
          <label class="label">${t('settings.courtidentifiers')}</label>
          <div class="control">
            <label class="radio">
              <input type="radio" name="courtIdentifiers" value="full" checked>
              ${t('modals.printSchedule.fullCourtNames')}
            </label>
            <label class="radio">
              <input type="radio" name="courtIdentifiers" value="short">
              ${t('modals.printSchedule.shortCourtNames')}
            </label>
          </div>
        </div>

        <div class="notification is-info is-light mt-4">
          <p><strong>${t('sch')}:</strong> ${scheduledDate}</p>
          <p><strong>${t('crt')}:</strong> ${courts.length}</p>
          <p><strong>${t('modals.printSchedule.rows')}:</strong> ${rows.length}</p>
        </div>
      </form>
    </div>
  `;

  const buttons = [
    {
      label: t('common.cancel'),
      close: true,
    },
    {
      label: t('view'),
      intent: 'is-info',
      onClick: async () => {
        const includeHeader = (document.getElementById('includeHeader') as HTMLInputElement).checked;
        const includeFooter = (document.getElementById('includeFooter') as HTMLInputElement).checked;
        const landscape = (document.getElementById('landscapeOrientation') as HTMLInputElement).checked;
        const courtIdentifiers = (document.querySelector('input[name="courtIdentifiers"]:checked') as HTMLInputElement)
          .value;

        try {
          await generateSchedulePDF({
            tournament,
            scheduledDate,
            courts,
            rows,
            options: {
              includeHeader,
              includeFooter,
              landscape,
              fullCourtNames: courtIdentifiers === 'full',
            },
            action: 'open',
          });
        } catch (error) {
          console.error('Error generating schedule PDF:', error);
          alert(t('modals.printSchedule.generateError'));
        }
      },
    },
    {
      label: t('dl'),
      intent: 'is-primary',
      onClick: async () => {
        const includeHeader = (document.getElementById('includeHeader') as HTMLInputElement).checked;
        const includeFooter = (document.getElementById('includeFooter') as HTMLInputElement).checked;
        const landscape = (document.getElementById('landscapeOrientation') as HTMLInputElement).checked;
        const courtIdentifiers = (document.querySelector('input[name="courtIdentifiers"]:checked') as HTMLInputElement)
          .value;

        try {
          await generateSchedulePDF({
            tournament,
            scheduledDate,
            courts,
            rows,
            options: {
              includeHeader,
              includeFooter,
              landscape,
              fullCourtNames: courtIdentifiers === 'full',
            },
            action: 'save',
          });
        } catch (error) {
          console.error('Error generating schedule PDF:', error);
          alert(t('modals.printSchedule.generateError'));
        }
      },
    },
  ];

  openModal({ title: t('modals.printSchedule.title'), content, buttons });
}
