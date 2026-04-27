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

function onModifyEntryStatusResult(result: any, cell: any, group: string) {
  if (!result.success) {
    console.log({ result });
    return;
  }
  const row = cell.getRow();
  const targetGroup = group === ACCEPTED ? DIRECT_ACCEPTANCE : group;
  context.tables[targetGroup]?.addRow(row.getData());
  row.delete();
}

export const entryActions = (actions: string[], eventId: string, drawId?: string) => (e: MouseEvent, cell: any): void => {
  const rowData = cell.getRow().getData();
  const { participant } = rowData;
  const hasDrawPosition = !!rowData.drawPosition;

  const runModifyEntryStatus = (group: string) => {
    modifyEntriesStatus({
      participantIds: [participant.participantId],
      callback: (result: any) => onModifyEntryStatusResult(result, cell, group),
      eventId,
      drawId,
      group,
    });
  };
  const modifyEntryStatus = (group: string) => () => runModifyEntryStatus(group);

  const destroyPairEntry = () => {
    const result = tournamentEngine.destroyPairEntry({
      participantIds: [participant.participantId],
      autoEntryPositions: true,
      eventId,
      drawId
    });
    console.log({ result });
  };

  // When a participant has a draw position, moving to alternates or withdrawing
  // would fail because the participant is already placed in the draw
  const blockedByDrawPosition = hasDrawPosition ? [ALTERNATE, WITHDRAWN] : [];

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
  ].filter((option) => actions.includes(option.action) && !blockedByDrawPosition.includes(option.action));

  if (options.length) {
    const target = e.target as HTMLElement;
    tipster({ options, target, config: { placement: BOTTOM } });
  }
};
