/**
 * The participants an entry refusal names, in the shape invalidParticipantsModal lists.
 *
 * addEventEntries refuses the whole call when any participant fails the event's category or gender,
 * and says who and why in the refusal's context. Every path that enters participants (adding to an
 * event, from the participants table or the entries table, and creating an event from a selection)
 * reads it here, so each shows the same reasons rather than a bare "Invalid participants".
 */
export function invalidParticipantsFromRefusal(ctx: any): any[] {
  const invalid: any[] = [];
  if (!ctx) return invalid;
  for (const p of ctx.categoryRejections ?? [])
    invalid.push({
      participantId: p.participantId,
      participantName: p.participantName,
      errors: [
        { error: p.rejectionReasons?.[0]?.type || 'categoryRejection', reason: p.rejectionReasons?.[0]?.reason },
      ],
    });
  for (const p of ctx.mismatchedGender ?? [])
    invalid.push({
      participantId: p.participantId,
      errors: [{ error: 'mismatchedGender', sex: p.sex, expectedGender: ctx.gender }],
    });
  for (const p of ctx.invalidAge ?? [])
    invalid.push({ participantId: p.participantId, errors: [{ error: 'invalidAge', ...p }] });
  for (const p of ctx.invalidRating ?? [])
    invalid.push({ participantId: p.participantId, errors: [{ error: 'invalidRating', ...p }] });
  return invalid;
}
