import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export function eventActions(e, cell) {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = e.target.getElementsByClassName('fa-ellipsis-vertical')[0];
  const data = cell.getRow().getData();
  const callback = (message, data) => console.log(message, data);
  const items = [
    {
      text: 'Delete',
      onClick: () => callback('Delete', data)
    },
    {
      text: 'Edit',
      onClick: () => callback('Edit', data)
    }
  ];

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
}
