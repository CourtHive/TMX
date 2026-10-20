import { GUIDED_DEMO_ID_PREFIX, SCHEDULER_DEMO_ID, staleGuidedDemoIds } from './schedulingDemoScript';
import { describe, expect, it } from 'vitest';

describe('staleGuidedDemoIds', () => {
  it('names every earlier guided-demo copy except the one just loaded', () => {
    const keep = `${GUIDED_DEMO_ID_PREFIX}new`;
    const ids = [`${GUIDED_DEMO_ID_PREFIX}a`, keep, 'club-open-2026', SCHEDULER_DEMO_ID, `${GUIDED_DEMO_ID_PREFIX}b`];
    expect(staleGuidedDemoIds(ids, keep)).toEqual([`${GUIDED_DEMO_ID_PREFIX}a`, `${GUIDED_DEMO_ID_PREFIX}b`]);
  });

  it('never names a record that is not a guided-demo copy', () => {
    expect(staleGuidedDemoIds(['club-open-2026', SCHEDULER_DEMO_ID], `${GUIDED_DEMO_ID_PREFIX}x`)).toEqual([]);
  });
});
