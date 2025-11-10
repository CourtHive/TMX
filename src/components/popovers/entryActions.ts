/**
 * Entry actions popover for participant status changes.
 * Provides options to move entries between accepted, qualifying, alternates, or withdrawn status.
 */
import { tournamentEngine, drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { modifyEntriesStatus } from '../tables/eventsTable/modifyEntriesStatus';
import { tipster } from 'components/popovers/tipster';
import { context } from 'services/context';

import { ACCEPTED, BOTTOM } from 'constants/tmxConstants';

const { ALTERNATE, DIRECT_ACCEPTANCE, WITHDRAWN, UNGROUPED } = entryStatusConstants;
const { QUALIFYING } = drawDefinitionConstants;

export const entryActions = (actions: string[], eventId: string, drawId?: string) => (e: MouseEvent, cell: any): void => {
  const { participant } = cell.getRow().getData();

  const modifyEntryStatus = (group: string) => () => {
    const callback = (result: any) => {
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

  const options = [
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
    const target = e.target as HTMLElement;
    tipster({ options, target, config: { placement: BOTTOM } });
  }
};
