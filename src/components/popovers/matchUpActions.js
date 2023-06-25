import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export function matchUpActions(e, cell) {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = e.target.getElementsByClassName('fa-ellipsis-vertical')[0];
  const data = cell.getRow().getData();
  const callback = (data) => console.log(data);
  const items = [
    {
      text: 'Schedule',
      onClick: () => callback(data)
    },
    {
      text: 'Start time',
      onClick: () => callback(data)
    },
    {
      text: 'End Time',
      onClick: () => callback(data)
    },
    {
      text: 'Set Referee',
      onClick: () => callback(data)
    },
    {
      text: 'Delegate',
      onClick: () => callback(data)
    }
  ];

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
}
