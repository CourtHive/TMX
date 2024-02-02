import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';

import { DELETE_ADHOC_MATCHUPS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

export function matchUpActions({ pointerEvent, cell, matchUp, callback }) {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }

  const isAdHoc = !matchUp?.roundPosition && !matchUp?.drawPositions;

  const target = cell && pointerEvent.target.getElementsByClassName('fa-ellipsis-vertical')[0];
  const data = cell?.getRow().getData() || matchUp;

  const handleCallback = () => {
    if (isFunction(callback)) callback(data);
  };

  const items = [
    {
      onClick: handleCallback,
      text: 'Schedule',
    },
    {
      onClick: handleCallback,
      text: 'Start time',
    },
    {
      onClick: handleCallback,
      text: 'End time',
    },
    {
      onClick: handleCallback,
      text: 'Set referee',
    },
  ];

  if (isAdHoc)
    items.push({
      onClick: () => deleteAdHocMatchUp({ ...matchUp, callback: handleCallback }),
      text: 'Delete match',
      color: 'red',
    });

  tipster({ items, target: target || pointerEvent.target, config: { placement: BOTTOM } });
}

export function deleteAdHocMatchUp({ drawId, structureId, matchUpId, callback }) {
  const methods = [
    {
      method: DELETE_ADHOC_MATCHUPS,
      params: {
        matchUpIds: [matchUpId],
        removeIncomplete: true,
        removeCompleted: true,
        structureId,
        drawId,
      },
    },
  ];
  const postMutation = (result) => {
    if (result.success) {
      if (isFunction(callback)) callback();
    } else {
      console.log({ postMutationError: result.error });
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
