/**
 * Add draw configuration drawer.
 * Provides form for creating new draw/flight with matchUp format and generation options.
 */
import { getMatchUpFormatModal, renderButtons, renderForm, validators } from 'courthive-components';
import { getDrawFormRelationships } from './getDrawFormRelationships';
import { navigateToTopology } from 'pages/tournament/topologyPage';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { getDrawFormItems } from './getDrawFormItems';
import { submitDrawParams } from './submitDrawParams';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { CUSTOM, CUSTOM_TOPOLOGY, DRAW_NAME, DRAW_TYPE, NONE, RIGHT, STRUCTURE_NAME } from 'constants/tmxConstants';

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
  };

  const isValid = () =>
    isQualifying
      ? validators.nameValidator(4)(inputs[STRUCTURE_NAME].value)
      : validators.nameValidator(3)(inputs[DRAW_NAME].value);

  const checkParams = () => {
    const selectedDrawType = inputs[DRAW_TYPE]?.options?.[inputs[DRAW_TYPE].selectedIndex]?.getAttribute?.('value') ||
      inputs[DRAW_TYPE]?.value;
    if (selectedDrawType === CUSTOM_TOPOLOGY) {
      context.drawer.close();
      navigateToTopology({ eventId, drawId });
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
