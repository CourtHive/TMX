import { canUseDemoClock, getDemoClock, isDemoClockSessionEligible, onDemoClockChange } from './demoClock';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { tournamentEngine } from 'services/factory/engine';
import { venueTimeZone } from 'functions/venueTimeFrame';
import { version } from 'tods-competition-factory';

// constants and types
import type { AppliedMutation } from 'services/mutation/mutationObservers';
import type { MutationMethod } from 'types/services';

export type WalkthroughStep = {
  sequence: number;
  time: number;
  route: string;
  kind: 'clock' | 'navigation' | 'mutation' | 'state';
  methods?: MutationMethod[];
  tournament?: any;
};
export type DemoWalkthrough = {
  schema: 'courthive.demo-walkthrough';
  schemaVersion: 1;
  factoryVersion: string;
  tournamentId: string;
  timeZone: string;
  startedAt: string;
  stoppedAt?: string;
  stopReason?: 'user' | 'clock-exit' | 'limit';
  initialTime: number;
  initialRoute: string;
  initialTournament: any;
  steps: WalkthroughStep[];
};

const MAX_STEPS = 1000;
const MAX_BYTES = 25 * 1024 * 1024;
const encoder = new TextEncoder();
const observers = new Set<() => void>();
let capture: DemoWalkthrough | undefined;
let recording = false;
let bytes = 0;
let lastTime = 0;
let lastRecord = '';
let detach: (() => void) | undefined;
const route = () => globalThis.location?.hash ?? '';

function changed(): void {
  for (const observer of observers) observer();
}

export function onWalkthroughChange(observer: () => void): () => void {
  observers.add(observer);
  return () => {
    observers.delete(observer);
  };
}

export function getWalkthroughStatus() {
  return { available: !!capture, recording, steps: capture?.steps.length ?? 0, stopReason: capture?.stopReason };
}

/** Capture is opt-in and remains in this tab; export is an explicit UI action. */
export function getDemoWalkthrough(): DemoWalkthrough | undefined {
  return capture ? structuredClone(capture) : undefined;
}

export function stopDemoWalkthrough(reason: DemoWalkthrough['stopReason'] = 'user'): void {
  if (!capture || !recording) return;
  recording = false;
  capture.stoppedAt = new Date().toISOString();
  capture.stopReason = reason;
  detach?.();
  detach = undefined;
  changed();
}

export function clearDemoWalkthrough(): void {
  stopDemoWalkthrough();
  capture = undefined;
  bytes = 0;
  changed();
}

function append(step: Omit<WalkthroughStep, 'sequence' | 'route' | 'time'>): void {
  if (!recording || !capture) return;
  const entry = { ...step, sequence: capture.steps.length + 1, route: route(), time: lastTime };
  const serialized = JSON.stringify(entry);
  const size = encoder.encode(serialized).byteLength;
  if (capture.steps.length >= MAX_STEPS || bytes + size > MAX_BYTES) {
    stopDemoWalkthrough('limit');
    return;
  }
  bytes += size;
  capture.steps.push(JSON.parse(serialized));
  changed();
}

function captureMutation(details?: AppliedMutation): void {
  if (!canUseDemoClock() || !capture) return;
  if (details?.tournamentId && details.tournamentId !== capture.tournamentId) return;
  const record = tournamentEngine.getTournament().tournamentRecord;
  if (record?.tournamentId !== capture.tournamentId) return;
  const serialized = JSON.stringify(record);
  if (!details?.methods?.length && serialized === lastRecord) return;
  lastRecord = serialized;
  append({ kind: details?.methods?.length ? 'mutation' : 'state', methods: details?.methods, tournament: record });
}

export function startDemoWalkthrough(): boolean {
  const clock = getDemoClock();
  const timeZone = venueTimeZone();
  if (!clock || !timeZone || !canUseDemoClock() || recording) return false;
  const initialTournament = tournamentEngine.getTournament().tournamentRecord;
  lastRecord = JSON.stringify(initialTournament);
  bytes = encoder.encode(lastRecord).byteLength;
  if (bytes > MAX_BYTES) return false;
  capture = {
    schema: 'courthive.demo-walkthrough',
    schemaVersion: 1,
    factoryVersion: version(),
    tournamentId: clock.tournamentId,
    timeZone,
    startedAt: new Date().toISOString(),
    initialTime: clock.nowMs,
    initialRoute: route(),
    initialTournament,
    steps: [],
  };
  lastTime = clock.nowMs;
  recording = true;
  const offClock = onDemoClockChange(() => {
    const next = getDemoClock();
    if (!next || !canUseDemoClock()) {
      stopDemoWalkthrough('clock-exit');
      return;
    }
    if (next.nowMs !== lastTime) {
      lastTime = next.nowMs;
      append({ kind: 'clock' });
    }
  });
  const offMutation = onMutationApplied(captureMutation);
  const navigation = () => append({ kind: 'navigation' });
  globalThis.addEventListener?.('hashchange', navigation);
  detach = () => {
    offClock();
    offMutation();
    globalThis.removeEventListener?.('hashchange', navigation);
  };
  changed();
  return true;
}

/** Download uses the app's browser/Electron export adapter; no network or automatic upload. */
export async function exportDemoWalkthrough(): Promise<void> {
  if (!isDemoClockSessionEligible()) return;
  stopDemoWalkthrough();
  const artifact = getDemoWalkthrough();
  if (!artifact) return;
  const { downloadJSON } = await import('services/export/download');
  await downloadJSON(`demo-walkthrough-${Date.now()}.json`, artifact);
}
