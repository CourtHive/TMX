import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignmentAccess,
  classifyAssignmentRole,
  clearAssignmentRole,
  getAssignmentRole,
  isScoringOnlyAssignment,
  loadAssignmentRole,
  setAssignmentRole,
} from './assignmentRole';

const post = vi.fn();
let login: any;
vi.mock('services/apis/baseApi', () => ({ baseApi: { post: (...args: any[]) => post(...args) } }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: () => login }));

const tournament = (extra: any = {}) => ({
  tournamentId: 't1',
  parentOrganisation: { organisationId: 'p1' },
  ...extra,
});
const director = {
  userId: 'u1',
  roles: ['client'],
  providerAssociations: [{ providerId: 'p1', providerRole: 'DIRECTOR' }],
};

beforeEach(() => {
  post.mockReset();
  clearAssignmentRole();
  login = director;
});

describe('classifyAssignmentRole', () => {
  it('matches the server: SCORER scores, OBSERVER runs nothing, anything else is full', () => {
    expect(classifyAssignmentRole('SCORER')).toEqual('scorer');
    expect(classifyAssignmentRole('scorer')).toEqual('scorer');
    expect(classifyAssignmentRole('OBSERVER')).toEqual('none');
    expect(classifyAssignmentRole('DIRECTOR')).toEqual('full');
    expect(classifyAssignmentRole('SOMETHING_NEW')).toEqual('full');
    expect(classifyAssignmentRole(undefined)).toEqual('full');
  });
});

describe('assignmentAccess', () => {
  it('a SCORER assignment governs a director whose access comes from it', () => {
    expect(assignmentAccess({ tournamentRecord: tournament(), loginState: director, role: 'SCORER' })).toEqual(
      'scorer',
    );
  });

  it('does not downgrade those who reach the tournament without an assignment', () => {
    const role = 'SCORER';
    const tournamentRecord = tournament();
    expect(assignmentAccess({ tournamentRecord, loginState: { roles: ['superadmin'] }, role })).toEqual('full');
    const admin = { ...director, providerAssociations: [{ providerId: 'p1', providerRole: 'PROVIDER_ADMIN' }] };
    expect(assignmentAccess({ tournamentRecord, loginState: admin, role })).toEqual('full');
    const provisioner = { ...director, provisionerProviders: [{ providerId: 'p1' }] };
    expect(assignmentAccess({ tournamentRecord, loginState: provisioner, role })).toEqual('full');
    const created = tournament({ extensions: [{ name: 'createdByUserId', value: 'u1' }] });
    expect(assignmentAccess({ tournamentRecord: created, loginState: director, role })).toEqual('full');
  });

  it('is full when there is no login or no provider to scope by', () => {
    expect(assignmentAccess({ tournamentRecord: tournament(), loginState: undefined, role: 'SCORER' })).toEqual('full');
    expect(
      assignmentAccess({ tournamentRecord: { tournamentId: 't1' }, loginState: director, role: 'SCORER' }),
    ).toEqual('full');
  });
});

describe('loadAssignmentRole', () => {
  it('keeps the role of the assignment on the tournament being opened', async () => {
    post.mockResolvedValue({
      data: {
        assignments: [
          { tournamentId: 't0', assignmentRole: 'DIRECTOR' },
          { tournamentId: 't1', assignmentRole: 'SCORER' },
        ],
      },
    });
    await loadAssignmentRole('t1');
    expect(post).toHaveBeenCalledWith('/factory/assignments/list', {}, expect.anything());
    expect(getAssignmentRole('t1')).toEqual('SCORER');
    expect(getAssignmentRole('t0')).toBeUndefined();
    expect(isScoringOnlyAssignment(tournament())).toBe(true);
  });

  it('clears the previous tournament role first, so a failure leaves full access', async () => {
    setAssignmentRole('t1', 'SCORER');
    post.mockRejectedValue(new Error('network'));
    await loadAssignmentRole('t1');
    expect(getAssignmentRole('t1')).toBeUndefined();
    expect(isScoringOnlyAssignment(tournament())).toBe(false);
  });

  it('drops a response that arrives after the tournament changed', async () => {
    post.mockResolvedValue({ data: { assignments: [{ tournamentId: 't1', assignmentRole: 'SCORER' }] } });
    await loadAssignmentRole('t1', () => false);
    expect(getAssignmentRole('t1')).toBeUndefined();
  });
});
