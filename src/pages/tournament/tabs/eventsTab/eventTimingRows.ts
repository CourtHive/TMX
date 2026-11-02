// Pure logic for the event's Match timing editor: one row per matchUpFormat the event uses (its default, its draws'
// and structures', and its TEAM collections'), plus any format the event already carries its own timing for. Each
// row holds the effective average and recovery minutes, as `getEventMatchUpFormatTiming` resolves them, and whether
// they are the scheduling policy's or the event's own. The director's edits come back as the methods to send.
// No UI imports, so it is tested through the real engine.
import { extensionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

// constants and types
import { MODIFY_EVENT_MATCHUP_FORMAT_TIMING, REMOVE_EVENT_MATCHUP_FORMAT_TIMING } from 'constants/mutationConstants';

const { SCHEDULE_TIMING } = extensionConstants;

/** Where an event uses a format. A format added by the director, or timed but no longer used, has no use. */
export type FormatUse = { kind: 'event' } | { kind: 'draw'; name: string } | { kind: 'collection'; name: string };

export interface EventTimingRow {
  matchUpFormat: string;
  uses: FormatUse[];
  averageMinutes?: number;
  recoveryMinutes?: number;
  /** true when the event carries its own timing for this format; false when the scheduling policy answers. */
  override: boolean;
}

export interface TimingEdit {
  averageMinutes: number | string | undefined;
  recoveryMinutes: number | string | undefined;
}

export type TimingRefusal = 'INVALID_FORMAT' | 'DUPLICATE_FORMAT' | 'INVALID_AVERAGE' | 'INVALID_RECOVERY';

function findEvent(eventId: string): any {
  return eventId ? tournamentEngine.getEvent({ eventId })?.event : undefined;
}

function addUse(uses: Map<string, FormatUse[]>, matchUpFormat: string | undefined, use: FormatUse): void {
  if (!matchUpFormat) return;
  const list = uses.get(matchUpFormat) ?? [];
  const seen = list.some((existing) => JSON.stringify(existing) === JSON.stringify(use));
  if (!seen) list.push(use);
  uses.set(matchUpFormat, list);
}

function addCollections(uses: Map<string, FormatUse[]>, tieFormat: any): void {
  for (const collection of tieFormat?.collectionDefinitions ?? []) {
    addUse(uses, collection.matchUpFormat, { kind: 'collection', name: collection.collectionName ?? '' });
  }
}

/** The formats an event uses, in first-seen order: its default, then each draw's, structures' and collections'. */
export function eventFormatUses(event: any): Map<string, FormatUse[]> {
  const uses = new Map<string, FormatUse[]>();
  if (!event) return uses;
  addUse(uses, event.matchUpFormat, { kind: 'event' });
  addCollections(uses, event.tieFormat);
  for (const draw of event.drawDefinitions ?? []) {
    const name = draw.drawName ?? '';
    addUse(uses, draw.matchUpFormat, { kind: 'draw', name });
    addCollections(uses, draw.tieFormat);
    for (const structure of draw.structures ?? []) {
      addUse(uses, structure.matchUpFormat, { kind: 'draw', name });
      addCollections(uses, structure.tieFormat);
    }
  }
  return uses;
}

/** The formats the event carries its own timing for (its `scheduleTiming` extension). */
export function eventTimedFormats(event: any): Set<string> {
  const value = event?.extensions?.find((extension: any) => extension?.name === SCHEDULE_TIMING)?.value;
  const definitions = [...(value?.matchUpAverageTimes ?? []), ...(value?.matchUpRecoveryTimes ?? [])];
  return new Set(definitions.flatMap((definition: any) => definition?.matchUpFormatCodes ?? []));
}

/** The effective timing for each format, keyed by format; a format the factory does not recognise is absent. */
function resolveTiming(eventId: string, matchUpFormats: string[]): Map<string, any> {
  if (!matchUpFormats.length) return new Map();
  const result: any = tournamentEngine.getEventMatchUpFormatTiming({ eventId, matchUpFormats });
  return new Map((result?.eventMatchUpFormatTiming ?? []).map((timing: any) => [timing.matchUpFormat, timing]));
}

function toRow(matchUpFormat: string, uses: FormatUse[], timing: any, timed: Set<string>): EventTimingRow {
  return {
    matchUpFormat,
    uses,
    averageMinutes: timing?.averageMinutes,
    recoveryMinutes: timing?.recoveryMinutes,
    override: timed.has(matchUpFormat),
  };
}

/** One row per format the event uses, then each format it has its own timing for but no longer uses. */
export function eventTimingRows({ eventId }: { eventId: string }): EventTimingRow[] {
  const event = findEvent(eventId);
  if (!event) return [];
  const uses = eventFormatUses(event);
  const timed = eventTimedFormats(event);
  for (const matchUpFormat of timed) if (!uses.has(matchUpFormat)) uses.set(matchUpFormat, []);

  const timings = resolveTiming(eventId, [...uses.keys()]);
  return [...uses.entries()]
    .filter(([matchUpFormat]) => timings.has(matchUpFormat))
    .map(([matchUpFormat, formatUses]) => toRow(matchUpFormat, formatUses, timings.get(matchUpFormat), timed));
}

/**
 * A format the director adds before it is in use (a rain delay shortens the sets). It opens prefilled with the
 * scheduling policy's timing for it, or the event's own if the event already times it.
 */
export function addedTimingRow({
  eventId,
  matchUpFormat,
  rows,
}: {
  eventId: string;
  matchUpFormat: string;
  rows: EventTimingRow[];
}): { row?: EventTimingRow; refusal?: TimingRefusal } {
  if (rows.some((row) => row.matchUpFormat === matchUpFormat)) return { refusal: 'DUPLICATE_FORMAT' };
  const timing = resolveTiming(eventId, [matchUpFormat]).get(matchUpFormat);
  if (!timing) return { refusal: 'INVALID_FORMAT' };
  return { row: toRow(matchUpFormat, [], timing, eventTimedFormats(findEvent(eventId))) };
}

function readMinutes(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) ? minutes : Number.NaN;
}

