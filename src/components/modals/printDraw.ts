/**
 * Print Draw Modal — uses pdf-factory for generation
 */
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { generateDrawPDF } from 'services/pdf/generators/drawGenerator';
import { tournamentEngine } from 'tods-competition-factory';
import { t } from 'i18n';

interface PrintDrawParams {
  drawId: string;
  eventId: string;
  structureId?: string;
}

export function printDraw({ drawId, eventId, structureId }: PrintDrawParams): void {
  const tournamentInfoResult = tournamentEngine.getTournamentInfo();
  const tournament = tournamentInfoResult?.tournamentInfo;

  const eventResult = tournamentEngine.getEvent({ eventId });
  const event = eventResult?.event;

  let drawDefinition;
  if (event?.drawDefinitions) {
    drawDefinition = event.drawDefinitions.find((dd: any) => dd.drawId === drawId);
  }

  if (!drawDefinition) return;

  let drawTitle = drawDefinition.drawName || event?.eventName || '';
  if (structureId) {
    const structure = drawDefinition.structures?.find((s: any) => s.structureId === structureId);
    if (structure?.structureName) drawTitle = structure.structureName;
  }

  let printOptions = {
    drawTitle,
    includeSeeding: true,
    includeTimestamp: true,
    splitPages: false,
  };

  const formItems = [
    {
      label: t('modals.printDraw.drawTitle'),
      field: 'drawTitle',
      value: printOptions.drawTitle,
      placeholder: t('modals.printDraw.drawTitlePlaceholder'),
    },
    {
      text: t('modals.printDraw.options'),
      class: 'itemTitle',
    },
    {
      label: t('modals.printDraw.includeSeeding'),
      field: 'includeSeeding',
      id: 'pd-seeding',
      checkbox: true,
      checked: printOptions.includeSeeding,
    },
    {
      label: t('modals.printDraw.includeTimestamp'),
      field: 'includeTimestamp',
      id: 'pd-timestamp',
      checkbox: true,
      checked: printOptions.includeTimestamp,
    },
    ...(drawDefinition.drawSize >= 64
      ? [
          {
            label: 'Multi-page (split into sections)',
            field: 'splitPages',
            id: 'pd-split',
            checkbox: true,
            checked: false,
          },
        ]
      : []),
  ];

  const content = document.createElement('div');
  content.style.padding = '1em';
  renderForm(content, formItems);

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
    { label: t('common.cancel'), intent: 'none', close: true },
    {
      label: t('view'),
      intent: 'is-info',
      onClick: () => {
        generateDrawPDF({
          tournament,
          event,
          drawId,
          structureId,
          options: {
            drawTitle: printOptions.drawTitle,
            includeTimestamp: printOptions.includeTimestamp,
            includeSeeding: printOptions.includeSeeding,
            splitPages: printOptions.splitPages,
          },
          action: 'open',
        });
      },
      close: true,
    },
    {
      label: t('dl'),
      intent: 'is-primary',
      onClick: () => {
        generateDrawPDF({
          tournament,
          event,
          drawId,
          structureId,
          options: {
            drawTitle: printOptions.drawTitle,
            includeTimestamp: printOptions.includeTimestamp,
            includeSeeding: printOptions.includeSeeding,
            splitPages: printOptions.splitPages,
          },
          action: 'download',
        });
      },
      close: true,
    },
  ];

  openModal({
    title: t('modals.printDraw.title'),
    content,
    buttons,
  });
}
