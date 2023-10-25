import { editEvent } from 'Pages/Tournament/Tabs/eventsTab/editEvent';
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

  const callback = ({ success, eventUpdates }) => {
    if (success) {
      const row = cell.getRow();
      const eventRow = row?.getData();
      Object.assign(eventRow.event, eventUpdates);
      row.update(eventRow);
    }
  };

  const items = [
    {
      onClick: () => callback('Delete', data),
      text: 'Delete'
    },
    {
      onClick: () => editEvent({ event: data.event, callback }),
      text: 'Edit'
    }
  ];

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
}