/**
 * The edits as methods: one `modifyEventMatchUpFormatTiming` per row whose minutes changed, both figures sent so the
 * event's own timing is whole. A row left at its prefilled figures sends nothing. Refused, before anything is sent,
 * when an average is not a whole number above zero or a recovery is not a whole number of zero or more.
 */
export function buildTimingMethods({
  eventId,
  rows,
  edits,
}: {
  eventId: string;
  rows: EventTimingRow[];
  edits: Record<string, TimingEdit>;
}): { methods: any[]; refusal?: TimingRefusal } {
  const methods: any[] = [];
  for (const row of rows) {
    const edit = edits[row.matchUpFormat];
    if (!edit) continue;
    const averageMinutes = readMinutes(edit.averageMinutes);
    const recoveryMinutes = readMinutes(edit.recoveryMinutes);
    if (averageMinutes === undefined || Number.isNaN(averageMinutes) || averageMinutes <= 0) {
      return { methods: [], refusal: 'INVALID_AVERAGE' };
    }
    if (recoveryMinutes === undefined || Number.isNaN(recoveryMinutes) || recoveryMinutes < 0) {
      return { methods: [], refusal: 'INVALID_RECOVERY' };
    }
    if (averageMinutes === row.averageMinutes && recoveryMinutes === row.recoveryMinutes) continue;
    methods.push({
      method: MODIFY_EVENT_MATCHUP_FORMAT_TIMING,
      params: { eventId, matchUpFormat: row.matchUpFormat, averageMinutes, recoveryMinutes },
    });
  }
  return { methods };
}

/** "Use the defaults": the event's own timing removed, for every format. */
export function buildUseDefaultsMethod(eventId: string): any {
  return { method: REMOVE_EVENT_MATCHUP_FORMAT_TIMING, params: { eventId } };
}

/** How many formats carry the event's own timing, for the drawer's one-line summary. */
export function customisedFormatCount(rows: EventTimingRow[]): number {
  return rows.filter((row) => row.override).length;
}
