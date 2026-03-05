/**
 * Maps sport identifiers to court SVG factories from courthive-components.
 * Ensures SVGs are landscape-oriented (greater dimension = width).
 */
import {
  tennisCourt,
  basketballCourt,
  baseballDiamond,
  hockeyRink,
  pickleballCourt,
  badmintonCourt,
  padelCourt,
} from 'courthive-components';

export type CourtSport = 'tennis' | 'basketball' | 'baseball' | 'hockey' | 'pickleball' | 'badminton' | 'padel';

const COURT_FACTORIES: Record<CourtSport, (className: string) => SVGSVGElement> = {
  tennis: tennisCourt,
  basketball: basketballCourt,
  baseball: baseballDiamond,
  hockey: hockeyRink,
  pickleball: pickleballCourt,
  badminton: badmintonCourt,
  padel: padelCourt,
};

/**
 * Map from factory `competitionFormat.sport` (uppercase) to court identifier.
 * Only sports with available court SVGs are included.
 */
const SPORT_TO_COURT: Record<string, CourtSport> = {
  TENNIS: 'tennis',
  PADEL: 'padel',
  PICKLEBALL: 'pickleball',
  BADMINTON: 'badminton',
};

/**
 * Infer a court sport from a matchUpFormat code.
 * Uses the match root (SET, HAL, INN, PER) and modifiers (@RALLY).
 */
const MATCH_ROOT_TO_COURT: Record<string, CourtSport> = {
  HAL: 'basketball',
  INN: 'baseball',
  PER: 'hockey',
};

export function sportFromMatchUpFormat(matchUpFormat?: string): CourtSport | undefined {
  if (!matchUpFormat) return undefined;

  // Check non-SET match roots first
  for (const [root, court] of Object.entries(MATCH_ROOT_TO_COURT)) {
    if (matchUpFormat.startsWith(root)) return court;
  }

  // SET-based formats
  if (matchUpFormat.startsWith('SET') || matchUpFormat.startsWith('T')) {
    if (matchUpFormat.includes('@RALLY')) return 'pickleball';
    return 'tennis';
  }

  return undefined;
}

/**
 * Resolve sport from event data. Prefers competitionFormat.sport, falls back to matchUpFormat inference.
 */
export function resolveCourtSport(event?: any): CourtSport | undefined {
  const cfSport = event?.competitionFormat?.sport;
  if (cfSport && SPORT_TO_COURT[cfSport]) return SPORT_TO_COURT[cfSport];
  return sportFromMatchUpFormat(event?.matchUpFormat);
}

/**
 * Ensure an SVG is landscape-oriented.
 * If the viewBox height > width, wraps content in a rotated group and swaps dimensions.
 */
function ensureLandscape(svg: SVGSVGElement): SVGSVGElement {
  const vb = svg.getAttribute('viewBox');
  if (!vb) return svg;

  const parts = vb.split(/\s+/).map(Number);
  if (parts.length !== 4) return svg;

  const [minX, minY, w, h] = parts;
  if (h <= w) return svg; // already landscape

  // Swap viewBox dimensions
  svg.setAttribute('viewBox', `${minX} ${minY} ${h} ${w}`);

  // Wrap all children in a rotated group
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${h}, 0) rotate(90)`);

  while (svg.firstChild) {
    g.appendChild(svg.firstChild);
  }
  svg.appendChild(g);

  return svg;
}

/**
 * Create a landscape-oriented court SVG for the given sport.
 */
export function createCourtSvg(sport: CourtSport, className = ''): SVGSVGElement | undefined {
  const factory = COURT_FACTORIES[sport];
  if (!factory) return undefined;

  const svg = factory(className ? `court--${sport} ${className}` : `court--${sport}`);
  return ensureLandscape(svg);
}

export const COURT_SVG_RESOURCE_SUB_TYPE = 'COURT_SVG';
