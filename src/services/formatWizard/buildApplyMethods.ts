import { factoryConstants } from 'tods-competition-factory';

// constants and types
import { ADD_EVENT, ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { FlightStructure, RankedPlan, StructureKind } from 'tods-competition-factory';

const { entryStatusConstants, drawDefinitionConstants } = factoryConstants;
const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

// Maps a wizard StructureKind to the factory drawType + extra
// generateDrawDefinition params. Returns null when the kind has no
// straight-through factory mapping (caller surfaces "unsupported").
export function structureKindToDrawSpec(
  structure: FlightStructure['structure'],
): {
  drawType: string;
  extras: Record<string, unknown>;
} | null {
  const { kind, groupSize, rounds } = structure;

  switch (kind) {
    case 'SINGLE_ELIMINATION':
    case 'FIRST_MATCH_LOSER_CONSOLATION':
    case 'FIRST_ROUND_LOSER_CONSOLATION':
    case 'DOUBLE_ELIMINATION':
    case 'COMPASS':
    case 'LUCKY_DRAW':
    case 'ADAPTIVE':
      return { drawType: kind, extras: {} };
    case 'ROUND_ROBIN':
      return { drawType: 'ROUND_ROBIN', extras: groupSize ? { groupSize } : {} };
    case 'ROUND_ROBIN_WITH_PLAYOFF':
      return { drawType: 'ROUND_ROBIN_WITH_PLAYOFF', extras: groupSize ? { groupSize } : {} };
    case 'SWISS':
      return { drawType: 'SWISS', extras: rounds ? { roundsCount: rounds } : {} };
    case 'DRAW_MATIC':
      return { drawType: 'AD_HOC', extras: { drawMatic: { roundsCount: rounds ?? 5 } } };
    case 'STAGGERED_FRENCH':
      // Needs the topology builder for multi-tier entry; not in MVP.
      return null;
    default: {
      const _exhaustive: never = kind as never;
      return _exhaustive;
    }
  }
}

export interface BuildApplyMethodsArgs {
  plan: RankedPlan;
  scaleName?: string;
  eventNamePrefix?: string;
  uuid?: () => string;
}

export interface DrawSpec {
  flightLabel: string;
  flightSize: number;
  participantIds: string[];
  drawType: string;
  drawSize: number;
  extras: Record<string, unknown>;
  eventId: string;
  drawId: string;
  matchUpFormat?: string;
}

export interface UnsupportedFlight {
  flightLabel: string;
  kind: StructureKind;
  reason: string;
}

export interface BuildApplyMethodsResult {
  // Stage 1 — events + entries
  eventMethods: any[];
  // Stage 2 prep — draw specs to be expanded into ADD_DRAW_DEFINITION
  // methods after Stage 1 lands
  drawSpecs: DrawSpec[];
  unsupported: UnsupportedFlight[];
  eventCount: number;
  participantCount: number;
}

const fallbackUuid = () => `fwz-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

function resolveDrawSize(structureKind: StructureKind, flightSize: number, structure: FlightStructure['structure']): number {
  if (structureKind === 'ROUND_ROBIN' || structureKind === 'ROUND_ROBIN_WITH_PLAYOFF') {
    return flightSize;
  }
  if (structureKind === 'SWISS' || structureKind === 'DRAW_MATIC') {
    return flightSize;
  }
  if (structureKind === 'LUCKY_DRAW' || structureKind === 'ADAPTIVE') {
    return flightSize;
  }
  if (structureKind === 'COMPASS') {
    if (structure.variantId === 'COMPASS_8') return 8;
    if (structure.variantId === 'COMPASS_16') return 16;
    return nextPowerOfTwo(flightSize);
  }
  // Bracket-shaped kinds (SE/FMLC/FRLC/DE/Staggered) need power-of-two
  return nextPowerOfTwo(flightSize);
}

function buildEventName(prefix: string | undefined, flightLabel: string, scaleName: string): string {
  const scale = scaleName.toUpperCase();
  if (prefix) return `${prefix} – ${flightLabel} (${scale})`;
  return `${flightLabel} (${scale})`;
}

// Translates a ranked plan into the mutation surface required to
// materialize it. The result is split into two stages because draw
// generation requires the event + entries to exist in factory state
// first. The orchestrator (`applyFormatPlan`) consumes both halves.
export function buildApplyMethods({
  plan,
  scaleName = 'utr',
  eventNamePrefix,
  uuid = fallbackUuid,
}: BuildApplyMethodsArgs): BuildApplyMethodsResult {
  const eventMethods: any[] = [];
  const drawSpecs: DrawSpec[] = [];
  const unsupported: UnsupportedFlight[] = [];
  let participantCount = 0;

  for (const fs of plan.flightStructures) {
    const spec = structureKindToDrawSpec(fs.structure);
    if (!spec) {
      unsupported.push({
        flightLabel: fs.flight.label,
        kind: fs.structure.kind,
        reason: 'NO_FACTORY_MAPPING',
      });
      continue;
    }

    const eventId = uuid();
    const drawId = uuid();
    const eventName = buildEventName(eventNamePrefix, fs.flight.label, scaleName);
    const participantIds = fs.flight.participantIds;
    if (participantIds.length === 0) continue;

    eventMethods.push({
      method: ADD_EVENT,
      params: {
        event: {
          eventId,
          eventName,
          eventType: 'SINGLES',
        },
      },
    });

    eventMethods.push({
      method: ADD_EVENT_ENTRIES,
      params: {
        eventId,
        participantIds,
        entryStage: MAIN,
        entryStatus: DIRECT_ACCEPTANCE,
        enforceCategory: false,
        enforceGender: false,
      },
    });

    drawSpecs.push({
      flightLabel: fs.flight.label,
      flightSize: participantIds.length,
      participantIds,
      drawType: spec.drawType,
      drawSize: resolveDrawSize(fs.structure.kind, participantIds.length, fs.structure),
      extras: spec.extras,
      eventId,
      drawId,
    });

    participantCount += participantIds.length;
  }

  return {
    eventMethods,
    drawSpecs,
    unsupported,
    eventCount: drawSpecs.length,
    participantCount,
  };
}

