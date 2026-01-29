/**
 * Edit avoidance policies drawer.
 * Configures participant avoidance rules (country, club, etc.) via policy attachments.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderButtons, renderForm } from 'courthive-components';
import { getAvoidanceFormItems } from './getAvoidanceFormItems';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { avoidanceRules } from './avoidanceRules';
import { context } from 'services/context';

import { ATTACH_POLICIES } from 'constants/mutationConstants';
import { NONE, RIGHT } from 'constants/tmxConstants';

export function editAvoidances({ eventId }: { eventId: string }): void {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const { items } = getAvoidanceFormItems({ event });

  let inputs: any;
  const isValid = true;
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, items));

  const getChecked = () => {
    const filteredInputs = Object.keys(inputs).filter((key) => inputs[key].checked);
    const policyAttributes = filteredInputs.flatMap((key) => avoidanceRules[key]).filter(Boolean);
    const methods = [
      {
        method: ATTACH_POLICIES,
        params: {
          policyDefinitions: { avoidance: { policyAttributes } },
          allowReplacement: true,
          eventId,
        },
      },
    ];
    const postMutation = (result: any) => {
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
    { label: 'Save', id: 'setAvoidances', intent: 'is-info', onClick: getChecked, close: isValid },
  ];
  const title = `Set avoidances`;

  const footer = (elem: HTMLElement, close: () => void) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}
