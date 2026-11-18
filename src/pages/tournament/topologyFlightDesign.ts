/**
 * One design for the other flights (topology builder 3B, CA, 2026-11-18). A flight's design is copied to each other
 * flight without a draw as that flight's builder draft, sized to its own entries; nothing is generated, and each draw is
 * independent once made. Most flights are a simple single or templated structure, so a design names the shape and each
 * flight's entries give it its sizes.
 */
import { defaultQualifiers, qualifyingSlots, type TopologyNode, type TopologyState } from 'courthive-components';
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';

const { MAIN, QUALIFYING, SINGLE_ELIMINATION, WINNER } = drawDefinitionConstants;
const ACCEPTED = new Set<string>(entryStatusConstants.STRUCTURE_SELECTED_STATUSES);

const nextPowerOfTwo = (n: number) => Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(n, 1))));

/** A qualifying card's qualifiers: its own count, else its edge's, else the builder's default for its size. */
function qualifiersOf(node: TopologyNode, state: TopologyState): number {
  const edge = state.edges.find((e) => e.sourceNodeId === node.id && e.linkType === WINNER);
  return node.qualifyingPositions || edge?.qualifyingPositions || defaultQualifiers(node);
}

/** The qualifiers a card receives from the qualifying cards whose winners are sent to it. */
function carriedQualifiers(target: TopologyNode, state: TopologyState): number {
  return state.edges
    .filter((edge) => edge.targetNodeId === target.id && edge.linkType === WINNER)
    .map((edge) => state.nodes.find((node) => node.id === edge.sourceNodeId))
    .filter((node): node is TopologyNode => node?.stage === QUALIFYING)
    .reduce((sum, feeder) => sum + qualifiersOf(feeder, state), 0);
}

/** The accepted entries of a flight in a stage. */
function acceptedCount(entries: any[], stage: string): number {
  return entries.filter((entry) => ACCEPTED.has(entry.entryStatus) && (entry.entryStage ?? MAIN) === stage).length;
}

/** `total` shared in proportion to `weights`, whole numbers adding up to `total` (the largest remainders first). */
export function shareOut(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / sum);
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, i) => ({ i, remainder: value - shares[i] }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares;
}

/** A qualifying card resized: its qualifiers over half its new size come down to half. */
function resizedQualifying(node: TopologyNode, drawSize: number): TopologyNode {
  const half = Math.max(1, Math.floor(drawSize / 2));
  return {
    ...node,
    drawSize,
    ...(node.qualifyingPositions && node.qualifyingPositions > half && { qualifyingPositions: half }),
  };
}

/**
 * The design, sized to a flight's entries:
 *   - the qualifying cards share the flight's accepted QUALIFYING entries as the design's bands share theirs, each card
 *     its share plus what its pre-qualifying sends it;
 *   - MAIN holds the flight's accepted MAIN entries and the qualifiers reaching it: an elimination MAIN the next power
 *     of two, any other its count. A feed rounds profile described the design's size, so it goes.
 * Everything else (consolations, playoffs, links) is the design's. The draft is named for the flight.
 */
export function designForFlight(design: Partial<TopologyState>, flight: any): Partial<TopologyState> {
  const entries = flight?.drawEntries ?? [];
  const nodes = (design.nodes ?? []).map((node) => ({ ...node }));
  const state = { ...design, nodes, edges: design.edges ?? [] } as TopologyState;

  // the qualifying bands, strongest first, as the design's QUALIFYING list cuts them
  const slots = qualifyingSlots(state);
  const shares = shareOut(
    acceptedCount(entries, QUALIFYING),
    slots.map(({ entrants }) => entrants),
  );
  // deepest first, so a pre-qualifying card is resized before the card it feeds counts its qualifiers
  const byDepth = slots
    .map((slot, i) => ({ slot, share: shares[i] }))
    .sort((a, b) => b.slot.path.depth - a.slot.path.depth);
  for (const { slot, share } of byDepth) {
    const index = nodes.findIndex((node) => node.id === slot.nodeId);
    const fed = carriedQualifiers(nodes[index], { ...state, nodes });
    nodes[index] = resizedQualifying(nodes[index], Math.max(2, share + fed));
  }

  const mainIndex = nodes.findIndex((node) => node.stage === MAIN);
  if (mainIndex >= 0) {
    const main = nodes[mainIndex];
    const entrants = acceptedCount(entries, MAIN) + carriedQualifiers(main, { ...state, nodes });
    const drawSize = main.structureType === SINGLE_ELIMINATION ? nextPowerOfTwo(entrants) : Math.max(2, entrants);
    const { feedRoundsProfile: _profile, ...structureOptions } = main.structureOptions ?? {};
    nodes[mainIndex] = {
      ...main,
      drawSize,
      structureOptions: Object.keys(structureOptions).length ? structureOptions : undefined,
    };
  }

  return {
    ...design,
    nodes,
    drawName: flight?.drawName ?? design.drawName,
    selectedNodeId: null,
    selectedEdgeId: null,
  };
}
