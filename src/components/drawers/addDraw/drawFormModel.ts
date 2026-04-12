/**
 * Draw form state-engine model — Phase A (dormant).
 *
 * This is the pure-function core of the draw configuration form. It is NOT
 * yet wired into any caller — `getDrawFormItems`, `getDrawFormRelationships`,
 * and `submitDrawParams` continue to behave exactly as they do today. The
 * purpose of Phase A is to land the model + its full unit test suite as a
 * reviewable, low-risk addition. Phase B will start migrating one mode at a
 * time into this model; see `Mentat/statuses/2026-04-11-draw-form-state-engine-answers.md`
 * for the locked migration plan.
 *
 * The model takes a discriminated `DrawFormMode` describing **what kind of
 * draw is being created or edited** plus a `DrawFormInputs` snapshot of the
 * current form values, and returns a `DrawFormView` describing field
 * visibility, derived numeric values, validation errors, and which draw
 * types are legal for the current mode.
 *
 * The six top-level modes (`NEW_MAIN`, `NEW_MAIN_WITH_QUALIFYING_FIRST`,
 * `NEW_QUALIFYING`, `POPULATE_MAIN`, `GENERATE_QUALIFYING`, `ATTACH_QUALIFYING`)
 * cover every flag combination today's `addDraw.ts:52-78` flag tuple
 * encodes. The orthogonal `PlayoffMode` discriminant captures the round-robin
 * sub-state per Q2 of the locked plan.
 */

// constants and types
import { entryStatusConstants } from 'tods-competition-factory';
import {
  ADVANCE_PER_GROUP,
  AUTOMATED,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  DYNAMIC_RATINGS,
  FIC_DEPTH,
  GROUP_REMAINING,
  GROUP_SIZE,
  MATCHUP_FORMAT,
  PLAYOFF_DRAW_TYPE,
  PLAYOFF_GROUP_SIZE,
  PLAYOFF_TYPE,
  QUALIFIERS_COUNT,
  QUALIFYING_FIRST,
  QUALIFYING_POSITIONS,
  RATING_SCALE,
  ROUNDS_COUNT,
  SEEDING_POLICY,
  STRUCTURE_NAME,
  TEAM_AVOIDANCE,
} from 'constants/tmxConstants';

/** Canonical entry-status whitelist for structure selection. Mirrors the
 *  factory's `STRUCTURE_SELECTED_STATUSES` so the model never drifts from
 *  `validateAndDeriveDrawValues.getFilteredEntries`. */
const { STRUCTURE_SELECTED_STATUSES } = entryStatusConstants;
const SELECTED_STATUS_SET = new Set<string>(STRUCTURE_SELECTED_STATUSES);

/* ─── Mode discriminated union ──────────────────────────────────────── */

