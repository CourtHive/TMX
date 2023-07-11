import { getMatchUpFormat } from 'components/modals/matchUpFormat/matchUpFormat';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { tournamentEngine } from 'tods-competition-factory';
import { renderForm } from 'components/renderers/renderForm';
import { getFormRelationships } from './formRelationships';
import { tmxToast } from 'services/notifications/tmxToast';
import { getFormItems } from './getFormItems';
import { submitParams } from './submitParams';
import { context } from 'services/context';

import { RIGHT } from 'constants/tmxConstants';

export function addDraw({ eventId, callback }) {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const relationships = getFormRelationships();
  const items = getFormItems({ event });

  let inputs;
  const content = (elem) => {
    inputs = renderForm(elem, items, relationships);
  };

  const isValid = () => nameValidator(5)(inputs.drawName.value);

  const checkParams = () => {
    if (!isValid()) {
      tmxToast({ message: 'Missing Draw name', intent: 'is-danger' });
    } else if (inputs.matchUpFormat?.value === 'CUSTOM') {
      const setMatchUpFormat = (matchUpFormat) => {
        if (matchUpFormat) {
          submitParams({ event, inputs, callback, matchUpFormat });
        } else {
          console.log('ERROR');
        }
      };
      getMatchUpFormat({ callback: setMatchUpFormat });
    } else {
      submitParams({ event, inputs, callback });
    }
  };

  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Generate', intent: 'is-primary', onClick: checkParams, close: isValid }
  ];
  const title = `Configure draw`;

  const footer = (elem, close) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, context: 'tournament', side: RIGHT, width: '300px' });
}
