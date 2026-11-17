/**
 * The topology a new draw opens with (CA, 2026-11-16): the structures the event's accepted entries already call for,
 * as the starting point to fit, rather than an empty canvas.
 *
 * - MAIN accepted entries → a single-elimination Main, sized as the Add Draw drawer sizes it (`drawFormModel`): the
 *   power of two that holds the main entries, with the places left over held for qualifiers when there are qualifying
 *   entries.
 * - QUALIFYING accepted entries as well → a Qualifying structure sized to hold them, linked into the Main's first
 *   round. Its qualifiers are the drawer's places left over, brought to a count an elimination draw can produce (a
 *   power of two, at most half the qualifying draw); with no places left over the builder's own default for a new
 *   qualifying structure applies (a quarter of its draw) and the Main grows to take them.
 *
 * No accepted MAIN entries, no default: a draw made only of qualifying, or before anyone has entered, is built by
 * hand. Pure: the event is handed in.
 *
 * Handed the Add Draw drawer's choices (its "Open in draw builder", CA 2026-11-17), the draw is the one the drawer
 * describes instead: its name, its Main's type (one the builder lays out) and size, and its qualifiers — none, when
 * the drawer asks for none.
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { drawFormModel } from 'components/drawers/addDraw/drawFormModel';
import { randomId } from 'functions/randomId';

// constants and types
import type { TopologyState } from 'courthive-components';

const {
  AD_HOC,
  COMPASS,
  FEED_IN_CHAMPIONSHIP,
  FIRST_MATCH_LOSER_CONSOLATION,
  MAIN,
  OLYMPIC,
  QUALIFYING,
  ROUND_ROBIN,
  SINGLE_ELIMINATION,
  WINNER,
} = drawDefinitionConstants;

/** The Main types the builder lays out (its node editor's list); the drawer's others open as single elimination. */
const BUILDER_MAIN_TYPES = new Set<string>([
  SINGLE_ELIMINATION,
  ROUND_ROBIN,
  FEED_IN_CHAMPIONSHIP,
  FIRST_MATCH_LOSER_CONSOLATION,
  COMPASS,
  OLYMPIC,
  AD_HOC,
]);

/** What the Add Draw drawer holds when it hands the draw to the builder. */
export type DrawFormChoices = {
  drawName?: string;
  drawType?: string;
  drawSize?: number;
  qualifiersCount?: number;
};
const ACCEPTED = new Set<string>(entryStatusConstants.STRUCTURE_SELECTED_STATUSES);

const nextPowerOfTwo = (n: number) => Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(n, 1))));
const powerOfTwoAtMost = (n: number) => (n >= 1 ? 2 ** Math.floor(Math.log2(n)) : 0);

export function defaultTopology(event: any, form?: DrawFormChoices): Partial<TopologyState> | undefined {
  const accepted = (stage: string) =>
    (event?.entries ?? []).filter(
      (entry: any) => ACCEPTED.has(entry.entryStatus) && (entry.entryStage ?? MAIN) === stage,
    ).length;
  const mainCount = accepted(MAIN);
  if (!mainCount && !form) return undefined;
  // the drawer's "no qualifiers" is a draw without a qualifying structure
  const qualifyingCount = form?.qualifiersCount === 0 ? 0 : accepted(QUALIFYING);

  const { derivedValues } = drawFormModel({ kind: 'NEW_MAIN', event }, {});
  let mainSize = form?.drawSize || derivedValues.drawSize;
  const main = {
    id: randomId(),
    structureName: 'Main',
    stage: MAIN,
    structureType: form?.drawType && BUILDER_MAIN_TYPES.has(form.drawType) ? form.drawType : SINGLE_ELIMINATION,
    position: { x: 0, y: 0 },
  };
  const base = { drawName: form?.drawName || event?.eventName || '', selectedNodeId: null, selectedEdgeId: null };
  if (!qualifyingCount) return { ...base, nodes: [{ ...main, drawSize: mainSize }], edges: [] };

  const qualifyingSize = nextPowerOfTwo(qualifyingCount);
  const asked = form?.qualifiersCount ?? derivedValues.qualifiersCount ?? 0;
  let qualifiers = powerOfTwoAtMost(Math.min(asked, qualifyingSize / 2));
  if (!qualifiers) {
    qualifiers = Math.max(1, Math.floor(qualifyingSize / 4));
    mainSize = nextPowerOfTwo(mainCount + qualifiers);
  }
  const qualifying = {
    id: randomId(),
    structureName: 'Qualifying',
    stage: QUALIFYING,
    structureType: SINGLE_ELIMINATION,
    drawSize: qualifyingSize,
    qualifyingPositions: qualifiers,
    position: { x: 0, y: 0 },
  };
  return {
    ...base,
    nodes: [qualifying, { ...main, drawSize: mainSize }],
    edges: [
      {
        id: randomId(),
        sourceNodeId: qualifying.id,
        targetNodeId: main.id,
        linkType: WINNER,
        targetRoundNumber: 1,
        qualifyingPositions: qualifiers,
      },
    ],
  } as Partial<TopologyState>;
}
