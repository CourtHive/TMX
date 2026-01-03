/**
 * Add draw configuration drawer.
 * Provides form for creating new draw/flight with matchUp format and generation options.
 */
import { getMatchUpFormatModal } from 'courthive-components';
import { getDrawFormRelationships } from './getDrawFormRelationships';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { getDrawFormItems } from './getDrawFormItems';
import { submitDrawParams } from './submitDrawParams';
import { context } from 'services/context';

import { CUSTOM, DRAW_NAME, NONE, RIGHT, STRUCTURE_NAME } from 'constants/tmxConstants';

type AddDrawParams = {
  eventId: string;
  callback?: (result: any) => void;
  drawId?: string;
  drawName?: string;
  structureId?: string;
  isQualifying?: boolean;
};

export function addDraw({ eventId, callback, drawId, drawName, structureId, isQualifying }: AddDrawParams): void {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const { items, structurePositionAssignments } = getDrawFormItems({ event, drawId, isQualifying, structureId });
  const relationships = getDrawFormRelationships({
    maxQualifiers: structurePositionAssignments?.length,
    isQualifying,
    event,
  });

  let inputs: any;
  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
  };

  const isValid = () =>
    isQualifying ? nameValidator(4)(inputs[STRUCTURE_NAME].value) : nameValidator(4)(inputs[DRAW_NAME].value);

  const checkParams = () => {
    if (!isValid()) {
      tmxToast({ message: 'Missing Draw name', intent: 'is-danger' });
    } else if (inputs.matchUpFormat?.value === CUSTOM) {
      const setMatchUpFormat = (matchUpFormat: string) => {
        if (matchUpFormat) {
          (submitDrawParams as any)({ event, inputs, callback, structureId, matchUpFormat, drawId, drawName, isQualifying });
        }
      };
      (getMatchUpFormatModal as any)({ 
        callback: setMatchUpFormat,
        modalConfig: {
          style: {
            fontSize: '12px',
            border: '3px solid #0066cc',
          }
        }
      });
    } else {
      (submitDrawParams as any)({ event, inputs, callback, structureId, drawId, drawName, isQualifying });
    }
  };

  const buttons = [
    { label: 'Cancel', intent: NONE, close: true },
    { label: 'Generate', id: 'generateDraw', intent: 'is-primary', onClick: checkParams, close: isValid },
  ];
  const title = `Configure draw`;

  const footer = (elem: HTMLElement, close: () => void) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}
