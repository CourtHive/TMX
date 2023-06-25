import { tournamentEngine, drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { modifyEntriesStatus } from '../tables/eventsTable/modifyEntriesStatus';
import { tipster } from 'components/popovers/tipster';
import { context } from 'services/context';

import { ACCEPTED, BOTTOM } from 'constants/tmxConstants';

const { ALTERNATE, DIRECT_ACCEPTANCE, WITHDRAWN, UNGROUPED } = entryStatusConstants;
const { QUALIFYING } = drawDefinitionConstants;

export const entryActions = (actions, eventId, drawId) => (e, cell) => {
  const { participant } = cell.getRow().getData();

  const modifyEntryStatus = (group) => () => {
    const callback = (result) => {
      if (result.success) {
        const row = cell.getRow();
        const targetGroup = group === ACCEPTED ? DIRECT_ACCEPTANCE : group;
        context.tables[targetGroup]?.addRow(row.getData());
        row.delete();
      } else {
        console.log({ result });
      }
    };

    const participantIds = [participant.participantId];
    modifyEntriesStatus({ participantIds, callback, eventId, drawId, group });
  };

  const destroyPairEntry = () => {
    const result = tournamentEngine.destroyPairEntry({
      participantIds: [participant.participantId],
      autoEntryPositions: true,
      eventId,
      drawId
    });
    console.log({ result });
  };

  let options = [
    {
      onClick: modifyEntryStatus(DIRECT_ACCEPTANCE),
      option: 'Move to accepted',
      action: ACCEPTED
    },
    {
      onClick: modifyEntryStatus(QUALIFYING),
      option: 'Move to qualifying',
      action: QUALIFYING
    },
    {
      onClick: modifyEntryStatus(ALTERNATE),
      option: 'Move to alternates',
      action: ALTERNATE
    },
    {
      onClick: destroyPairEntry,
      option: 'Unpair players',
      action: UNGROUPED
    },
    {
      onClick: modifyEntryStatus(WITHDRAWN),
      option: 'Withdraw participant',
      action: WITHDRAWN
    }
  ].filter((option) => actions.includes(option.action));

  if (options.length) {
    const target = e.target;
    tipster({ options, target, config: { placement: BOTTOM } });
  }
};
