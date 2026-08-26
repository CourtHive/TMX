/**
 * Naming for courts added to an EXISTING venue.
 *
 * The engine names generated courts `${courtNameRoot} ${i + 1}`, restarting at 1 on every call — so
 * adding two courts to a venue that already holds "Court 1".."Court 15" produced a second "Court 1"
 * and "Court 2". Seen in production on 2026-08-23 (CFS audit_log, tournament 6c637f87): the operator
 * added two courts and immediately renamed both by hand to "Court 20" and "Court 21".
 *
 * Passing explicit `courtNames` overrides the engine's numbering, which is what these helpers build.
 */

/** "Court 12" → base "Court", index 12. Anything without a trailing number is not a numbered name. */
const NUMBERED_NAME = /^(.*\S)\s+(\d+)$/;

const DEFAULT_ROOT = 'Court';

type NumberedName = { base: string; index: number };

function parseNumberedName(courtName?: string): NumberedName | undefined {
  const match = courtName?.match(NUMBERED_NAME);
  if (!match) return undefined;
  return { base: match[1], index: Number(match[2]) };
}

/**
 * The naming convention a venue actually uses, by weight of numbers rather than unanimity.
 *
 * `deriveCourtNameBase` requires EVERY court to share a base and answers '' otherwise, which is the
 * common real case — a venue of "Court 1".."Court 15" plus one "Center (17)" has no unanimous base,
 * and falling back to the default root there is precisely what produced the duplicate "Court 1".
 * One oddly-named show court should not cost the other fifteen their convention.
 */
export function dominantCourtNameBase(courts: any[] = []): string | undefined {
  const weights = new Map<string, number>();
  for (const court of courts) {
    const parsed = parseNumberedName(court?.courtName);
    if (parsed) weights.set(parsed.base, (weights.get(parsed.base) ?? 0) + 1);
  }

  let winner: string | undefined;
  let winningWeight = 0;
  for (const [base, weight] of weights) {
    // Ties resolve alphabetically so the answer does not depend on court order.
    const beatsWinner =
      weight > winningWeight || (weight === winningWeight && !!winner && base.localeCompare(winner, 'en') < 0);
    if (beatsWinner) {
      winner = base;
      winningWeight = weight;
    }
  }
  return winner;
}

/**
 * The next `count` court names for a venue, continuing its existing numbering.
 *
 * Counts up from the highest index already in use for the chosen base — `max + 1`, not
 * `existing.length + 1`, so a venue with a deleted court in the middle does not reissue a name that
 * is still on a scheduled matchUp. That rule alone makes a collision impossible for the chosen base;
 * the explicit skip below is what keeps the invariant true if it is ever changed.
 */
export function nextCourtNames({
  courts = [],
  count,
  base,
}: {
  courts?: any[];
  count: number;
  base?: string;
}): string[] {
  if (!Number.isInteger(count) || count < 1) return [];

  const root = base?.trim() || dominantCourtNameBase(courts) || DEFAULT_ROOT;
  const taken = new Set<string>(courts.map((court: any) => court?.courtName).filter(Boolean));

  let highest = 0;
  for (const court of courts) {
    const parsed = parseNumberedName(court?.courtName);
    if (parsed?.base === root && parsed.index > highest) highest = parsed.index;
  }

  const names: string[] = [];
  let next = highest;
  while (names.length < count) {
    next += 1;
    const candidate = `${root} ${next}`;
    if (taken.has(candidate)) continue;
    taken.add(candidate);
    names.push(candidate);
  }
  return names;
}

/** "Court 16, Court 17" — or "Court 16, Court 17, … Court 35" once the list stops being readable. */
export function summariseCourtNames(names: string[], maxListed = 4): string {
  if (names.length <= maxListed) return names.join(', ');
  return `${names.slice(0, maxListed - 1).join(', ')}, … ${names.at(-1)}`;
}
