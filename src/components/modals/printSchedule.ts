/**
 * Print Schedule Modal
 * Provides options for generating a PDF of the schedule for a specific date
 */
import { openModal } from './baseModal/baseModal';
import { generateSchedulePDF } from 'services/pdf/generators/scheduleGenerator';
import { competitionEngine } from 'tods-competition-factory';

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
      <h3 class="title is-5">Print Schedule</h3>
      <p class="mb-4">Generate a PDF of the schedule for ${scheduledDate}</p>
      
      <form id="printScheduleForm">
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="includeHeader" checked>
            Include header
          </label>
        </div>
        
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="includeFooter" checked>
            Include footer
          </label>
        </div>
        
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="landscapeOrientation" ${courts.length >= 5 ? 'checked' : ''}>
            Landscape orientation (recommended for ${courts.length}+ courts)
          </label>
        </div>
        
        <div class="field">
          <label class="label">Court identifiers</label>
          <div class="control">
            <label class="radio">
              <input type="radio" name="courtIdentifiers" value="full" checked>
              Full court names
            </label>
            <label class="radio">
              <input type="radio" name="courtIdentifiers" value="short">
              Short court names (first word)
            </label>
          </div>
        </div>
        
        <div class="notification is-info is-light mt-4">
          <p><strong>Schedule:</strong> ${scheduledDate}</p>
          <p><strong>Courts:</strong> ${courts.length}</p>
          <p><strong>Rows:</strong> ${rows.length}</p>
        </div>
      </form>
    </div>
  `;

  const buttons = [
    {
      label: 'Cancel',
      close: true,
    },
    {
      label: 'View',
      intent: 'is-info',
      onClick: async () => {
        const includeHeader = (document.getElementById('includeHeader') as HTMLInputElement).checked;
        const includeFooter = (document.getElementById('includeFooter') as HTMLInputElement).checked;
        const landscape = (document.getElementById('landscapeOrientation') as HTMLInputElement).checked;
        const courtIdentifiers = (document.querySelector('input[name="courtIdentifiers"]:checked') as HTMLInputElement).value;

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
          alert('Failed to generate schedule PDF. Check console for details.');
        }
      },
    },
    {
      label: 'Download',
      intent: 'is-primary',
      onClick: async () => {
        const includeHeader = (document.getElementById('includeHeader') as HTMLInputElement).checked;
        const includeFooter = (document.getElementById('includeFooter') as HTMLInputElement).checked;
        const landscape = (document.getElementById('landscapeOrientation') as HTMLInputElement).checked;
        const courtIdentifiers = (document.querySelector('input[name="courtIdentifiers"]:checked') as HTMLInputElement).value;

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
          alert('Failed to generate schedule PDF. Check console for details.');
        }
      },
    },
  ];

  openModal({ title: 'Print Schedule', content, buttons });
}
