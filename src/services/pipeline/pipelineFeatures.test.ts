import { describe, it, expect } from 'vitest';

import {
  PIPELINE_POLICY_NAME,
  applyPipelineOverrides,
  callOverrideParams,
  hasForeignPolicy,
  isPipelineActive,
  isPipelineEligible,
  isPipelineModified,
  pipelineForcesLocal,
  policyMutation,
  readPolicySettings,
} from './pipelineFeatures';
import type { PipelineCallOverrides } from 'config/pipelineConfig';

const DEFAULTS: PipelineCallOverrides = {
  propagateExitStatus: 'default',
  propagateRetirementAsExit: 'default',
  allowChangePropagation: 'default',
  disableScoreValidation: 'default',
};

const applied = (policies: Record<string, any>) => [{ name: 'appliedPolicies', value: policies }];
const mock = (extra: any = {}) => ({ tournamentId: 't', isMock: true, ...extra });
const real = (extra: any = {}) => ({ tournamentId: 't', ...extra });
const ours = (fields: any = {}) => ({ policyName: PIPELINE_POLICY_NAME, ...fields });

describe('the gate — CA: on when logged out, or on a mock tournament', () => {
  it('is eligible logged out, whatever the tournament', () => {
    expect(isPipelineEligible(real(), false)).toBe(true);
  });

  it('is eligible logged in only on a mock tournament', () => {
    expect(isPipelineEligible(mock(), true)).toBe(true);
    expect(isPipelineEligible(real(), true)).toBe(false);
  });

  it("a scoring policy of the tournament's own turns it off — at tournament, event or draw level", () => {
    const foreign = { policyName: 'USTA', propagateExitStatus: true };
    expect(isPipelineActive(mock({ extensions: applied({ scoring: foreign }) }), false)).toBe(false);
    expect(isPipelineActive(mock({ events: [{ extensions: applied({ scoring: foreign }) }] }), false)).toBe(false);
    const draw = { extensions: applied({ scoring: foreign }) };
    expect(isPipelineActive(mock({ events: [{ drawDefinitions: [draw] }] }), false)).toBe(false);
  });

  it("the panel's own scoring policy does not turn it off, and a seeding policy is irrelevant", () => {
    expect(isPipelineActive(mock({ extensions: applied({ scoring: ours() }) }), true)).toBe(true);
    const draw = { extensions: applied({ seeding: { policyName: 'ITF' } }) };
    expect(isPipelineActive(mock({ events: [{ drawDefinitions: [draw] }] }), true)).toBe(true);
  });

  it('is off with no tournament loaded', () => {
    expect(isPipelineActive(undefined, false)).toBe(false);
  });
});

describe('per-call injection', () => {
  it('injects nothing while every option is default', () => {
    expect(callOverrideParams(DEFAULTS)).toEqual({});
    const methods = [{ method: 'setMatchUpStatus', params: { allowChangePropagation: true } }];
    expect(applyPipelineOverrides(methods, {})).toBe(methods);
  });

  it('on and off become booleans', () => {
    const params = callOverrideParams({ ...DEFAULTS, propagateExitStatus: 'on', allowChangePropagation: 'off' });
    expect(params).toEqual({ propagateExitStatus: true, allowChangePropagation: false });
  });

  it("overrides what the call path set — Off beats the score dialog's true", () => {
    const methods = [{ method: 'setMatchUpStatus', params: { matchUpId: 'm', allowChangePropagation: true } }];
    const [result] = applyPipelineOverrides(methods, { allowChangePropagation: false });
    expect(result.params).toEqual({ matchUpId: 'm', allowChangePropagation: false });
  });

  it('touches only setMatchUpStatus', () => {
    const methods = [
      { method: 'setMatchUpStatus', params: {} },
      { method: 'addMatchUpScheduleItems', params: { a: 1 } },
    ];
    const result = applyPipelineOverrides(methods, { propagateExitStatus: true });
    expect(result[0].params).toEqual({ propagateExitStatus: true });
    expect(result[1].params).toEqual({ a: 1 });
  });
});

