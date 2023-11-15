import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderButtons } from 'components/renderers/renderButtons';
import { getAvoidanceFormItems } from './getAvoidanceFormItems';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { avoidanceRules } from './avoidanceRules';
import { context } from 'services/context';

import { ATTACH_EVENT_POLICIES } from 'constants/mutationConstants';
import { NONE, RIGHT } from 'constants/tmxConstants';

export function editAvoidances({ eventId }) {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const { items } = getAvoidanceFormItems({ event });

  let inputs;
  const isValid = true;
  const content = (elem) => (inputs = renderForm(elem, items));

  const getChecked = () => {
    const filteredInputs = Object.keys(inputs).filter((key) => inputs[key].checked);
    const policyAttributes = filteredInputs.flatMap((key) => avoidanceRules[key]).filter(Boolean);
    const methods = [
      {
        method: ATTACH_EVENT_POLICIES,
        params: {
          policyDefinitions: { avoidance: { policyAttributes } },
          allowReplacement: true,
          eventId
        }
      }
    ];
    const postMutation = (result) => {
      if (result.success) {
        const isSuccess = 'is-success';
        const editAvoidancesButton = document.getElementById('editAvoidances');
        if (editAvoidancesButton) {
          if (policyAttributes.length) {
            editAvoidancesButton.classList.add(isSuccess);
          } else {
            editAvoidancesButton.classList.remove(isSuccess);
          }
        }
      } else {
        tmxToast({ message: 'Error', intent: 'is-danger' });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const buttons = [
    { label: 'Cancel', intent: NONE, close: true },
    { label: 'Save', id: 'setAvoidances', intent: 'is-info', onClick: getChecked, close: isValid }
  ];
  const title = `Set avoidances`;

  const footer = (elem, close) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}
