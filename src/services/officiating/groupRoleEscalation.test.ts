/**
 * End-to-end proof that the GROUP role escalation is reachable from what TMX can now author.
 *
 * Before `editGroupingParticipant` gained a role select, every GROUP a TD could create landed as OTHER —
 * the one value that falls through `ConflictRule.roleSeverity` to the rule's base severity. So
 * SHARED_GROUPING could only ever WARN, and anyone testing conflict blocking would have concluded it was
 * broken. This asserts both halves of the distinction against the real factory.
 */
import {
  fixtures,
  mocksEngine,
  participantConstants,
  participantRoles,
  tournamentEngine,
} from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const { COACH, OFFICIAL, OTHER } = participantRoles;
const { INDIVIDUAL } = participantConstants;

/** Fresh tournament each time so groups from one case cannot contaminate the other. */
function conflictsForGroupRole(participantRole: string) {
  const {
    tournamentRecord,
    drawIds: [drawId],
  } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 8 }], setState: true, nonRandom: 1 });
  const tournamentId = tournamentRecord.tournamentId;

  const { participant: official }: any = tournamentEngine.addParticipant({
    returnParticipant: true,
    tournamentId,
    participant: {
      participantRole: OFFICIAL,
      participantType: INDIVIDUAL,
      person: { standardFamilyName: 'Umpire', standardGivenName: 'Chair' },
    },
  });

  const { matchUps }: any = tournamentEngine.allTournamentMatchUps();
  const matchUp = matchUps.find((m: any) => m.sides?.every((s: any) => s?.participantId));

  const created: any = tournamentEngine.createGroupParticipant({
    individualParticipantIds: [official.participantId, matchUp.sides[0].participantId],
    groupName: `Group ${participantRole}`,
    participantRole,
    tournamentId,
  });
  expect(created.success).toEqual(true);

  return (tournamentEngine as any).getMatchUpOfficialConflicts({
    policyDefinitions: fixtures.policies.POLICY_OFFICIATING_CONFLICT_OF_INTEREST,
    officialParticipantId: official.participantId,
    matchUpId: matchUp.matchUpId,
    drawId,
  });
}

describe('GROUP participantRole drives conflict severity', () => {
  it('a COACH group BLOCKS the official assignment', () => {
    const result: any = conflictsForGroupRole(COACH);
    expect(result.error).toBeUndefined();
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].groupRole).toEqual(COACH);
    expect(result.conflicts[0].severity).toEqual('BLOCK');
    expect(result.blocked).toBe(true);
  });

  it('an OTHER group only WARNS — the pre-fix behaviour, now the neutral default', () => {
    const result: any = conflictsForGroupRole(OTHER);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].groupRole).toEqual(OTHER);
    expect(result.conflicts[0].severity).toEqual('WARN');
    expect(result.blocked).toBe(false);
  });
});
