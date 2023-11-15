import { renderButtons } from 'components/renderers/renderButtons';
import { getAvoidanceFormItems } from './getAvoidanceFormItems';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { NONE, RIGHT } from 'constants/tmxConstants';

export function editAvoidances({ eventId }) {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const { items } = getAvoidanceFormItems({ event });

  let inputs;
  const isValid = true;
  const content = (elem) => {
    inputs = renderForm(elem, items);
  };

  /*
  {
    "method": "attachEventPolicies",
    "params": {
        "eventId": "40cb3fb6-event-1",
        "allowReplacement": true,
        "policyDefinitions": {
            "avoidance": {
                "policyAttributes": [
                    { "key": "person.addresses.city" },
                    { "key": "individualParticipants.person.addresses.city" },
                    { "key": "person.addresses.state" },
                    { "key": "individualParticipants.person.addresses.state" },
                    { "key": "person.addresses.postalCode", "significantCharacters": 5 },
                    { "key": "individualParticipants.person.addresses.postalCode", "significantCharacters": 5 },
                    { "key": "person.addresses.country" },
                    { "key": "individualParticipants.person.addresses.country" },
                    { "directive": "pairParticipants" },
                    { "directive": "groupParticipants" }
                ]
            }
        }
    }
}
  */
  const getChecked = () => {
    console.log({ inputs });
  };
  const buttons = [
    { label: 'Cancel', intent: NONE, close: true },
    { label: 'Save', id: 'setAvoidances', intent: 'is-info', onClick: getChecked, close: isValid }
  ];
  const title = `Set avoidances`;

  const footer = (elem, close) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}
