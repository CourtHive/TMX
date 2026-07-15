/**
 * Human-readable draw-type label for the draws table.
 *
 * `drawDefinition.drawType` names only the MAIN structure. A qualifying stage —
 * notably a round-robin qualifying feeding a single-elimination main — is
 * invisible in that single value, so the "Draw type" column reads e.g.
 * "SINGLE_ELIMINATION" for a draw that is really RR-qualifying → SE-main.
 * `describeDrawType` title-cases the base type and appends the qualifying stage
 * (naming its family when it differs from the main), so composite draws read
 * accurately: "Single Elimination (Round Robin Qualifying)".
 *
 * Named composite types (ROUND_ROBIN_WITH_PLAYOFF, FIRST_MATCH_LOSER_CONSOLATION)
 * already encode their composition in `drawType`, so they need no annotation.
 */
import { drawDefinitionConstants } from 'tods-competition-factory';

const { QUALIFYING, WIN_RATIO, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;

/** SNAKE_CASE draw-type constant → Title Case (e.g. SINGLE_ELIMINATION → "Single Elimination"). */
export function formatDrawTypeLabel(drawType?: string): string {
  if (!drawType) return '';
  return drawType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function describeDrawType(drawDefinition: any): string {
  const base = formatDrawTypeLabel(drawDefinition?.drawType);
  const structures = drawDefinition?.structures ?? [];
  const qualifying = structures.find((structure: any) => structure?.stage === QUALIFYING);
  if (!qualifying) return base;

  const qualifyingIsRoundRobin = qualifying.finishingPosition === WIN_RATIO;
  const mainIsRoundRobin =
    drawDefinition?.drawType === ROUND_ROBIN || drawDefinition?.drawType === ROUND_ROBIN_WITH_PLAYOFF;
  // Only name the qualifying family when it differs from the main; otherwise a
  // bare "(Qualifying)" avoids redundant "Single Elimination (Single Elimination Qualifying)".
  const note =
    qualifyingIsRoundRobin === mainIsRoundRobin
      ? 'Qualifying'
      : `${qualifyingIsRoundRobin ? 'Round Robin' : 'Single Elimination'} Qualifying`;
  return `${base} (${note})`;
}
