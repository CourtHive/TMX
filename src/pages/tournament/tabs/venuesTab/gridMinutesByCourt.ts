/**
 * Minutes of play placed on each court's schedule grid. A matchUp counts when it sits in a grid row (`courtOrder`)
 * and has an average to give; a `courtId` with no row is only a suggestion, shown on the catalogue card, and a
 * matchUp with no average has no length to count.
 */
export function gridMinutesByCourt(
  matchUps: any[],
  averageMinutes: (matchUp: any) => number | undefined,
): Map<string, number> {
  const minutes = new Map<string, number>();
  for (const matchUp of matchUps ?? []) {
    const { courtId, courtOrder } = matchUp?.schedule ?? {};
    if (!courtId || !courtOrder) continue;
    const average = averageMinutes(matchUp);
    if (!average) continue;
    minutes.set(courtId, (minutes.get(courtId) ?? 0) + average);
  }
  return minutes;
}
