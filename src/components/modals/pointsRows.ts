/**
 * The participant card's ranking-points rows for one event, from that event's awards.
 *
 * Points are awarded to the people who earned them: in a doubles event the factory awards each PLAYER of a pair,
 * never the pair itself. A card for a pair (or a team) therefore matches the awards of its members, not only its own
 * participantId, and labels each row with the member it belongs to. Matching the card's own participantId alone left
 * a pair's event row blank in every points column (finish, wins, position, per-win, bonus, quality, total).
 */
export function pointsRowsForEvent({
  participantId,
  personId,
  individualParticipantIds = [],
  awards = [],
  eventId,
  eventName,
}: {
  participantId: string;
  personId?: string;
  individualParticipantIds?: string[];
  awards?: any[];
  eventId: string;
  eventName: string;
}): any[] {
  const members = new Set(individualParticipantIds);
  const own = (award: any) => award.participantId === participantId || (!!personId && award.personId === personId);
  const matched = awards.filter((award) => own(award) || members.has(award.participantId));
  if (!matched.length) return [{ eventName, eventId, points: 0 }];
  return matched.map((award) => ({
    ...award,
    eventId,
    // a member's row says whose it is: a pair's card shows one row per player
    eventName: own(award) ? eventName : `${eventName} · ${award.participantName ?? award.participantId}`,
  }));
}

/**
 * The card's total. A player's card sums its rows. A pair's (or team's) rows belong to different players, and adding
 * them would claim points nobody earned (two partners on 100 are not a pair on 200): the total is per player then.
 */
export function pointsTotalLabel(rows: any[]): string {
  const byPlayer = new Map<string, { name: string; points: number }>();
  for (const row of rows) {
    const key = row.participantId ?? '';
    const entry = byPlayer.get(key) ?? { name: row.participantName ?? key, points: 0 };
    entry.points += row.points || 0;
    byPlayer.set(key, entry);
  }
  const players = [...byPlayer.entries()].filter(([key]) => key);
  if (players.length <= 1) return `Total: ${rows.reduce((sum, row) => sum + (row.points || 0), 0)}`;
  const totals = players.map(([, { points }]) => points);
  if (totals.every((points) => points === totals[0])) return `Total: ${totals[0]} per player`;
  const perPlayer = players.map(([, { name, points }]) => name + ' ' + points).join(' · ');
  return `Total: ${perPlayer}`;
}