export type DrawFormMode =
  /** Brand-new main draw, no existing draw or structure to attach to. */
  | { kind: 'NEW_MAIN'; event: any }
  /** New draw where the user wants the qualifying round generated as the first
   *  step; a placeholder main draw is created alongside. Toggle from NEW_MAIN
   *  via the `qualifyingFirst` checkbox. */
  | { kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST'; event: any }
  /** Standalone qualifying structure for an event with no existing main draw. */
  | { kind: 'NEW_QUALIFYING'; event: any }
  /** Filling in an existing main-draw placeholder (created earlier by a
   *  `NEW_MAIN_WITH_QUALIFYING_FIRST` flow). */
  | { kind: 'POPULATE_MAIN'; event: any; draw: any }
  /** Generating the qualifying structure for a draw whose main already exists
   *  with a placeholder qualifying link. */
  | { kind: 'GENERATE_QUALIFYING'; event: any; draw: any }
  /** Attaching a qualifying structure to an existing main structure (the user
   *  picked a target structure to attach to). `maxQualifiers` is the upper
   *  bound on the qualifiers-count input — defaults to the target structure's
   *  position-assignment count. The model clamps `inputs[QUALIFIERS_COUNT]`
   *  into `[1, maxQualifiers]` so the adapter does not have to reproduce the
   *  clamp at `getDrawFormRelationships.ts:167-177`. */
  | { kind: 'ATTACH_QUALIFYING'; event: any; draw: any; structure: any; maxQualifiers?: number };

export type DrawFormModeKind = DrawFormMode['kind'];

/* ─── Playoff sub-state (orthogonal to top-level mode) ──────────────── */

/** Round-robin playoff sub-state. Only meaningful when
 *  `inputs[DRAW_TYPE] === ROUND_ROBIN_WITH_PLAYOFF`. */
export type PlayoffMode =
  | { kind: 'WINNERS' }
  | { kind: 'POSITIONS'; positions: number }
  | { kind: 'TOP_FINISHERS'; advancePerGroup: number }
  | { kind: 'BEST_FINISHERS'; totalToAdvance: number; groupRemaining: boolean };

/* ─── Inputs ─────────────────────────────────────────────────────────── */

/** Typed snapshot of the form's current input values. Replaces the
 *  `Record<string, any>` shape that today's `getDrawFormRelationships` works
 *  with. Every field that participates in the draw form is enumerated here so
 *  the model can switch on `inputs[DRAW_TYPE]` etc. without `any` casts. */
export type DrawFormInputs = {
  [DRAW_NAME]?: string;
  [STRUCTURE_NAME]?: string;
  [DRAW_TYPE]?: string;
  [DRAW_SIZE]?: number | string;
  [QUALIFIERS_COUNT]?: number | string;
  [QUALIFYING_POSITIONS]?: number | string;
  [QUALIFYING_FIRST]?: boolean;
  [GROUP_SIZE]?: number | string;
  [PLAYOFF_TYPE]?: string;
  [PLAYOFF_DRAW_TYPE]?: string;
  [PLAYOFF_GROUP_SIZE]?: number | string;
  [ADVANCE_PER_GROUP]?: number | string;
  [GROUP_REMAINING]?: boolean;
  totalAdvance?: number | string;
  [MATCHUP_FORMAT]?: string;
  [SEEDING_POLICY]?: string;
  [AUTOMATED]?: string | boolean;
  [ROUNDS_COUNT]?: number | string;
  [RATING_SCALE]?: string;
  [DYNAMIC_RATINGS]?: boolean;
  [TEAM_AVOIDANCE]?: boolean;
  [FIC_DEPTH]?: string;
  tieFormatName?: string;
};

export type DrawFormFieldKey = keyof DrawFormInputs;

export type FieldState = {
  visible: boolean;
  disabled: boolean;
  /** Suggested initial value when the field is first rendered or when a
   *  transition forces a recompute. The adapter applies this if the user has
   *  not yet typed anything; otherwise the user's value is preserved. */
  value?: unknown;
};

export type ValidationError = {
  field: DrawFormFieldKey | 'form';
  code: string;
  message: string;
};

export type DerivedValues = {
  drawSize: number;
  qualifiersCount: number;
  /** Resolved entries that should populate the new structure (main or qualifying). */
  drawEntries: any[];
  /** Existing position assignments when attaching to a structure. */
  structurePositionAssignments?: any[];
  /** Upper bound on `qualifiersCount`. Only set in `ATTACH_QUALIFYING` flows.
   *  The adapter should reject any user input above this value. */
  maxQualifiers?: number;
  /** True when this mode produces a placeholder main draw alongside the
   *  qualifying generation (the qualifying-first flow). */
  qualifyingOnly: boolean;
};

export type DrawFormView = {
  fieldStates: Partial<Record<DrawFormFieldKey, FieldState>>;
  derivedValues: DerivedValues;
  validationErrors: ValidationError[];
  /** Subset of `getDrawTypeOptions(...)` that the current mode allows. The
   *  adapter still calls `getDrawTypeOptions` for the master list; the model
   *  only narrows it. */
  allowedDrawTypes: string[];
  /** Empty array means the SEEDING_POLICY field should be hidden entirely. */
  availableSeedingPolicies: string[];
  /** True when the form should expose the tie-format selection field
   *  (TEAM events only today). */
  tieFormatRequired: boolean;
};

export type DrawFormModelOptions = {
  /** Optional previous mode passed to transition-aware compute paths.
   *  Consumed only by transitions that legitimately need to know what changed
   *  (today: `NEW_MAIN ↔ NEW_MAIN_WITH_QUALIFYING_FIRST` toggle re-derives
   *  draw size from a different entry stage). */
  previousMode?: DrawFormMode;
};

/* ─── Constants pulled from the existing source cluster ──────────────── */

const ROUND_ROBIN = 'ROUND_ROBIN';
const ROUND_ROBIN_WITH_PLAYOFF = 'ROUND_ROBIN_WITH_PLAYOFF';
const SINGLE_ELIMINATION = 'SINGLE_ELIMINATION';
const FEED_IN = 'FEED_IN';
const FEED_IN_CHAMPIONSHIP = 'FEED_IN_CHAMPIONSHIP';
const ADAPTIVE = 'ADAPTIVE';
const LUCKY_DRAW = 'LUCKY_DRAW';
const AD_HOC = 'AD_HOC';
const SWISS = 'SWISS';
const DRAW_MATIC = 'DRAW_MATIC';
const TEAM_EVENT = 'TEAM';

/** Draw types that bypass the next-power-of-2 coercion and use the raw
 *  entry count as their draw size. Mirrors `NON_POW2_TYPES` in
 *  `getDrawFormRelationships.ts:60-68`. */
const NON_POWER_OF_TWO_TYPES = new Set<string>([
  ADAPTIVE,
  LUCKY_DRAW,
  FEED_IN,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  DRAW_MATIC,
  AD_HOC,
]);

/** Draw types that hide the SEEDING_POLICY field. */
const AD_HOC_FAMILY = new Set<string>([AD_HOC, SWISS, DRAW_MATIC]);

/** Allowed draw types for the qualifying side of any qualifying-related mode. */
const QUALIFYING_DRAW_TYPES: string[] = [SINGLE_ELIMINATION, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF];

/** Allowed draw types for new MAIN draws. The full master list is owned by
 *  `getDrawTypeOptions`; this set is the subset the model whitelists per the
 *  Phase A scope. Phase B will reconcile this against the live options. */
const MAIN_DRAW_TYPES: string[] = [
  SINGLE_ELIMINATION,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  FEED_IN,
  FEED_IN_CHAMPIONSHIP,
  ADAPTIVE,
  LUCKY_DRAW,
  AD_HOC,
  SWISS,
  DRAW_MATIC,
];

/* ─── Public entry points ────────────────────────────────────────────── */

/** Resolve the legacy `(isQualifying, isPopulateMain, structureId, drawId)`
 *  flag tuple into a single `DrawFormMode` discriminated union value.
 *  Called at the `addDraw` boundary so downstream functions receive the
 *  mode directly instead of reconstructing it from booleans. */
export function resolveDrawFormMode({
  event,
  drawId,
  isQualifying,
  isPopulateMain,
  structureId,
}: {
  event: any;
  drawId?: string;
  isQualifying?: boolean;
  isPopulateMain?: boolean;
  structureId?: string;
}): DrawFormMode {
  const draw = drawId ? event.drawDefinitions?.find((d: any) => d.drawId === drawId) : undefined;
  if (isPopulateMain && draw) return { kind: 'POPULATE_MAIN', event, draw };
  if (isQualifying && structureId && draw) {
    const structure = draw.structures?.find((s: any) => s.structureId === structureId);
    if (structure) return { kind: 'ATTACH_QUALIFYING', event, draw, structure };
  }
  if (isQualifying && drawId && draw) return { kind: 'GENERATE_QUALIFYING', event, draw };
  if (isQualifying) return { kind: 'NEW_QUALIFYING', event };
  return { kind: 'NEW_MAIN', event };
}

export function drawFormModel(
  mode: DrawFormMode,
  inputs: DrawFormInputs,
  options: DrawFormModelOptions = {},
): DrawFormView {
  switch (mode.kind) {
    case 'NEW_MAIN':
      return computeNewMain(mode, inputs, options);
    case 'NEW_MAIN_WITH_QUALIFYING_FIRST':
      return computeNewMainWithQualifyingFirst(mode, inputs, options);
    case 'NEW_QUALIFYING':
      return computeNewQualifying(mode, inputs, options);
    case 'POPULATE_MAIN':
      return computePopulateMain(mode, inputs, options);
    case 'GENERATE_QUALIFYING':
      return computeGenerateQualifying(mode, inputs, options);
    case 'ATTACH_QUALIFYING':
      return computeAttachQualifying(mode, inputs, options);
    default: {
      // Exhaustiveness check — TS will complain if a mode is added without a case.
      const exhaustive: never = mode;
      throw new Error(`drawFormModel: unhandled mode ${(exhaustive as any)?.kind}`);
    }
  }
}

/* ─── Per-mode compute helpers ───────────────────────────────────────── */

function computeNewMain(
  mode: Extract<DrawFormMode, { kind: 'NEW_MAIN' }>,
  inputs: DrawFormInputs,
  _options: DrawFormModelOptions,
): DrawFormView {
  const drawType = pickDrawType(inputs, MAIN_DRAW_TYPES, SINGLE_ELIMINATION);
  const mainEntries = filterEntriesForStage(mode.event, 'MAIN');
  const drawSize = coerceDrawSize(mainEntries.length, drawType);
  // When qualifying entries already exist on the event, suggest a default
  // qualifiers count equal to the power-of-2 gap above the main entries.
  // Mirrors `getDrawFormItems.computeQualifyingState.qualifyingSpotsFromEntries`.
  // For NON_POWER_OF_TWO_TYPES draw types `drawSize === mainEntries.length`,
  // so the inferred default collapses to 0 — same as the legacy path.
  const qualifyingEntriesExist = filterEntriesForStage(mode.event, 'QUALIFYING').length > 0;
  const inferredQualifiers = qualifyingEntriesExist ? Math.max(0, drawSize - mainEntries.length) : 0;
  const qualifiersCount = readNumericInput(inputs[QUALIFIERS_COUNT], inferredQualifiers);

  return {
    fieldStates: {
      ...newDrawCommonFieldStates(drawType),
      [DRAW_NAME]: { visible: true, disabled: false },
      [STRUCTURE_NAME]: { visible: false, disabled: true },
      [QUALIFYING_FIRST]: { visible: true, disabled: false, value: false },
      [QUALIFIERS_COUNT]: { visible: !AD_HOC_FAMILY.has(drawType), disabled: false, value: qualifiersCount },
      [QUALIFYING_POSITIONS]: { visible: false, disabled: true },
    },
    derivedValues: {
      drawSize,
      qualifiersCount,
      drawEntries: mainEntries,
      qualifyingOnly: false,
    },
    validationErrors: validateDrawSize(drawSize, mainEntries.length, qualifiersCount),
    allowedDrawTypes: MAIN_DRAW_TYPES,
    availableSeedingPolicies: AD_HOC_FAMILY.has(drawType) ? [] : ['SEPARATE', 'CLUSTER', 'INHERIT'],
    tieFormatRequired: mode.event?.eventType === TEAM_EVENT,
  };
}

function computeNewMainWithQualifyingFirst(
  mode: Extract<DrawFormMode, { kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST' }>,
  inputs: DrawFormInputs,
  _options: DrawFormModelOptions,
): DrawFormView {
  const drawType = pickDrawType(inputs, QUALIFYING_DRAW_TYPES, SINGLE_ELIMINATION);
  const qualifyingEntries = filterEntriesForStage(mode.event, 'QUALIFYING');
  // Qualifying draw size: raw entries count, defaulting to 16 when there are
  // no qualifying entries yet (mirrors `qualifyingFirstChange:348`).
  const drawSize = qualifyingEntries.length || 16;
  const qualifyingPositions = readNumericInput(inputs[QUALIFYING_POSITIONS], 4);

  return {
    fieldStates: {
      ...newDrawCommonFieldStates(drawType),
      [DRAW_NAME]: { visible: false, disabled: true },
      [STRUCTURE_NAME]: { visible: true, disabled: false, value: 'Qualifying' },
      [QUALIFYING_FIRST]: { visible: true, disabled: false, value: true },
      [QUALIFIERS_COUNT]: { visible: false, disabled: true },
      [QUALIFYING_POSITIONS]: { visible: true, disabled: false, value: qualifyingPositions },
      // Seeding policy is hidden for the qualifying-first sub-flow.
      [SEEDING_POLICY]: { visible: false, disabled: true },
    },
    derivedValues: {
      drawSize,
      qualifiersCount: qualifyingPositions,
      drawEntries: qualifyingEntries,
      qualifyingOnly: true,
    },
    validationErrors: validateDrawSize(drawSize, qualifyingEntries.length, 0),
    allowedDrawTypes: QUALIFYING_DRAW_TYPES,
    availableSeedingPolicies: [],
    tieFormatRequired: mode.event?.eventType === TEAM_EVENT,
  };
}

function computeNewQualifying(
  mode: Extract<DrawFormMode, { kind: 'NEW_QUALIFYING' }>,
  inputs: DrawFormInputs,
  _options: DrawFormModelOptions,
): DrawFormView {
  const drawType = pickDrawType(inputs, QUALIFYING_DRAW_TYPES, SINGLE_ELIMINATION);
  const qualifyingEntries = filterEntriesForStage(mode.event, 'QUALIFYING');
  const drawSize = qualifyingEntries.length || 0;

  return {
    fieldStates: {
      ...newDrawCommonFieldStates(drawType),
      [DRAW_NAME]: { visible: false, disabled: true },
      [STRUCTURE_NAME]: { visible: true, disabled: false, value: 'Qualifying' },
      [QUALIFYING_FIRST]: { visible: false, disabled: true },
      [QUALIFIERS_COUNT]: { visible: false, disabled: true },
      [QUALIFYING_POSITIONS]: { visible: false, disabled: true },
    },
    derivedValues: {
      drawSize,
      qualifiersCount: 0,
      drawEntries: qualifyingEntries,
      qualifyingOnly: false,
    },
    validationErrors: validateDrawSize(drawSize, qualifyingEntries.length, 0),
    allowedDrawTypes: QUALIFYING_DRAW_TYPES,
    availableSeedingPolicies: [],
    tieFormatRequired: false,
  };
}

function computePopulateMain(
  mode: Extract<DrawFormMode, { kind: 'POPULATE_MAIN' }>,
  inputs: DrawFormInputs,
  _options: DrawFormModelOptions,
): DrawFormView {
  const drawType = pickDrawType(inputs, MAIN_DRAW_TYPES, SINGLE_ELIMINATION);
  const flightEntries = readFlightMainEntries(mode.draw, mode.event);
  const drawSize = coerceDrawSize(flightEntries.length, drawType);
  const qualifiersCount = inferExistingQualifiersCount(mode.draw);

  return {
    fieldStates: {
      ...newDrawCommonFieldStates(drawType),
      // DRAW_NAME is hidden for POPULATE_MAIN — the draw already has a name
      // set from the flight profile. The user renames via flight management,
      // not the populate-main drawer.
      [DRAW_NAME]: { visible: false, disabled: true },
      [STRUCTURE_NAME]: { visible: false, disabled: true },
      [QUALIFYING_FIRST]: { visible: false, disabled: true },
      [QUALIFIERS_COUNT]: { visible: !AD_HOC_FAMILY.has(drawType), disabled: false, value: qualifiersCount },
      [QUALIFYING_POSITIONS]: { visible: false, disabled: true },
    },
    derivedValues: {
      drawSize,
      qualifiersCount,
      drawEntries: flightEntries,
      qualifyingOnly: false,
    },
    validationErrors: validateDrawSize(drawSize, flightEntries.length, qualifiersCount),
    allowedDrawTypes: MAIN_DRAW_TYPES,
    availableSeedingPolicies: AD_HOC_FAMILY.has(drawType) ? [] : ['SEPARATE', 'CLUSTER', 'INHERIT'],
    tieFormatRequired: mode.event?.eventType === TEAM_EVENT,
  };
}

function computeGenerateQualifying(
  mode: Extract<DrawFormMode, { kind: 'GENERATE_QUALIFYING' }>,
  inputs: DrawFormInputs,
  options: DrawFormModelOptions,
): DrawFormView {
  // GENERATE_QUALIFYING and NEW_QUALIFYING produce the same form view today —
  // both build a fresh qualifying structure from the qualifying entries. The
  // distinction lives in the post-commit flow (GENERATE_QUALIFYING attaches
  // to an existing main draw via `mode.draw`), which the model itself does
  // not need to express. Delegate so the rules stay in one place.
  return computeNewQualifying({ kind: 'NEW_QUALIFYING', event: mode.event }, inputs, options);
}

function computeAttachQualifying(
  mode: Extract<DrawFormMode, { kind: 'ATTACH_QUALIFYING' }>,
  inputs: DrawFormInputs,
  _options: DrawFormModelOptions,
): DrawFormView {
  const drawType = pickDrawType(inputs, QUALIFYING_DRAW_TYPES, SINGLE_ELIMINATION);
  const positionAssignments = mode.structure?.positionAssignments ?? [];
  // Draw size for an attaching flow comes from the existing structure.
  const drawSize = positionAssignments.length || 0;
  // Upper bound on qualifiersCount: explicit override on the mode payload, or
  // the position-assignment count of the target structure (today's behavior
  // at addDraw.ts:73). Mirrors `getDrawFormRelationships.ts:167-177`.
  const maxQualifiers = mode.maxQualifiers ?? drawSize;
  // Existing qualifier count from the structure being attached to.
  const qualifierPositionCount = positionAssignments.filter((p: any) => p.qualifier).length;
  const qualifiersCount = clampQualifiersCount(inputs[QUALIFIERS_COUNT], qualifierPositionCount || 1, maxQualifiers);
  const mainEntries = filterEntriesForStage(mode.event, 'MAIN');

  return {
    fieldStates: {
      ...newDrawCommonFieldStates(drawType),
      [DRAW_NAME]: { visible: false, disabled: true },
      [STRUCTURE_NAME]: { visible: true, disabled: false, value: 'Qualifying' },
      [QUALIFYING_FIRST]: { visible: false, disabled: true },
      [QUALIFIERS_COUNT]: { visible: true, disabled: false, value: qualifiersCount },
      [QUALIFYING_POSITIONS]: { visible: false, disabled: true },
      // Automated creation is disabled in the attach flow (mirrors current behavior).
      [AUTOMATED]: { visible: true, disabled: true },
    },
    derivedValues: {
      drawSize,
      qualifiersCount,
      drawEntries: mainEntries,
      structurePositionAssignments: positionAssignments,
      maxQualifiers,
      qualifyingOnly: false,
    },
    validationErrors: validateAttachQualifying(drawSize, qualifiersCount),
    allowedDrawTypes: QUALIFYING_DRAW_TYPES,
    availableSeedingPolicies: [],
    tieFormatRequired: false,
  };
}

/** Resolve `qualifiersCount` for an ATTACH_QUALIFYING flow. Honors a user
 *  input value when present and finite, falls back to the existing structure's
 *  qualifier-position count, then clamps the result into `[1, maxQualifiers]`.
 *  When `maxQualifiers` is zero (empty target structure), the floor of 1 is
 *  preserved so the validation layer surfaces `ATTACH_DRAW_SIZE_MISSING`
 *  rather than a confusing zero-count. */
function clampQualifiersCount(
  inputValue: number | string | undefined,
  fallback: number,
  maxQualifiers: number,
): number {
  const requested = readNumericInput(inputValue, fallback);
  const floor = Math.max(1, requested);
  if (maxQualifiers <= 0) return floor;
  return Math.min(floor, maxQualifiers);
}

/* ─── Shared helpers ─────────────────────────────────────────────────── */

/** Field states common to every "new draw" mode that shows the standard
 *  draw-type-driven fields (group size, playoff options, ratings, etc.).
 *  Centralizes the visibility rules from `updateFieldVisibility` in
 *  `getDrawFormRelationships.ts:196-229`. */
function newDrawCommonFieldStates(drawType: string): Partial<Record<DrawFormFieldKey, FieldState>> {
  const isRRPlayoff = drawType === ROUND_ROBIN_WITH_PLAYOFF;
  const isRR = drawType === ROUND_ROBIN || isRRPlayoff;
  const isDrawMatic = drawType === DRAW_MATIC;
  const isAdHoc = drawType === AD_HOC || drawType === SWISS || isDrawMatic;
  const isSwiss = drawType === SWISS;
  const isFIC = drawType === FEED_IN_CHAMPIONSHIP;

  return {
    [DRAW_TYPE]: { visible: true, disabled: false, value: drawType },
    [DRAW_SIZE]: { visible: true, disabled: false },
    [GROUP_SIZE]: { visible: isRR, disabled: false },
    [PLAYOFF_TYPE]: { visible: isRRPlayoff, disabled: false },
    [PLAYOFF_DRAW_TYPE]: { visible: isRRPlayoff, disabled: false },
    [PLAYOFF_GROUP_SIZE]: { visible: false, disabled: false },
    [ADVANCE_PER_GROUP]: { visible: false, disabled: false },
    totalAdvance: { visible: false, disabled: false },
    [GROUP_REMAINING]: { visible: false, disabled: false },
    [FIC_DEPTH]: { visible: isFIC, disabled: false },
    [ROUNDS_COUNT]: { visible: isDrawMatic, disabled: false },
    [RATING_SCALE]: { visible: isDrawMatic || isSwiss, disabled: false },
    [DYNAMIC_RATINGS]: { visible: isDrawMatic, disabled: false },
    [TEAM_AVOIDANCE]: { visible: isDrawMatic, disabled: false },
    [MATCHUP_FORMAT]: { visible: true, disabled: false },
    [SEEDING_POLICY]: { visible: !isAdHoc, disabled: false },
    [AUTOMATED]: { visible: !isSwiss, disabled: false },
  };
}

function pickDrawType(inputs: DrawFormInputs, allowed: string[], fallback: string): string {
  const requested = inputs[DRAW_TYPE];
  if (typeof requested === 'string' && allowed.includes(requested)) return requested;
  return fallback;
}

/** Two-pass filter mirroring `validateAndDeriveDrawValues.ts:99-109`:
 *  first by entry status against the factory whitelist, then by stage. The
 *  MAIN pass treats a missing `entryStage` as MAIN (the factory default);
 *  the QUALIFYING pass requires an explicit `entryStage === 'QUALIFYING'`. */
function filterEntriesForStage(event: any, stage: 'MAIN' | 'QUALIFYING'): any[] {
  if (!event?.entries) return [];
  const statusFiltered = event.entries.filter((entry: any) => isAcceptedEntry(entry?.entryStatus));
  return statusFiltered.filter((entry: any) => {
    const entryStage = entry?.entryStage;
    return stage === 'MAIN' ? !entryStage || entryStage === 'MAIN' : entryStage === 'QUALIFYING';
  });
}

function isAcceptedEntry(entryStatus?: string): boolean {
  return typeof entryStatus === 'string' && SELECTED_STATUS_SET.has(entryStatus);
}

/** Coerce an entry count into a draw size: power-of-2 for elimination-style
 *  draws, raw count for AD_HOC / ROUND_ROBIN / etc. */
function coerceDrawSize(entriesCount: number, drawType: string): number {
  if (entriesCount <= 0) return 0;
  if (NON_POWER_OF_TWO_TYPES.has(drawType)) return entriesCount;
  return nextPowerOfTwo(entriesCount);
}

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return Math.max(n, 0);
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

function readNumericInput(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readFlightMainEntries(draw: any, event: any): any[] {
  const flightProfile = event?.extensions?.find((ext: any) => ext?.name === 'flightProfile')?.value;
  const flight = flightProfile?.flights?.find((f: any) => f?.drawId === draw?.drawId);
  const flightMainEntries = (flight?.drawEntries ?? []).filter((entry: any) => {
    const entryStage = entry?.entryStage;
    return (!entryStage || entryStage === 'MAIN') && isAcceptedEntry(entry?.entryStatus);
  });
  if (flightMainEntries.length) return flightMainEntries;
  return filterEntriesForStage(event, 'MAIN');
}

function inferExistingQualifiersCount(draw: any): number {
  const mainStructure = draw?.structures?.find((s: any) => s?.stage === 'MAIN' && s?.stageSequence === 1);
  if (!mainStructure) return 0;
  const qualifyingLink = draw?.links?.find((l: any) => l?.target?.structureId === mainStructure?.structureId);
  if (!qualifyingLink) return 0;
  const explicit = qualifyingLink?.source?.qualifyingPositions;
  if (typeof explicit === 'number' && explicit > 0) return explicit;
  // Fallback: count matchUps in the qualifying source structure's final round.
  const sourceStructureId = qualifyingLink?.source?.structureId;
  const sourceRoundNumber = qualifyingLink?.source?.roundNumber;
  if (!sourceStructureId || !sourceRoundNumber) return 0;
  const sourceStructure = draw?.structures?.find((s: any) => s?.structureId === sourceStructureId);
  const finalRoundCount = (sourceStructure?.matchUps ?? []).filter(
    (m: any) => m?.roundNumber === sourceRoundNumber,
  ).length;
  return finalRoundCount;
}

function validateDrawSize(drawSize: number, entriesCount: number, qualifiersCount: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const required = entriesCount + qualifiersCount;
  if (drawSize < 2) {
    errors.push({ field: DRAW_SIZE, code: 'DRAW_SIZE_TOO_SMALL', message: 'Draw size must be at least 2' });
  }
  if (required > 0 && drawSize < required) {
    errors.push({
      field: DRAW_SIZE,
      code: 'DRAW_SIZE_BELOW_REQUIRED',
      message: `Draw size (${drawSize}) must be at least ${required} (${entriesCount} entries + ${qualifiersCount} qualifiers)`,
    });
  }
  return errors;
}

function validateAttachQualifying(drawSize: number, qualifiersCount: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (drawSize <= 0) {
    errors.push({
      field: DRAW_SIZE,
      code: 'ATTACH_DRAW_SIZE_MISSING',
      message: 'Cannot attach qualifying — target structure has no positions',
    });
  }
  if (qualifiersCount < 1) {
    errors.push({
      field: QUALIFIERS_COUNT,
      code: 'QUALIFIERS_COUNT_TOO_LOW',
      message: 'At least one qualifier position is required when attaching a qualifying structure',
    });
  }
  return errors;
}