describe('attached policies', () => {
  it('reads default when the panel attached nothing, and ignores a policy it did not attach', () => {
    expect(readPolicySettings(mock(), 'progression').doubleExitPropagateBye).toBe('default');
    const foreign = mock({ extensions: applied({ progression: { doubleExitPropagateBye: false } }) });
    expect(readPolicySettings(foreign, 'progression').doubleExitPropagateBye).toBe('default');
  });

  it('a value equal to the factory default reads as default', () => {
    const record = mock({ extensions: applied({ progression: ours({ doubleExitPropagateBye: true }) }) });
    expect(readPolicySettings(record, 'progression').doubleExitPropagateBye).toBe('default');
  });

  it('attaches the factory default with the choice over it, marked as the panel’s', () => {
    const method: any = policyMutation(mock(), 'progression', { doubleExitPropagateBye: 'off' });
    expect(method.method).toBe('attachPolicies');
    expect(method.params.allowReplacement).toBe(true);
    const policy = method.params.policyDefinitions.progression;
    expect(policy.policyName).toBe(PIPELINE_POLICY_NAME);
    expect(policy.doubleExitPropagateBye).toBe(false);
    expect(policy.autoPlaceQualifiers).toBe(false);
  });

  it('the scoring policy it attaches stays SILENT on the per-call flags, so those still decide', () => {
    const method: any = policyMutation(mock(), 'scoring', { requireParticipantsForScoring: 'on' });
    const policy = method.params.policyDefinitions.scoring;
    expect(policy.requireParticipantsForScoring).toBe(true);
    expect(policy.propagateExitStatus).toBeUndefined();
    expect(policy.propagateRetirementAsExit).toBeUndefined();
    expect(policy.allowChangePropagation).toBeUndefined();
  });

  it('removes its policy once every option is back to default, and does nothing if it had none', () => {
    const record = mock({ extensions: applied({ progression: ours({ doubleExitPropagateBye: false }) }) });
    expect(policyMutation(record, 'progression', { doubleExitPropagateBye: 'default' })).toEqual({
      method: 'removePolicy',
      params: { policyType: 'progression' },
    });
    expect(policyMutation(mock(), 'progression', { doubleExitPropagateBye: 'default' })).toBeUndefined();
  });

  it('a foreign progression policy is detected separately from scoring', () => {
    const record = mock({ extensions: applied({ progression: { doubleExitPropagateBye: false } }) });
    expect(hasForeignPolicy(record, 'progression')).toBe(true);
    expect(hasForeignPolicy(record, 'scoring')).toBe(false);
  });
});

describe('local execution — CA: force local for a mock tournament in use', () => {
  const modified = { ...DEFAULTS, propagateExitStatus: 'on' as const };

  it('forces local on a mock tournament once anything is modified', () => {
    expect(pipelineForcesLocal(mock(), modified, true)).toBe(true);
    expect(pipelineForcesLocal(mock({ extensions: applied({ progression: ours() }) }), DEFAULTS, true)).toBe(true);
  });

  it('leaves an unmodified mock tournament on its usual path — e2e journeys sync mocks to the server', () => {
    expect(pipelineForcesLocal(mock(), DEFAULTS, true)).toBe(false);
  });

  it("the call that attaches the panel's FIRST policy is local too", () => {
    const attach: any = policyMutation(mock(), 'progression', { doubleExitPropagateBye: 'off' });
    expect(pipelineForcesLocal(mock(), DEFAULTS, true, [attach])).toBe(true);
  });

  it('never forces a real tournament, and never while inactive', () => {
    expect(pipelineForcesLocal(real(), modified, true)).toBe(false);
    expect(pipelineForcesLocal(mock(), modified, false)).toBe(false);
  });

  it('isPipelineModified sees both layers', () => {
    expect(isPipelineModified(mock(), DEFAULTS)).toBe(false);
    expect(isPipelineModified(mock(), modified)).toBe(true);
    expect(isPipelineModified(mock({ extensions: applied({ scoring: ours() }) }), DEFAULTS)).toBe(true);
  });
});
