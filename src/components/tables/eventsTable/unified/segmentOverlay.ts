/**
 * Context-aware overlay for unified entries table.
 * Computes the intersection of valid actions based on selected rows' segments.
 * Handles doubles pairing mode when selection is entirely within UNGROUPED.
 * Provides segment-scoped seeding controls.
 */
import { drawDefinitionConstants, entryStatusConstants, participantConstants } from 'tods-competition-factory';
import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { enableManualSeeding } from '../seeding/enableManualSeeding';
import { cancelManualSeeding } from '../seeding/cancelManualSeeding';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { generateSeedValues } from '../seeding/generateSeedValues';
import { modifyEntriesStatus } from '../modifyEntriesStatus';
import { tmxToast } from 'services/notifications/tmxToast';
import { changeEntryStatus } from '../changeEntryStatus';
import { clearSeeding } from '../seeding/removeSeeding';
import { saveSeeding } from '../seeding/saveSeeding';
import { pairFromUnified } from './pairFromUnified';
import { destroySelected } from '../destroyPairs';
import { addEntries } from '../addEntries';
import { addToDraw } from '../addToDraw';

// Constants
import { REMOVE_DRAW_ENTRIES, REMOVE_EVENT_ENTRIES } from 'constants/mutationConstants';
import { ACCEPTED, QUALIFYING, OVERLAY, RIGHT } from 'constants/tmxConstants';

