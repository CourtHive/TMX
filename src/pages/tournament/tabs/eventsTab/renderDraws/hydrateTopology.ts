/**
 * Hydrate Topology — Converts existing drawDefinition (structures + links) back to TopologyState.
 * Used for editing existing draws in the topology builder.
 */
import type { TopologyState, TopologyNode, TopologyEdge } from 'courthive-components';

const STAGE_MAP: Record<string, TopologyNode['stage']> = {
  MAIN: 'MAIN',
  QUALIFYING: 'QUALIFYING',
  CONSOLATION: 'CONSOLATION',
  PLAY_OFF: 'PLAY_OFF',
};

const LINK_TYPE_MAP: Record<string, TopologyEdge['linkType']> = {
  WINNER: 'WINNER',
  LOSER: 'LOSER',
  POSITION: 'POSITION',
};

/**
 * Map composite drawDefinition drawTypes to the structure-level structureType.
 * The topology builder only uses SINGLE_ELIMINATION, FEED_IN, ROUND_ROBIN, AD_HOC
 * as valid structure types; composite types (ROUND_ROBIN_WITH_PLAYOFF,
 * FEED_IN_CHAMPIONSHIP, COMPASS, etc.) are inferred from the link topology.
 */
const COMPOSITE_TO_STRUCTURE_TYPE: Record<string, string> = {
  ROUND_ROBIN_WITH_PLAYOFF: 'ROUND_ROBIN',
  DOUBLE_ELIMINATION: 'SINGLE_ELIMINATION',
  FIRST_MATCH_LOSER_CONSOLATION: 'SINGLE_ELIMINATION',
  FIRST_ROUND_LOSER_CONSOLATION: 'SINGLE_ELIMINATION',
  FEED_IN_CHAMPIONSHIP: 'SINGLE_ELIMINATION',
  COMPASS: 'SINGLE_ELIMINATION',
  OLYMPIC: 'SINGLE_ELIMINATION',
  CURTIS: 'SINGLE_ELIMINATION',
};

export function hydrateTopology(drawDefinition: any): Partial<TopologyState> | undefined {
  if (!drawDefinition?.structures?.length) return undefined;

  const structures = drawDefinition.structures || [];
  const links = drawDefinition.links || [];
  const ddDrawType = drawDefinition.drawType || 'SINGLE_ELIMINATION';

  // Build nodes from structures
  const nodes: TopologyNode[] = structures.map((structure: any, index: number) => {
    const stage = STAGE_MAP[structure.stage] || 'MAIN';
    const stageOrder = { QUALIFYING: 0, MAIN: 1, CONSOLATION: 2, PLAY_OFF: 3 };
    const col = stageOrder[stage] ?? 1;

    // Count structures in the same stage for vertical positioning
    const sameStage = structures.filter((s: any, i: number) => i < index && (STAGE_MAP[s.stage] || 'MAIN') === stage);

    // Determine structureType: map composite drawTypes to structure-level types
    let structureType = structure.drawType || 'SINGLE_ELIMINATION';
    if (!structure.drawType && stage === 'MAIN' && structure.stageSequence === 1) {
      structureType = ddDrawType;
    }
    if (structure.matchUpType === 'TEAM') {
      structureType = 'SINGLE_ELIMINATION';
    }

    // Map composite types to the 4 valid structure types
    structureType = COMPOSITE_TO_STRUCTURE_TYPE[structureType] || structureType;

    // Build structureOptions
    let structureOptions: any;
    if (structureType === 'AD_HOC') {
      const matchUps = structure.matchUps || [];
      const roundNumbers = new Set(matchUps.map((m: any) => m.roundNumber));
      const roundsCount = roundNumbers.size || 1;
      structureOptions = { roundsCount };
    }

    // Extract groupSize for RR structures from child structures
    if (structureType === 'ROUND_ROBIN' && structure.structures?.length) {
      const childMatchUps = structure.structures[0]?.matchUps || [];
      const positions = new Set(childMatchUps.flatMap((m: any) => m.drawPositions || []));
      structureOptions = { groupSize: positions.size || 4 };
    }

    return {
      id: structure.structureId,
      structureName: structure.structureName || `${stage} ${sameStage.length + 1}`,
      stage,
      structureType,
      drawSize: structure.positionAssignments?.length || countMatchUpPositions(structure),
      matchUpFormat: structure.matchUpFormat,
      ...(structureOptions && { structureOptions }),
      position: {
        x: col * 280 + 40,
        y: sameStage.length * 170 + 40,
      },
    };
  });

  // Build edges from links
  const edges: TopologyEdge[] = links.map((link: any, index: number) => {
    const sourceStructureId = link.source?.structureId;
    const targetStructureId = link.target?.structureId;
    const linkType = LINK_TYPE_MAP[link.linkType] || 'WINNER';

    return {
      id: `link-${index}`,
      sourceNodeId: sourceStructureId,
      targetNodeId: targetStructureId,
      linkType,
      sourceRoundNumber: link.source?.roundNumber,
      targetRoundNumber: link.target?.roundNumber,
      feedProfile: link.target?.feedProfile,
      finishingPositions: link.source?.finishingPositions,
      label: computeLabel(link),
    };
  });

  // Compute qualifyingPositions for QUALIFYING nodes from outgoing WINNER links.
  // The link's sourceRoundNumber tells us where qualifiers exit; the count is
  // drawSize / 2^sourceRoundNumber for standard elimination brackets.
  for (const node of nodes) {
    if (node.stage !== 'QUALIFYING') continue;

    const outgoingWinner = edges.find(
      (e: TopologyEdge) => e.sourceNodeId === node.id && e.linkType === 'WINNER',
    );
    if (outgoingWinner?.sourceRoundNumber) {
      node.qualifyingPositions = Math.floor(node.drawSize / Math.pow(2, outgoingWinner.sourceRoundNumber));
    }
  }

  // Normalize positions so the leftmost column starts at x=40
  if (nodes.length > 0) {
    const minX = Math.min(...nodes.map((n) => n.position.x));
    if (minX > 40) {
      const offset = minX - 40;
      for (const node of nodes) {
        node.position.x -= offset;
      }
    }
  }

  // Determine template name: use drawType unless it's SINGLE_ELIMINATION with multiple structures (that's CUSTOM)
  const templateName =
    ddDrawType === 'SINGLE_ELIMINATION' && structures.length > 1
      ? 'CUSTOM'
      : formatDrawType(ddDrawType);

  return {
    drawName: drawDefinition.drawName || 'Existing Draw',
    templateName,
    nodes,
    edges,
  };
}

function countMatchUpPositions(structure: any): number {
  const matchUps = structure.matchUps || [];
  const positions = new Set<number>();
  for (const mu of matchUps) {
    for (const dp of mu.drawPositions || []) {
      positions.add(dp);
    }
  }
  return positions.size || 2;
}

function computeLabel(link: any): string {
  const linkType = (link.linkType || 'WINNER').toLowerCase();
  let label = linkType;

  if (link.source?.roundNumber) {
    label = `R${link.source.roundNumber} ${linkType}`;
  }
  if (link.target?.roundNumber) {
    label += ` \u2192 R${link.target.roundNumber}`;
  }

  return label;
}

/** Convert SNAKE_CASE draw type constant to Title Case display name. */
function formatDrawType(drawType: string): string {
  return drawType
    .split('_')
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(' ');
}
