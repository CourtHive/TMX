import { practiceGovernor } from 'tods-competition-factory';

/**
 * Looks up active practice registrations and returns a courtId →
 * participant-name map for any registration whose sub-window contains the
 * given clock time. Powers the Now/Live strip "who's on court right now"
 * surface for PRACTICE bookings. Cancelled registrations are excluded by
 * the factory query default.
 *
 * `currentHM` is a `'HH:MM'` string; comparisons against
 * `registration.startTime` / `registration.endTime` are lexicographic
 * (the factory persists both fields in the same 24h zero-padded format).
 */
export function getActiveRegistrationNamesByCourtId({
  tournamentRecord,
  date,
  currentHM,
}: {
  tournamentRecord: any;
  date: string;
  currentHM: string;
}): Record<string, string[]> {
  if (!tournamentRecord) return {};

  const result = practiceGovernor.getPracticeRegistrations({ tournamentRecord, date });
  const records = result?.registrations ?? [];
  if (!records.length) return {};

  const nameById = buildParticipantNameMap(tournamentRecord);
  const byCourtId: Record<string, string[]> = {};

  for (const { registration, courtId } of records) {
    if (registration.startTime > currentHM) continue;
    if (registration.endTime <= currentHM) continue;
    const name = nameById.get(registration.participantId);
    if (!name) continue;
    byCourtId[courtId] ??= [];
    byCourtId[courtId].push(name);
  }

  return byCourtId;
}

export function buildParticipantNameMap(tournamentRecord: any): Map<string, string> {
  const map = new Map<string, string>();
  for (const participant of tournamentRecord?.participants ?? []) {
    if (participant?.participantId && participant.participantName) {
      map.set(participant.participantId, participant.participantName);
    }
  }
  return map;
}
