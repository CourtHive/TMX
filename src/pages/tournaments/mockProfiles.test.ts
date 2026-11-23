import { mockProfiles, withTournamentCategories } from 'pages/tournaments/mockProfiles';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

/**
 * The example tournaments are what people first see in TMX, so their categories must make sense:
 * an event's category is one the tournament defines, it carries a rule (an age code or a rating range)
 * rather than only a name, and everyone entered may enter it. Before this, CourtHive Challenge's
 * "U18 Boys Doubles" named "U18" without an age code (so the event editor showed no category), and no
 * example defined any tournament category at all.
 */
function generate(profile: any) {
  const { build, ...rest } = profile;
  const built = build?.();
  // a time-relative example with no usable competition clock is skipped by TMX too
  if (build && !built) return undefined;
  const { tournamentRecord } = mocksEngine.generateTournamentRecord(
    withTournamentCategories(built ? { ...rest, ...built } : rest),
  );
  return tournamentRecord;
}

/** The individuals an entry stands for: itself, a pair's two members, or a team's roster. */
function individualsOf(participantId: string, byId: Map<string, any>): any[] {
  const participant = byId.get(participantId);
  if (!participant) return [];
  if (participant.participantType === 'INDIVIDUAL') return [participant];
  return (participant.individualParticipantIds ?? []).map((id: string) => byId.get(id)).filter(Boolean);
}

describe.each(mockProfiles.map((profile: any) => [profile.tournamentName, profile]))('%s', (_name, profile) => {
  const tournamentRecord: any = generate(profile);

  it.runIf(!!tournamentRecord)('defines every category its events use, each with a rule', () => {
    const defined = new Set((tournamentRecord.tournamentCategories ?? []).map((c: any) => c.categoryName));
    for (const event of tournamentRecord.events ?? []) {
      if (!event.category) continue;
      expect(defined, `${event.eventName}: category "${event.category.categoryName}"`).toContain(
        event.category.categoryName,
      );
      const hasRule = !!event.category.ageCategoryCode || !!event.category.ratingType;
      expect(hasRule, `${event.eventName}: category with a name but no age code or rating`).toBe(true);
    }
  });

  it.runIf(!!tournamentRecord)('enters only participants eligible for each event', () => {
    tournamentEngine.setState(tournamentRecord);
    const participants: any[] = tournamentEngine.getParticipants().participants ?? [];
    const byId = new Map(participants.map((p) => [p.participantId, p]));
    const ineligible: string[] = [];
    for (const event of tournamentRecord.events ?? []) {
      if (!event.category) continue;
      for (const { participantId } of event.entries ?? []) {
        for (const individual of individualsOf(participantId, byId)) {
          const { eligible, rejectionReasons } = tournamentEngine.getParticipantEligibility({
            participant: individual,
            event,
          }) as any;
          if (!eligible)
            ineligible.push(
              `${event.eventName}: ${individual.participantName} (${rejectionReasons?.map((r: any) => r.reason).join('; ')})`,
            );
        }
      }
    }
    expect(ineligible).toEqual([]);
  });
});
