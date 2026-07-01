import { tournamentEngine } from 'services/factory/engine';

// DOM-free data layer for the structure-integrity audit. Kept separate from structureAudit.ts
// so it can be unit-tested in the node vitest environment (structureAudit.ts imports
// courthive-components' cModal, which touches the DOM at load time).

export type Inconsistency = {
  issueType: string;
  message: string;
  matchUpId: string;
  structureId?: string;
  [key: string]: any;
};

export type StructureGroup = { structureId: string; label: string; issues: Inconsistency[] };
export type DrawAudit = { drawId: string; drawName: string; eventName: string; groups: StructureGroup[] };

export type UnplayedRef = { matchUpId: string; roundNumber?: number; roundPosition?: number };
export type CompletenessGroup = {
  structureId: string;
  label: string;
  unassignedPositions: number[];
  unplayedMatchUps: UnplayedRef[];
};
export type DrawCompleteness = { drawId: string; drawName: string; eventName: string; groups: CompletenessGroup[] };

// Walk a drawDefinition's structure tree (round-robin CONTAINERs nest their groups) and map
// each structureId to a human label.
export function collectStructureLabels(structures: any[], labels: Map<string, string>): void {
  for (const structure of structures ?? []) {
    const label = structure.structureName || structure.stage || 'Structure';
    labels.set(structure.structureId, label);
    if (structure.structures?.length) collectStructureLabels(structure.structures, labels);
  }
}

function matchUpLabelMap(drawId: string): Map<string, string> {
  const map = new Map<string, string>();
  const matchUps = tournamentEngine.allDrawMatchUps({ drawId, inContext: true })?.matchUps ?? [];
  for (const matchUp of matchUps) {
    if (matchUp.roundNumber && matchUp.roundPosition) {
      map.set(matchUp.matchUpId, `R${matchUp.roundNumber} P${matchUp.roundPosition}`);
    }
  }
  return map;
}

// group a single draw's inconsistencies by structure, preserving structure order
export function groupByStructure(inconsistencies: Inconsistency[], labels: Map<string, string>): StructureGroup[] {
  const byStructure = new Map<string, StructureGroup>();
  for (const issue of inconsistencies) {
    const structureId = issue.structureId ?? 'unknown';
    const existing = byStructure.get(structureId);
    if (existing) {
      existing.issues.push(issue);
    } else {
      byStructure.set(structureId, {
        structureId,
        label: labels.get(structureId) ?? 'Structure',
        issues: [issue],
      });
    }
  }
  return [...byStructure.values()];
}

function auditDraw(drawId: string, drawName: string, eventName: string): DrawAudit | undefined {
  const result: any = tournamentEngine.getStructureInconsistencies({ drawId });
  const inconsistencies: Inconsistency[] = result?.inconsistencies ?? [];
  if (!inconsistencies.length) return undefined;

  const labels = new Map<string, string>();
  const { drawDefinition }: any = tournamentEngine.getEvent({ drawId }) ?? {};
  collectStructureLabels(drawDefinition?.structures ?? [], labels);

  const matchUpLabels = matchUpLabelMap(drawId);
  const groups = groupByStructure(inconsistencies, labels).map((group) => ({
    ...group,
    issues: group.issues.map((issue) => ({ ...issue, matchUpLabel: matchUpLabels.get(issue.matchUpId) })),
  }));
  return { drawId, drawName, eventName, groups };
}

// "what's still missing" companion — the factory getStructureCompleteness result already carries
// structureName/stage, so no extra label resolution is needed here.
function completenessForDraw(drawId: string, drawName: string, eventName: string): DrawCompleteness | undefined {
  const result: any = tournamentEngine.getStructureCompleteness({ drawId });
  const structures: any[] = result?.completeness?.structures ?? [];
  if (!structures.length) return undefined;

  const groups: CompletenessGroup[] = structures.map((structure) => ({
    structureId: structure.structureId,
    label: structure.structureName || structure.stage || 'Structure',
    unassignedPositions: structure.unassignedPositions ?? [],
    unplayedMatchUps: structure.unplayedMatchUps ?? [],
  }));
  return { drawId, drawName, eventName, groups };
}

// enumerate every draw of the loaded tournament once, collecting both inconsistencies (what's
// wrong in the decided state) and completeness (what's still outstanding before the draw is done)
export function auditTournament(): { audits: DrawAudit[]; completeness: DrawCompleteness[]; drawCount: number } {
  const events = tournamentEngine.q.events() ?? [];
  const audits: DrawAudit[] = [];
  const completeness: DrawCompleteness[] = [];
  let drawCount = 0;
  for (const event of events) {
    for (const drawDefinition of event.drawDefinitions ?? []) {
      drawCount += 1;
      const eventName = event.eventName ?? 'Event';
      const drawName = drawDefinition.drawName ?? 'Draw';
      const audit = auditDraw(drawDefinition.drawId, drawName, eventName);
      if (audit) audits.push(audit);
      const outstanding = completenessForDraw(drawDefinition.drawId, drawName, eventName);
      if (outstanding) completeness.push(outstanding);
    }
  }
  return { audits, completeness, drawCount };
}
