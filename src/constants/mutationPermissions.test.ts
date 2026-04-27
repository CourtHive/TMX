import { describe, expect, it, beforeEach, vi } from 'vitest';

// `mutationPermissions` reads `providerConfig` on every `isMutationAllowed`
// call. Mock the providerConfig module via `vi.hoisted` so the mock factory
// can reference the spy (vi.mock is hoisted above the imports otherwise).
const { isAllowedMock } = vi.hoisted(() => ({ isAllowedMock: vi.fn() }));
vi.mock('config/providerConfig', () => ({
  providerConfig: { isAllowed: isAllowedMock },
}));

import { MUTATION_PERMISSIONS, isMutationAllowed } from './mutationPermissions';

describe('MUTATION_PERMISSIONS map', () => {
  it('covers all participant CRUD mutations', () => {
    expect(MUTATION_PERMISSIONS['addParticipants']).toBe('canCreateCompetitors');
    expect(MUTATION_PERMISSIONS['deleteParticipants']).toBe('canDeleteParticipants');
    expect(MUTATION_PERMISSIONS['modifyParticipant']).toBe('canEditParticipantDetails');
  });

  it('covers official-assignment mutations under canCreateOfficials', () => {
    expect(MUTATION_PERMISSIONS['addMatchUpOfficial']).toBe('canCreateOfficials');
  });

  it('covers event CRUD mutations', () => {
    expect(MUTATION_PERMISSIONS['addEvent']).toBe('canCreateEvents');
    expect(MUTATION_PERMISSIONS['deleteEvents']).toBe('canDeleteEvents');
    expect(MUTATION_PERMISSIONS['modifyEvent']).toBe('canModifyEventFormat');
    expect(MUTATION_PERMISSIONS['setMatchUpFormat']).toBe('canModifyEventFormat');
    expect(MUTATION_PERMISSIONS['modifyTieFormat']).toBe('canModifyEventFormat');
  });

  it('covers draw CRUD mutations', () => {
    expect(MUTATION_PERMISSIONS['addDrawDefinition']).toBe('canCreateDraws');
    expect(MUTATION_PERMISSIONS['deleteDrawDefinitions']).toBe('canDeleteDraws');
    expect(MUTATION_PERMISSIONS['deleteFlightAndFlightDraw']).toBe('canDeleteDraws');
  });

  it('covers schedule mutations', () => {
    expect(MUTATION_PERMISSIONS['addMatchUpScheduleItems']).toBe('canModifySchedule');
    expect(MUTATION_PERMISSIONS['bulkScheduleMatchUps']).toBe('canModifySchedule');
    expect(MUTATION_PERMISSIONS['proAutoSchedule']).toBe('canModifySchedule');
  });

  it('covers court availability mutations', () => {
    expect(MUTATION_PERMISSIONS['modifyCourt']).toBe('canModifyCourtAvailability');
    expect(MUTATION_PERMISSIONS['modifyCourtAvailability']).toBe('canModifyCourtAvailability');
  });

  it('covers tournament-detail mutations', () => {
    expect(MUTATION_PERMISSIONS['setTournamentDates']).toBe('canModifyTournamentDetails');
    expect(MUTATION_PERMISSIONS['setTournamentName']).toBe('canModifyTournamentDetails');
    expect(MUTATION_PERMISSIONS['setRegistrationProfile']).toBe('canModifyTournamentDetails');
  });

  it('covers tournament-policy mutations', () => {
    expect(MUTATION_PERMISSIONS['attachPolicies']).toBe('canModifyPolicies');
  });

  it('covers publish + unpublish mutations on the appropriate ceiling', () => {
    expect(MUTATION_PERMISSIONS['publishEvent']).toBe('canPublish');
    expect(MUTATION_PERMISSIONS['publishOrderOfPlay']).toBe('canPublish');
    expect(MUTATION_PERMISSIONS['unPublishEvent']).toBe('canUnpublish');
  });
});

describe('isMutationAllowed', () => {
  beforeEach(() => {
    isAllowedMock.mockReset();
  });

  it('returns true for unmapped mutations without consulting providerConfig', () => {
    expect(isMutationAllowed('someUnknownMutation')).toBe(true);
    expect(isAllowedMock).not.toHaveBeenCalled();
  });

  it('consults providerConfig for mapped mutations', () => {
    isAllowedMock.mockReturnValue(true);
    expect(isMutationAllowed('addEvent')).toBe(true);
    expect(isAllowedMock).toHaveBeenCalledWith('canCreateEvents');
  });

  it('returns false when providerConfig denies', () => {
    isAllowedMock.mockReturnValue(false);
    expect(isMutationAllowed('deleteEvents')).toBe(false);
    expect(isAllowedMock).toHaveBeenCalledWith('canDeleteEvents');
  });
});
