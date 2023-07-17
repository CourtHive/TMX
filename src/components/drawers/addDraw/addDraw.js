import { getMatchUpFormat } from 'components/modals/matchUpFormat/matchUpFormat';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { getFormRelationships } from './formRelationships';
import { tmxToast } from 'services/notifications/tmxToast';
import { getFormItems } from './getFormItems';
import { submitParams } from './submitParams';
import { context } from 'services/context';

import { CUSTOM, DRAW_NAME, NONE, RIGHT, STRUCTURE_NAME } from 'constants/tmxConstants';

export function addDraw({ eventId, callback, drawId, drawName, isQualifying }) {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const relationships = getFormRelationships({ event, isQualifying });
  const items = getFormItems({ event, drawId, isQualifying });

  let inputs;
  const content = (elem) => {
    inputs = renderForm(elem, items, relationships);
  };

  const isValid = () =>
    isQualifying ? nameValidator(4)(inputs[STRUCTURE_NAME].value) : nameValidator(4)(inputs[DRAW_NAME].value);

  const checkParams = () => {
    if (!isValid()) {
      tmxToast({ message: 'Missing Draw name', intent: 'is-danger' });
    } else if (inputs.matchUpFormat?.value === CUSTOM) {
      const setMatchUpFormat = (matchUpFormat) => {
        if (matchUpFormat) {
          submitParams({ event, inputs, callback, matchUpFormat, drawId, drawName, isQualifying });
        }
      };
      getMatchUpFormat({ callback: setMatchUpFormat });
    } else {
      submitParams({ event, inputs, callback, drawId, drawName, isQualifying });
    }
  };

  const buttons = [
    { label: 'Cancel', intent: NONE, close: true },
    { label: 'Generate', intent: 'is-primary', onClick: checkParams, close: isValid }
  ];
  const title = `Configure draw`;

  const footer = (elem, close) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}
