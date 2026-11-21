import { isPipelineActive } from 'services/pipeline/pipelineFeatures';
import { describe, expect, it } from 'vitest';
import { buildWarpCopy } from './warpCopy';

const SOURCE = 'original-id';
const COPY = 'time-warp-copy';

describe('sandbox record identity', () => {
  it('rebases structured references, maps, URLs and JSON extension values without rewriting prose', () => {
    const source = {
      tournamentId: SOURCE,
      tournamentName: SOURCE,
      isMock: false,
      notes: `See ${SOURCE} later`,
      participants: [{ participantId: 'person', name: SOURCE }],
      scheduleScenarios: [{ placements: [{ tournamentId: SOURCE, matchUpId: 'match' }] }],
      extensions: [
        { name: 'linkedTournamentIds', value: { tournamentIds: [SOURCE, 'peer'] } },
        { name: 'reference', value: SOURCE },
        { name: 'encoded', value: JSON.stringify({ tournamentId: SOURCE }) },
      ],
      link: `https://viewer.test/#/tournament/${SOURCE}/event/e`,
      query: `https://viewer.test/api?tournamentId=${SOURCE}`,
      tournamentRecords: { [SOURCE]: { tournamentId: SOURCE } },
    };
    const before = structuredClone(source);
    const copy = buildWarpCopy(source, COPY);
    expect(copy).toMatchObject({ tournamentId: COPY, tournamentName: SOURCE, isMock: true });
    expect(isPipelineActive(source, true)).toBe(false);
    expect(isPipelineActive(copy, true)).toBe(true);
    expect(copy.scheduleScenarios[0].placements[0].tournamentId).toBe(COPY);
    expect(copy.extensions[0].value.tournamentIds).toEqual([COPY, 'peer']);
    expect(copy.extensions[1].value).toBe(COPY);
    expect(JSON.parse(copy.extensions[2].value).tournamentId).toBe(COPY);
    expect(copy.link).toBe(`https://viewer.test/#/tournament/${COPY}/event/e`);
    expect(copy.query).toContain(`tournamentId=${COPY}`);
    expect(copy.tournamentRecords[COPY].tournamentId).toBe(COPY);
    copy.participants[0].name = 'Changed';
    expect(source).toEqual(before);
  });

  it('does not alias deep source values or treat arbitrary extension text as instructions', () => {
    const source: any = { tournamentId: SOURCE, extensions: [{ name: 'opaque', value: `source=${SOURCE}` }] };
    let node = source;
    for (let i = 0; i < 100; i++) {
      node.child = { value: i };
      node = node.child;
    }
    const copy = buildWarpCopy(source, COPY);
    let deep = copy;
    for (let i = 0; i < 100; i++) deep = deep.child;
    deep.value = 999;
    expect(node.value).toBe(99);
    expect(copy.extensions[0].value).toBe(`source=${SOURCE}`);
  });
});
