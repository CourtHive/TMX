import { buildTimingModel, describeTiming } from './inspectorTiming';
import { describe, expect, it } from 'vitest';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';
import type { RestTiming } from './participantRest';

const FORMAT = 'SET1-S:6NOAD/TB7';
const matchUp = (over: Partial<ReadinessMatchUp> = {}): ReadinessMatchUp =>
  ({ matchUpId: 'm1', matchUpFormat: FORMAT, ...over }) as ReadinessMatchUp;
const timing = (over: Partial<RestTiming> = {}): RestTiming => ({
  averageMinutes: 90,
  recoveryMinutes: 60,
  typeChangeRecoveryMinutes: 0,
  ...over,
});

describe('buildTimingModel', () => {
  it('carries the resolved average and recovery', () => {
    const model = buildTimingModel(matchUp(), timing(), 'tournament');
    expect(model).toEqual({ averageMinutes: 90, recoveryMinutes: 60, source: 'tournament' });
  });

  it('says nothing for a matchUp with no format', () => {
    // The resolver falls back to a flat 90/0 in that case, and printing that as
    // though it had been resolved would be a fiction dressed as a figure.
    expect(buildTimingModel(matchUp({ matchUpFormat: undefined }), timing(), 'default')).toBeNull();
    expect(buildTimingModel(undefined, timing(), 'default')).toBeNull();
  });

  it('reports a type-change figure only when it differs from ordinary recovery', () => {
    expect(
      buildTimingModel(matchUp(), timing({ typeChangeRecoveryMinutes: 30 }), 'event')?.typeChangeRecoveryMinutes,
    ).toBe(30);
    // Equal to the ordinary figure says nothing; zero means the policy does not
    // charge for a type change at all.
    expect(
      buildTimingModel(matchUp(), timing({ typeChangeRecoveryMinutes: 60 }), 'event')?.typeChangeRecoveryMinutes,
    ).toBeUndefined();
    expect(buildTimingModel(matchUp(), timing(), 'event')?.typeChangeRecoveryMinutes).toBeUndefined();
  });

  it('keeps a zero recovery, which is a real answer', () => {
    // "This event charges no recovery" is a statement worth showing, and is not
    // the same as having nothing to say.
    expect(buildTimingModel(matchUp(), timing({ recoveryMinutes: 0 }), 'default')?.recoveryMinutes).toBe(0);
  });
});

describe('describeTiming', () => {
  it('reads in the panel own duration vocabulary, so the figures match the rest rows', () => {
    const text = describeTiming(buildTimingModel(matchUp(), timing(), 'default')!);
    expect(text).toContain('1h 30m');
    expect(text).toContain('1h 0m');
    expect(text).toContain('average');
    expect(text).toContain('recovery');
  });

  it('appends the type-change figure only when there is one', () => {
    const withChange = describeTiming(
      buildTimingModel(matchUp(), timing({ typeChangeRecoveryMinutes: 30 }), 'default')!,
    );
    expect(withChange).toContain('type change');

    const without = describeTiming(buildTimingModel(matchUp(), timing(), 'default')!);
    expect(without).not.toContain('type change');
  });

  it('renders sub-hour figures as minutes alone', () => {
    const text = describeTiming(
      buildTimingModel(matchUp(), timing({ averageMinutes: 30, recoveryMinutes: 0 }), 'default')!,
    );
    expect(text).toContain('30m');
    expect(text).toContain('0m');
  });
});
