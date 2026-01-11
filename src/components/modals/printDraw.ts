/**
 * Print Draw Modal
 * Provides options for generating PDF of draw sheet
 */
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { generateDrawPDF } from 'services/pdf/generators/drawGenerator';
import { tournamentEngine } from 'tods-competition-factory';

interface PrintDrawParams {
  drawId: string;
  eventId: string;
  structureId?: string;
}

export function printDraw({ drawId, eventId, structureId }: PrintDrawParams): void {
  // Get tournament info using getTournamentInfo (TODS format)
  const tournamentInfoResult = tournamentEngine.getTournamentInfo();
  const tournament = tournamentInfoResult?.tournamentInfo;
  
  const eventResult = tournamentEngine.getEvent({ eventId });
  const event = eventResult?.event;
  
  // Get draw definition
  let drawDefinition;
  if (event?.drawDefinitions) {
    drawDefinition = event.drawDefinitions.find((dd: any) => dd.drawId === drawId);
  } else {
    // Try alternate method
    const drawResult = tournamentEngine.findDrawDefinition({ drawId });
    drawDefinition = drawResult?.drawDefinition;
  }

  console.log('Print draw data:', { tournament, event, drawDefinition, drawId, eventId });

  if (!event || !drawDefinition) {
    console.error('Missing required data for print draw', {
      hasTournament: !!tournament,
      hasEvent: !!event,
      hasDrawDefinition: !!drawDefinition,
      drawId,
      eventId
    });
    return;
  }
  
  // Tournament is optional - use fallback values if not available

  // Get draw name (use structure name if structureId provided)
  let drawTitle = drawDefinition.drawName || event.eventName;
  if (structureId) {
    const structure = drawDefinition.structures?.find((s: any) => s.structureId === structureId);
    if (structure?.structureName) {
      drawTitle = structure.structureName;
    }
  }

  // Form state
  let printOptions = {
    drawTitle,
    includeSeeding: true,
    includeRankings: true,
    includeTimestamp: true,
    includeOrganizers: true,
  };

  const formItems = [
    {
      label: 'Draw Title',
      field: 'drawTitle',
      value: printOptions.drawTitle,
      placeholder: 'Enter draw title',
    },
    {
      text: 'Options',
      class: 'itemTitle',
    },
    {
      label: 'Include seeding',
      field: 'includeSeeding',
      checkbox: true,
      checked: printOptions.includeSeeding,
    },
    {
      label: 'Include rankings',
      field: 'includeRankings',
      checkbox: true,
      checked: printOptions.includeRankings,
    },
    {
      label: 'Include timestamp',
      field: 'includeTimestamp',
      checkbox: true,
      checked: printOptions.includeTimestamp,
    },
    {
      label: 'Include organizers',
      field: 'includeOrganizers',
      checkbox: true,
      checked: printOptions.includeOrganizers,
    },
  ];

  const content = document.createElement('div');
  content.style.padding = '1em';

  renderForm(content, formItems);

  // Update state when form changes
  content.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const field = target.getAttribute('field');
    
    if (field) {
      if (target.type === 'checkbox') {
        (printOptions as any)[field] = target.checked;
      } else {
        (printOptions as any)[field] = target.value;
      }
    }
  });

  const buttons = [
    {
      label: 'Cancel',
      intent: 'none',
      close: true,
    },
    {
      label: 'View',
      intent: 'is-info',
      onClick: async () => {
        try {
          await generateDrawPDF({
            tournament,
            event,
            drawDefinition,
            structureId,
            options: printOptions,
            action: 'open',
          });
        } catch (error) {
          console.error('Error generating PDF:', error);
          alert('Failed to generate PDF. Check console for details.');
        }
      },
      close: true,
    },
    {
      label: 'Download',
      intent: 'is-primary',
      onClick: async () => {
        try {
          await generateDrawPDF({
            tournament,
            event,
            drawDefinition,
            structureId,
            options: printOptions,
            action: 'download',
          });
        } catch (error) {
          console.error('Error generating PDF:', error);
          alert('Failed to generate PDF. Check console for details.');
        }
      },
      close: true,
    },
  ];

  openModal({
    title: 'Print Draw',
    content,
    buttons,
  });
}
