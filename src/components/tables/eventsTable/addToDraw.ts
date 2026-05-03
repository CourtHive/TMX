/**
 * Add selected participants to event draws.
 * Provides dropdown menu of available draws with direct acceptance entry status.
 *
 * "Available" excludes draws that every selected participant is already in,
 * and on click, participants already in the target draw are filtered out
 * (with a toast describing partial/no-op outcomes).
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';

import { ADD_DRAW_ENTRIES } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

const isInDraw = (row: any, drawId: string): boolean =>
  (row.flights || []).some((f: any) => f.drawId === drawId);

const addTo = (table: any, event: any, drawId: string): void => {
  const eventId = event.eventId;
  const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
  const eligible = selected.filter((p: any) => !isInDraw(p, drawId));

  if (!eligible.length) {
    tmxToast({
      message: 'All selected participants are already in this draw',
      intent: 'is-warning',
    });
    return;
  }

  const skipped = selected.length - eligible.length;
  const participantIds = eligible.map(({ participantId }: any) => participantId);
  const drawName = event.drawDefinitions?.find((dd: any) => dd.drawId === drawId)?.drawName;

  const methods = [
    {
      method: ADD_DRAW_ENTRIES,
      params: {
        entryStatus: DIRECT_ACCEPTANCE,
        ignoreStageSpace: true,
        entryStage: MAIN,
        participantIds,
        eventId,
        drawId,
      },
    },
  ];
  const postMutation = (result: any) => {
    if (!result?.success) {
      tmxToast({ message: result?.error?.message ?? 'Error adding to draw', intent: 'is-danger' });
      return;
    }

    table.deselectRow();
    for (const pid of participantIds) {
      const row = table.getRow(pid);
      if (!row) continue;
      const rowData = row.getData();
      const flights = [...(rowData.flights || []), { drawId, drawName, eventId }];
      row.update({ flights });
    }
    if (skipped) {
      tmxToast({
        message: `Added ${participantIds.length} to ${drawName} (${skipped} already entered)`,
        intent: 'is-info',
      });
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

export const addToDraw = (event: any, drawId?: string) => (table: any): any => {
  const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
  const allDraws = (event.drawDefinitions || []).filter(Boolean);

  // A draw is offered when at least one selected participant is not yet
  // entered in it. With no selection, fall back to all draws so the
  // dropdown still renders sensibly during initial control bar evaluation.
  const availableDraws = selected.length
    ? allDraws.filter((dd: any) => selected.some((p: any) => !isInDraw(p, dd.drawId)))
    : allDraws;

  const options = availableDraws.map(({ drawName, drawId: ddId }: any) => ({
    onClick: () => addTo(table, event, ddId),
    stateChange: true,
    label: drawName,
    value: ddId,
    close: true,
  }));

  return {
    hide: !options.length || !!drawId,
    label: 'Add to draw',
    location: OVERLAY,
    options,
  };
};
