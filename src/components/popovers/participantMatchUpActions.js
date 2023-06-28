import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export function participantActions(e, cell) {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const data = cell.getRow().getData();
  const def = cell.getColumn().getDefinition();
  const participantPresent =
    (data.side1?.participantName && def.field === 'side1') || (data.side2?.participantName && def.field === 'side2');
  if (participantPresent) {
    const callback = (data) => console.log(data);
    const items = [
      {
        text: 'Assess Penalty',
        onClick: () => callback(data)
      }
    ];

    tipster({ items, target: e.target, config: { placement: BOTTOM } });
  }
}
