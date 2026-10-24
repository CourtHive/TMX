import { randomId } from 'functions/randomId';

/** A recoverable bulk preview, owned independently of its rendered grid and of IndexedDB. */
interface Snapshot {
  tournamentId?: string;
  tournamentRecords: Record<string, any>;
}
interface DraftEngine {
  getState: () => Snapshot;
  setState: (records: Record<string, any>) => any;
  executionQueue: (methods: any[], rollbackOnError: boolean) => any;
  setTournamentId: (id: string) => any;
}
interface Result {
  success?: boolean;
  error?: any;
}

const same = (a: any, b: any): boolean => JSON.stringify(a) === JSON.stringify(b);
const object = (value: any): boolean => !!value && typeof value === 'object' && !Array.isArray(value);
const ID_KEYS = [
  'tournamentId',
  'eventId',
  'drawId',
  'structureId',
  'matchUpId',
  'participantId',
  'venueId',
  'courtId',
  'extensionName',
];

/** Revert only preview-owned fields. Concurrent fields and newly received objects survive discard. */
function restoreFields(before: any, preview: any, current: any, field?: string): any {
  if (same(before, preview)) return current;
  if (same(current, preview)) return structuredClone(before);
  if (
    field === 'timeItems' &&
    (preview === undefined || Array.isArray(preview)) &&
    (before === undefined || Array.isArray(before)) &&
    Array.isArray(current)
  ) {
    return restoreTimeItems(before ?? [], preview ?? [], current);
  }
  if (object(before) && object(preview) && object(current)) return restoreObject(before, preview, current);
  if (Array.isArray(before) && Array.isArray(preview) && Array.isArray(current)) {
    const key = ID_KEYS.find((id) =>
      [...before, ...preview, ...current].every((value) => object(value) && typeof value[id] === 'string'),
    );
    if (key) {
      const restored = current
        .map((value) =>
          restoreFields(
            before.find((item) => item[key] === value[key]),
            preview.find((item) => item[key] === value[key]),
            value,
          ),
        )
        .filter((value) => value !== undefined);
      for (const value of before) {
        if (!preview.some((item) => item[key] === value[key]) && !current.some((item) => item[key] === value[key])) {
          restored.push(structuredClone(value));
        }
      }
      return restored;
    }
  }
  // The same field changed remotely. That newer value supersedes the preview.
  return current;
}

/** timeItems are an append-only history, not one scalar field. Undo the preview's multiset delta. */
function restoreTimeItems(before: any[], preview: any[], current: any[]): any[] {
  const difference = (left: any[], right: any[]) => {
    const remaining = [...right];
    return left.filter((item) => {
      const index = remaining.findIndex((candidate) => same(item, candidate));
      if (index < 0) return true;
      remaining.splice(index, 1);
      return false;
    });
  };
  const restored = [...current];
  for (const item of difference(preview, before)) {
    const index = restored.findIndex((candidate) => same(item, candidate));
    if (index >= 0) restored.splice(index, 1);
  }
  for (const item of difference(before, preview)) {
    if (!restored.some((candidate) => same(item, candidate))) {
      restored.splice(Math.min(before.indexOf(item), restored.length), 0, structuredClone(item));
    }
  }
  return restored;
}

function restoreObject(before: any, preview: any, current: any): any {
  const restored = { ...current };
  for (const key of new Set([...Object.keys(before), ...Object.keys(preview)])) {
    const value = restoreFields(before[key], preview[key], current[key], key);
    if (value === undefined) delete restored[key];
    else restored[key] = value;
  }
  return restored;
}

export class BulkScheduleDraft {
  pending: any[][] = [];
  saving = false;
  commandId = randomId();
  private submittedMethods?: string;
  private baseline?: Snapshot;
  private preview?: Snapshot;
  private ownsInstalledRecord: () => boolean = () => true;

  stage(methods: any[], engine: DraftEngine, isCurrent: () => boolean = () => true): Result {
    if (this.saving) return { error: 'Bulk save in progress' };
    if (this.submittedMethods) return { error: 'Save or discard the submitted draft before editing it' };
    const before = engine.getState();
    if (this.baseline && (before.tournamentId !== this.baseline.tournamentId || !this.ownsInstalledRecord()))
      return { error: 'Bulk draft belongs to another tournament' };
    const result = engine.executionQueue(structuredClone(methods), true);
    if (result?.error) return result;
    if (!this.baseline) this.ownsInstalledRecord = isCurrent;
    this.baseline ??= before;
    this.preview = engine.getState();
    this.pending.push(structuredClone(methods));
    return result;
  }

  /** Keep recovery state until the request is explicitly acknowledged as successful. */
  save(methods: any[], send: (done: (result: Result) => void) => void, complete: (result: Result) => void): void {
    if (this.saving || !methods.length) return;
    if (!this.ownsInstalledRecord()) {
      complete({ error: 'Tournament refreshed; discard the old bulk draft before scheduling again' });
      return;
    }
    const intent = JSON.stringify(methods);
    if (this.submittedMethods && this.submittedMethods !== intent) {
      complete({ error: 'The submitted draft changed; discard it before scheduling again' });
      return;
    }
    this.submittedMethods = intent;
    this.saving = true;
    let settled = false;
    const done = (result: Result) => {
      if (settled) return;
      settled = true;
      this.saving = false;
      if (result?.success && !result.error) this.clear();
      complete(result);
    };
    try {
      send(done);
    } catch (error) {
      done({ error });
    }
  }

  discard(engine: DraftEngine): Result {
    if (this.saving) return { error: 'Bulk save in progress' };
    if (!this.pending.length) return { success: true };
    const current = engine.getState();
    if (!this.baseline || !this.preview || current.tournamentId !== this.baseline.tournamentId)
      return { error: 'Bulk draft owner is unavailable' };
    // A full authoritative reload already replaced the preview. Cancel its intents,
    // rather than reverting a server record that happens to equal the old preview.
    if (!this.ownsInstalledRecord()) {
      this.clear();
      return { success: true };
    }
    const records = restoreFields(
      this.baseline.tournamentRecords,
      this.preview.tournamentRecords,
      current.tournamentRecords,
    );
    const result = engine.setState(records);
    if (result?.error) return result;
    if (current.tournamentId) engine.setTournamentId(current.tournamentId);
    this.clear();
    return { success: true };
  }

  clear(): void {
    this.pending = [];
    this.submittedMethods = undefined;
    this.commandId = randomId();
    this.baseline = undefined;
    this.preview = undefined;
    this.ownsInstalledRecord = () => true;
  }
}
