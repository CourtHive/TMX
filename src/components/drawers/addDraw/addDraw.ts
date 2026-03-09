/**
 * Add draw configuration drawer.
 * Provides form for creating new draw/flight with matchUp format and generation options.
 */
import { getMatchUpFormatModal, renderButtons, renderForm, validators } from 'courthive-components';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { getDrawFormRelationships } from './getDrawFormRelationships';
import { navigateToTopology } from 'pages/tournament/topologyPage';
import { getDrawTypeInfoKey } from './drawTypeDescriptions';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { informModal } from 'components/modals/baseModal/baseModal';
import { getDrawFormItems } from './getDrawFormItems';
import { submitDrawParams } from './submitDrawParams';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { CUSTOM, DRAW_NAME, DRAW_TYPE, NONE, RIGHT, STRUCTURE_NAME, TOPOLOGY_TEMPLATE_PREFIX } from 'constants/tmxConstants';

type AddDrawParams = {
  callback?: (result: any) => void;
  isQualifying?: boolean;
  flightNumber?: number;
  drawName?: string;
  structureId?: string;
  eventId: string;
  drawId?: string;
};

export function addDraw({
  isQualifying,
  flightNumber,
  structureId,
  callback,
  drawName,
  eventId,
  drawId,
}: AddDrawParams): void {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const { items, structurePositionAssignments } = getDrawFormItems({ event, drawId, isQualifying, structureId });
  const relationships = getDrawFormRelationships({
    maxQualifiers: structurePositionAssignments?.length,
    isQualifying,
    drawId,
    event,
  });

  let inputs: any;
  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
    attachDrawTypeHelp(inputs);
  };

  const isValid = () =>
    isQualifying
      ? validators.nameValidator(4)(inputs[STRUCTURE_NAME].value)
      : validators.nameValidator(3)(inputs[DRAW_NAME].value);

  const checkParams = () => {
    const selectedDrawType = inputs[DRAW_TYPE]?.options?.[inputs[DRAW_TYPE].selectedIndex]?.getAttribute?.('value') ||
      inputs[DRAW_TYPE]?.value;
    if (selectedDrawType?.startsWith(TOPOLOGY_TEMPLATE_PREFIX)) {
      context.drawer.close();
      const templateName = selectedDrawType.slice(TOPOLOGY_TEMPLATE_PREFIX.length);
      navigateToTopology({ eventId, drawId, templateName });
      return;
    }
    if (!isValid()) {
      tmxToast({ message: t('drawers.addDraw.missingName'), intent: 'is-danger' });
    } else if (inputs.matchUpFormat?.value === CUSTOM) {
      const setMatchUpFormat = (matchUpFormat: string) => {
        if (matchUpFormat) {
          (submitDrawParams as any)({
            event,
            inputs,
            callback,
            structureId,
            matchUpFormat,
            drawId,
            drawName,
            isQualifying,
          });
        }
      };
      (getMatchUpFormatModal as any)({
        callback: setMatchUpFormat,
        config: { labels: getMatchFormatLabels() },
        modalConfig: {
          style: {
            fontSize: '12px',
            border: '3px solid var(--tmx-border-focus)',
          },
        },
      });
    } else {
      (submitDrawParams as any)({ event, inputs, callback, structureId, drawId, drawName, isQualifying });
    }
  };

  const buttons = [
    { label: t('common.cancel'), intent: NONE, close: true },
    { label: t('drawers.addDraw.generate'), id: 'generateDraw', intent: 'is-primary', onClick: checkParams, close: isValid },
  ];

  const title = flightNumber ? t('drawers.addDraw.generateFlight') : t('drawers.addDraw.configureDraw');

  const footer = (elem: HTMLElement, close: () => void) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}

function attachDrawTypeHelp(inputs: any) {
  const drawTypeSelect = inputs[DRAW_TYPE] as HTMLSelectElement;
  if (!drawTypeSelect) return;

  // Find the field container (parent label row) for the draw type select
  const fieldContainer = drawTypeSelect.closest('.field');
  if (!fieldContainer) return;
  const labelEl = fieldContainer.querySelector('label');
  if (!labelEl) return;

  // Create (?) button next to the label
  const helpBtn = document.createElement('span');
  helpBtn.textContent = '\u24D8';
  helpBtn.title = t('drawers.addDraw.drawTypeInfo');
  helpBtn.style.cssText = 'cursor: pointer; margin-left: 0.4em; color: var(--tmx-text-muted, #888); font-size: 0.9em;';
  labelEl.appendChild(helpBtn);

  const showInfo = () => {
    const selectedValue =
      drawTypeSelect.options[drawTypeSelect.selectedIndex]?.getAttribute('value') || drawTypeSelect.value;
    const infoKey = getDrawTypeInfoKey(selectedValue);
    const description = t(`drawers.addDraw.drawTypeDescriptions.${infoKey}`, { defaultValue: '' });
    const selectedLabel = drawTypeSelect.options[drawTypeSelect.selectedIndex]?.textContent || selectedValue;
    const message = description
      ? `<div><strong>${selectedLabel}</strong></div><div style="margin-top: 0.5em;">${description}</div>`
      : `<div><strong>${selectedLabel}</strong></div>`;

    informModal({
      title: t('drawers.addDraw.drawTypeInfo'),
      message,
      okAction: undefined,
    });
  };

  helpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showInfo();
  });
}
