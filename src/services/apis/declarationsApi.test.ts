import { describe, it, expect } from 'vitest';

import { mapSnapshotToEntry, type RegistrationSnapshot } from './declarationsApi';

const snap: RegistrationSnapshot = {
  declarationId: 'd-1',
  personId: 'p-1',
  providerId: 'BOBOCA',
  tournamentId: 't-1',
  status: 'SUBMITTED',
  payload: { eventIds: ["Men's Singles"], applicant: { givenName: 'Jane', familyName: 'Doe' }, answers: { note: 'hi' } },
  updatedAt: '2027-01-01T00:00:00.000Z',
};

describe('mapSnapshotToEntry', () => {
  it('maps declarationId → registrationId and pulls the applicant name off the payload', () => {
    const entry = mapSnapshotToEntry(snap, 't-1');
    expect(entry.registrationId).toBe('d-1');
    expect(entry.personId).toBe('p-1');
    expect(entry.eventIds).toEqual(["Men's Singles"]);
    expect(entry.applicantGivenName).toBe('Jane');
    expect(entry.applicantFamilyName).toBe('Doe');
    expect(entry.answers).toEqual({ note: 'hi' });
  });

  it('maps declarations statuses to the tab statuses', () => {
    expect(mapSnapshotToEntry({ ...snap, status: 'SUBMITTED' }, 't-1').status).toBe('applied');
    expect(mapSnapshotToEntry({ ...snap, status: 'ACCEPTED' }, 't-1').status).toBe('accepted');
    expect(mapSnapshotToEntry({ ...snap, status: 'WAITLISTED' }, 't-1').status).toBe('waitlisted');
    expect(mapSnapshotToEntry({ ...snap, status: 'REJECTED' }, 't-1').status).toBe('rejected');
    expect(mapSnapshotToEntry({ ...snap, status: 'WITHDRAWN' }, 't-1').status).toBe('withdrawn');
  });

  it('defaults sensibly when the payload is sparse', () => {
    const entry = mapSnapshotToEntry({ ...snap, payload: {} as any }, 't-fallback');
    expect(entry.eventIds).toEqual([]);
    expect(entry.applicantGivenName).toBeNull();
    expect(entry.answers).toEqual({});
  });
});
