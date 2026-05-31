import { competitionEngine } from 'services/factory/engine';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { tmx2db } from 'services/storage/tmx2db';
import { tools } from 'tods-competition-factory';

import { COMPETITION_ENGINE } from 'constants/tmxConstants';

export type SchedulingMode = 'grid' | 'profile' | 'availability';

interface QueuedBatch {
  mode: SchedulingMode;
  methods: any[];
}

type Listener = () => void;

let bulkMode = false;
let pendingBatches: QueuedBatch[] = [];
// Painter dirty state lives outside the bulk-batches queue because the
// AvailabilityGrid component holds its in-progress edits internally — they
// don't materialize as method arrays until the painter's save runs. The
// workspace surfaces this via the same hasUnsavedChanges() / save / discard
// affordances as the bulk queue so the user has one consistent indicator.
let availabilityDirty = false;
let availabilitySave: (() => void) | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isBulkMode(): boolean {
  return bulkMode;
}

export function getPendingCount(): number {
  return pendingBatches.length + (availabilityDirty ? 1 : 0);
}

export function hasUnsavedChanges(): boolean {
  if (availabilityDirty) return true;
  return bulkMode && pendingBatches.length > 0;
}

/**
 * Register the painter's dirty state with the workspace queue. When `dirty`
 * is true, the workspace's hasUnsavedChanges() / sticky save bar reflects it.
 * The `save` callback is invoked by savePending() when the workspace Save
 * button is clicked; it should commit the painter's in-progress edits.
 *
 * Pass `dirty=false, save=null` to unregister (called on mode destroy).
 */
export function setAvailabilityDirty(dirty: boolean, save: (() => void) | null): void {
  availabilityDirty = dirty;
  availabilitySave = save;
  notify();
}

export function setBulkMode(enabled: boolean): boolean {
  if (bulkMode === enabled) return bulkMode;
  if (!enabled && pendingBatches.length > 0) {
    void discardPending();
  }
  bulkMode = enabled;
  notify();
  return bulkMode;
}

interface ExecuteOptions {
  mode: SchedulingMode;
  methods: any[];
  onRefresh?: () => void;
}

export function executeMethods({ mode, methods, onRefresh }: ExecuteOptions): void {
  if (!bulkMode) {
    mutationRequest({
      methods,
      engine: COMPETITION_ENGINE,
      callback: (result: any) => {
        if (!result?.success) console.error('[scheduling] mutation error', result);
        onRefresh?.();
      },
    });
    return;
  }

  const directives = tools.makeDeepCopy(methods);
  const result = competitionEngine.executionQueue(directives, true);
  if (result?.error) {
    console.error('[scheduling] local execution error', result);
    tmxToast({ message: 'Schedule change failed locally', intent: 'is-danger' });
    return;
  }

  pendingBatches.push({ mode, methods });
  onRefresh?.();
  notify();
}

export async function savePending(): Promise<void> {
  // Painter save fires first so its mutations land before any bulk batches.
  // The painter's save dispatches via mutationRequest itself (through the
  // onMutationMethods callback wiring), so we don't need to merge methods.
  if (availabilityDirty && availabilitySave) {
    availabilitySave();
  }

  if (!pendingBatches.length) return;

  const allMethods = pendingBatches.flatMap((batch) => batch.methods);
  const count = pendingBatches.length;
  pendingBatches = [];
  notify();

  mutationRequest({
    methods: allMethods,
    engine: COMPETITION_ENGINE,
    callback: (result: any) => {
      if (result?.success || !result?.error) {
        tmxToast({ message: `Saved ${count} scheduling changes`, intent: 'is-success' });
      } else {
        console.error('[scheduling] bulk save error', result);
        tmxToast({ message: 'Failed to save scheduling changes to server', intent: 'is-danger' });
      }
    },
  });
}

export async function discardPending(): Promise<void> {
  if (!pendingBatches.length) {
    pendingBatches = [];
    notify();
    return;
  }

  const tournamentId = competitionEngine.getTournamentInfo()?.tournamentInfo?.tournamentId;
  if (!tournamentId) {
    pendingBatches = [];
    notify();
    return;
  }

  try {
    const record = await tmx2db.findTournament(tournamentId);
    if (record) competitionEngine.setState(record);
  } catch (err) {
    console.error('[scheduling] failed to reload from IndexedDB', err);
  }

  pendingBatches = [];
  tmxToast({ message: 'Scheduling changes discarded', intent: 'is-warning' });
  notify();
}

export function resetQueue(): void {
  bulkMode = false;
  pendingBatches = [];
  availabilityDirty = false;
  availabilitySave = null;
  notify();
}
