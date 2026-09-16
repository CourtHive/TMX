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
import { inheritedEntryStage, PAIR_SEGMENTS } from './pairSegment';
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
import { ACCEPTED, QUALIFYING, OVERLAY, RIGHT, LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';

const { MAIN, QUALIFYING: QUAL_STAGE } = drawDefinitionConstants;
const { ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { PAIR } = participantConstants;

const pairingLabel = (enabled: boolean) => (enabled ? t('segmentOverlay.pairingOn') : t('segmentOverlay.pairingOff'));

const PAIR_SEGMENT_LABEL_KEYS: Record<string, string> = {
  [ALTERNATE]: 'segmentOverlay.pairAsAlternate',
  [ACCEPTED]: 'segmentOverlay.pairAsAccepted',
  [QUALIFYING]: 'segmentOverlay.pairAsQualifying',
};

const segmentName = (segment: string) => t(PAIR_SEGMENT_LABEL_KEYS[segment] ?? PAIR_SEGMENT_LABEL_KEYS[ALTERNATE]);

const pairSegmentLabel = (segment: string) => `${t('segmentOverlay.pairAs')}: ${segmentName(segment)}`;

// The overlay replaces the pairing row the moment rows are selected, so by the time this button is
// on screen its governing toggle is not — the destination has to be stated on the button itself.
const createPairLabel = (segment: string) => `${t('segmentOverlay.createPairAs')} ${segmentName(segment)}`;

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

export type PairingMode = {
  enabled: boolean;
  /** TMX segment the next created pair enters as: ACCEPTED | QUALIFYING | ALTERNATE. */
  segment: string;
};

type OverlayParams = {
  event: any;
  drawId?: string;
  drawCreated: boolean;
  isDoubles: boolean;
  pairingMode: PairingMode;
  onRefresh: () => void;
};

export function getOverlayItems({
  event,
  drawId,
  drawCreated,
  isDoubles,
  pairingMode,
  onRefresh,
}: OverlayParams): any[] {
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
      label: t('segmentOverlay.moveParticipants'),
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
          pairFromUnified({
            event,
            participantIds: ids,
            segment: pairingMode.segment,
            entryStage: inheritedEntryStage(selected, pairingMode.segment),
            drawId,
            callback: () => onRefresh(),
          });
        },
        label: createPairLabel(pairingMode.segment),
        intent: 'is-info',
        location: OVERLAY,
      };
    });
  }

  // Remove from draw — available when drawId is set (viewing a specific draw)
  // and selected participants have no draw position assignment. The factory
  // returns EXISTING_PARTICIPANT_DRAW_POSITION_ASSIGNMENT for placed
  // participants; gate the option here too so the button doesn't appear
  // when nothing is removable.
  //
  // Ordered beside "Remove from event" rather than before the pairing actions so the removal is
  // last in both views. The two never co-occur — `drawId` implies `drawCreated` — so this is the
  // same slot in the draw-entries view that "Remove from event" occupies on the all-entries view.
  if (drawId) {
    items.push((table: any) => {
      const selected = table.getSelectedData().filter((r: any) => !r._isSeparator);
      if (!selected.length) return { location: OVERLAY, hide: true };
      const removable = selected.filter((r: any) => !r.drawPosition);
      if (!removable.length) return { location: OVERLAY, hide: true };

      return {
        onClick: () => {
          const participantIds = removable.map(({ participantId }: any) => participantId);
          const methods = [{ method: REMOVE_DRAW_ENTRIES, params: { eventId, drawId, participantIds } }];
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
        label: t('segmentOverlay.removeFromDraw'),
        intent: 'is-warning',
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
        label: t('segmentOverlay.removeFromEvent'),
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
  pairingMode: PairingMode;
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
        { label: t('segmentOverlay.manualSeeding'), onClick: (e: any) => enableManualSeeding(e, table), close: true },
        { label: t('segmentOverlay.clearSeeding'), onClick: () => clearSeeding({ event, table }), close: true },
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
        { label: t('segmentOverlay.addToAccepted'), onClick: addAccepted.onClick, close: true },
        { label: t('segmentOverlay.addToQualifying'), onClick: addQualifying.onClick, close: true },
        { label: t('segmentOverlay.addToAlternates'), onClick: addAlternate.onClick, close: true },
      ];

      return {
        label: t('segmentOverlay.addEntries'),
        class: 'addEntries',
        location: RIGHT,
        options,
      };
    };

    items.push(addEntriesHandler);
  }

  // ── Pairing row (doubles) ──
  //
  // Both controls set state consumed at pair-creation time, and the controlBar hides
  // `options_left` whenever rows are selected — so they are deliberately pre-selection controls:
  // choose the mode and the target segment first, then select the two individuals.
  //
  // Rendered in the draw-entries view as well as the all-entries view. They used to be gated on
  // `!drawCreated`, which hid them in exactly the view where "Create pair" is offered.
  if (isDoubles) {
    items.push({
      onClick: (e: any) => {
        const button = e.target.closest('button');
        pairingMode.enabled = !pairingMode.enabled;
        button.innerHTML = pairingLabel(pairingMode.enabled);
        button.className = button.className.replace(/is-\w+/, pairingMode.enabled ? 'is-info' : 'is-light');
      },
      label: pairingLabel(pairingMode.enabled),
      intent: pairingMode.enabled ? 'is-info' : 'is-light',
      id: 'pairing-mode-toggle',
      location: LEFT,
    });

    // Segment selector — cycles rather than drops down, matching its neighbour. A created pair
    // enters the event (and, in a draw view, the draw) as this segment instead of the ALTERNATE
    // that used to be hardcoded, so pairing no longer forces a demotion to alternate.
    items.push({
      onClick: (e: any) => {
        const button = e.target.closest('button');
        const index = PAIR_SEGMENTS.indexOf(pairingMode.segment);
        pairingMode.segment = PAIR_SEGMENTS[(index + 1) % PAIR_SEGMENTS.length];
        button.innerHTML = pairSegmentLabel(pairingMode.segment);
      },
      label: pairSegmentLabel(pairingMode.segment),
      intent: 'is-light',
      id: 'pair-segment-toggle',
      location: LEFT,
    });
  }

  return items;
}