const { MAIN, QUALIFYING: QUAL_STAGE } = drawDefinitionConstants;
const { ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { PAIR } = participantConstants;

const ACCEPTED_RANK = 0;
const QUALIFYING_RANK = 1;
const ALTERNATE_RANK = 2;
const UNGROUPED_RANK = 3;
const WITHDRAWN_RANK = 4;

// Valid move targets per segment rank
const MOVE_TARGETS: Record<number, string[]> = {
  [ACCEPTED_RANK]: [QUALIFYING, ALTERNATE, WITHDRAWN],
  [QUALIFYING_RANK]: [ACCEPTED, ALTERNATE, WITHDRAWN],
  [ALTERNATE_RANK]: [ACCEPTED, QUALIFYING, WITHDRAWN],
  [UNGROUPED_RANK]: [WITHDRAWN],
  [WITHDRAWN_RANK]: [ALTERNATE],
};

// Doubles: withdrawn can also move to UNGROUPED
const MOVE_TARGETS_DOUBLES: Record<number, string[]> = {
  ...MOVE_TARGETS,
  [WITHDRAWN_RANK]: [UNGROUPED],
};

function isSelectableForMove(p: any) {
  return !p._isSeparator && !p.drawPosition;
}

function pickParticipantId({ participantId }: any) {
  return participantId;
}

function runMoveSelection({
  table,
  group,
  eventId,
  drawId,
  onRefresh,
}: {
  table: any;
  group: string;
  eventId: string;
  drawId?: string;
  onRefresh: () => void;
}) {
  const selected = table.getSelectedData();
  const participantIds = selected.filter(isSelectableForMove).map(pickParticipantId);
  if (!participantIds.length) {
    table.deselectRow();
    tmxToast({
      message: selected.length ? 'Selected participants have assigned draw positions' : 'No participants selected',
      intent: 'is-warning',
    });
    return;
  }
  modifyEntriesStatus({
    participantIds,
    group,
    eventId,
    drawId,
    callback: (result: any) => {
      if (result?.success) {
        onRefresh();
        return;
      }
      table.deselectRow();
      tmxToast({ message: result.error?.message ?? 'Error moving participants', intent: 'is-danger' });
    },
  });
}

function getSelectedSegments(table: any): Set<number> {
  const selected = table.getSelectedData();
  const segments = new Set<number>();
  for (const row of selected) {
    if (!row._isSeparator) segments.add(row._segmentRank);
  }
  return segments;
}

function intersectMoveTargets(segments: Set<number>, isDoubles: boolean): string[] {
  const targetMap = isDoubles ? MOVE_TARGETS_DOUBLES : MOVE_TARGETS;
  let result: Set<string> | undefined;

  for (const seg of segments) {
    const targets = new Set(targetMap[seg] || []);
    result = result ? new Set([...result].filter((t) => targets.has(t))) : targets;
  }

  return result ? [...result] : [];
}

type OverlayParams = {
  event: any;
  drawId?: string;
  drawCreated: boolean;
  isDoubles: boolean;
  onRefresh: () => void;
};

export function getOverlayItems({ event, drawId, drawCreated, isDoubles, onRefresh }: OverlayParams): any[] {
  const eventId = event?.eventId;
  const items: any[] = [];

  // Move participants — intersection of valid targets for selected segments
  const moveHandler = (table: any): any => {
    const segments = getSelectedSegments(table);
    const targets = intersectMoveTargets(segments, isDoubles);

    if (!targets.length) return { location: OVERLAY, hide: true };

    const options = targets.map((group) => ({
      onClick: () => runMoveSelection({ table, group, eventId, drawId, onRefresh }),
      stateChange: true,
      label: group,
      value: group,
      close: true,
    }));

    return {
      label: 'Move participants',
      location: OVERLAY,
      options,
    };
  };

  items.push(moveHandler);

  // Change entry status — only for accepted segments
  const changeStatusHandler = (table: any): any => {
    const segments = getSelectedSegments(table);
    if (segments.size !== 1) return { location: OVERLAY, hide: true };
    const seg = [...segments][0];
    if (seg !== ACCEPTED_RANK && seg !== QUALIFYING_RANK) return { location: OVERLAY, hide: true };

    const stage = seg === QUALIFYING_RANK ? QUAL_STAGE : MAIN;
    const statusGroups = acceptedEntryStatuses(stage);
    return changeEntryStatus(statusGroups, eventId, drawId)(table);
  };

  items.push(changeStatusHandler);

  // Add to draw — available whenever draws exist on the event and the user is
  // on the all-entries view (drawId undefined). The previous `!drawCreated`
  // gate hid this even on the all-entries view once any draw existed; that
  // made it impossible to add event-only entries to an existing draw without
  // dropping back to factory calls. The inner addToDraw helper still hides
  // itself when drawId is set or no draws qualify.
  items.push((table: any) => {
    const segments = getSelectedSegments(table);
    if (segments.size !== 1) return { location: OVERLAY, hide: true };
    const seg = [...segments][0];
    if (seg !== ACCEPTED_RANK && seg !== QUALIFYING_RANK) return { location: OVERLAY, hide: true };
    return addToDraw(event, drawId, seg === QUALIFYING_RANK ? QUAL_STAGE : MAIN)(table);
  });

  // Remove from draw — available when drawId is set (viewing a specific draw)
  // and selected participants have no draw position assignment. The factory
  // returns EXISTING_PARTICIPANT_DRAW_POSITION_ASSIGNMENT for placed
  // participants; gate the option here too so the button doesn't appear
  // when nothing is removable.
  if (drawId) {
    items.push((table: any) => {
      const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
      if (!selected.length) return { location: OVERLAY, hide: true };
      const removable = selected.filter((r: any) => !r.drawPosition);
      if (!removable.length) return { location: OVERLAY, hide: true };

      return {
        onClick: () => {
          const participantIds = removable.map(({ participantId }: any) => participantId);
          const methods = [
            { method: REMOVE_DRAW_ENTRIES, params: { eventId, drawId, participantIds } },
          ];
          const postMutation = (result: any) => {
            if (result?.success) {
              table.deselectRow();
              onRefresh();
              return;
            }
            tmxToast({
              message: result?.error?.message ?? 'Error removing from draw',
              intent: 'is-danger',
            });
          };
          mutationRequest({ methods, callback: postMutation });
        },
        label: 'Remove from draw',
        intent: 'is-warning',
        location: OVERLAY,
      };
    });
  }

  // Destroy pairs — doubles; any selection of unplaced PAIR entries (accepted /
  // qualifying / alternate). Returns both individuals to the UNGROUPED segment.
  if (isDoubles) {
    items.push((table: any) => {
      const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
      const destroyable = selected.filter((r: any) => r.participant?.participantType === PAIR && !r.drawPosition);
      if (!selected.length || destroyable.length !== selected.length) return { location: OVERLAY, hide: true };
      return destroySelected(eventId, onRefresh, drawId)(table);
    });
  }

  // Create pair button — doubles, ungrouped only, exactly 2 selected
  if (isDoubles) {
    items.push((table: any) => {
      const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
      const segments = getSelectedSegments(table);
      if (segments.size !== 1 || !segments.has(UNGROUPED_RANK) || selected.length !== 2) {
        return { location: OVERLAY, hide: true };
      }

      return {
        onClick: () => {
          const ids: [string, string] = [selected[0].participantId, selected[1].participantId];
          table.deselectRow();
          pairFromUnified(event, ids, () => onRefresh());
        },
        label: 'Create pair',
        intent: 'is-info',
        location: OVERLAY,
      };
    });
  }

  // Remove from event — only when no draw created and selected entries have no draw position
  if (!drawCreated) {
    const removeHandler = (table: any): any => {
      const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
      if (!selected.length) return { location: OVERLAY, hide: true };

      // Only show when all selected have no draw position
      const removable = selected.filter((r: any) => !r.drawPosition);
      if (!removable.length) return { location: OVERLAY, hide: true };

      return {
        onClick: () => {
          const participantIds = removable.map(({ participantId }: any) => participantId);
          const methods = [{ method: REMOVE_EVENT_ENTRIES, params: { eventId, participantIds } }];
          const callback = (result: any) => {
            if (result?.success) {
              table.deselectRow();
              onRefresh();
            } else {
              tmxToast({ message: result?.error?.message ?? 'Error removing entries', intent: 'is-danger' });
            }
          };
          mutationRequest({ methods, callback });
        },
        label: 'Remove from event',
        intent: 'is-danger',
        location: OVERLAY,
      };
    };

    items.push(removeHandler);
  }

  return items;
}

type RightItemsParams = {
  event: any;
  drawCreated: boolean;
  isDoubles: boolean;
  pairingMode: { enabled: boolean };
  onRefresh: () => void;
};

export function getRightItems({ event, drawCreated, isDoubles, pairingMode, onRefresh }: RightItemsParams): any[] {
  const items: any[] = [];

  // Seeding — split into two compact dropdowns (Accepted + Qualifying).
  // Each dropdown contains only the actions for that segment, keeping
  // the menu short regardless of how many rating scales exist. This
  // prevents overflow on mobile views.
  if (!drawCreated) {
    const buildSeedingDropdown = (table: any, group: string, label: string) => {
      const seedingColumns = table
        .getColumns()
        .map((col: any) => col.getDefinition())
        .filter((def: any) => def.field?.startsWith('ratings.'));

      const options: any[] = [
        { label: 'Manual seeding', onClick: (e: any) => enableManualSeeding(e, table), close: true },
        { label: 'Clear seeding', onClick: () => clearSeeding({ event, table }), close: true },
        ...seedingColumns.map((column: any) => ({
          onClick: () => generateSeedValues({ event, group, table, field: column.field }),
          label: `Seed by ${column.title}`,
          close: true,
        })),
      ];

      return {
        class: 'seedingOptions',
        selection: false,
        location: RIGHT,
        align: RIGHT,
        options,
        label,
      };
    };

    items.push((table: any) => buildSeedingDropdown(table, ACCEPTED, 'Seeding'));
    items.push((table: any) => buildSeedingDropdown(table, QUALIFYING, 'Seeding (Q)'));
    items.push(cancelManualSeeding(event));
    items.push(saveSeeding(event));
  }

  // Add entries — with segment target
  if (!drawCreated) {
    const addEntriesHandler = (table: any): any => {
      const addAccepted = addEntries(event, ACCEPTED, onRefresh)(table);
      const addQualifying = addEntries(event, QUALIFYING, onRefresh)(table);
      const addAlternate = addEntries(event, ALTERNATE, onRefresh)(table);

      const options: any[] = [
        { label: 'Add to Accepted', onClick: addAccepted.onClick, close: true },
        { label: 'Add to Qualifying', onClick: addQualifying.onClick, close: true },
        { label: 'Add to Alternates', onClick: addAlternate.onClick, close: true },
      ];

      return {
        label: 'Add entries',
        class: 'addEntries',
        location: RIGHT,
        options,
      };
    };

    items.push(addEntriesHandler);
  }

  // Pairing mode toggle for doubles
  if (isDoubles && !drawCreated) {
    items.push({
      onClick: (e: any) => {
        const button = e.target.closest('button');
        pairingMode.enabled = !pairingMode.enabled;
        button.innerHTML = `Pairing: ${pairingMode.enabled ? 'ON' : 'OFF'}`;
        button.className = button.className.replace(/is-\w+/, pairingMode.enabled ? 'is-info' : 'is-light');
      },
      label: 'Pairing: OFF',
      intent: 'is-light',
      id: 'pairing-mode-toggle',
      location: RIGHT,
    });
  }

  return items;
}
