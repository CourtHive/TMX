import { collectReportParticipantIds, resolveReportParticipantId } from './reportParticipants';
import { describe, expect, it } from 'vitest';

const individual = (participantId: string) => ({ participantId, participantType: 'INDIVIDUAL' });
const pair = (participantId: string, individuals: any[]) => ({
  individualParticipants: individuals,
  participantType: 'PAIR',
  participantId,
});
const team = (participantId: string, individuals: any[]) => ({
  individualParticipants: individuals,
  participantType: 'TEAM',
  participantId,
});

describe('resolveReportParticipantId', () => {
  it('resolves an individual clicked directly', () => {
    expect(resolveReportParticipantId({ individualParticipant: individual('p1') })).toEqual('p1');
  });

  it('resolves the clicked half of a pair rather than the pair', () => {
    const p = pair('pair1', [individual('p1'), individual('p2')]);
    // `sideBySide` layout renders each individual separately, so the click
    // carries the individual while the row still carries the pair.
    expect(resolveReportParticipantId({ individualParticipant: individual('p2'), participant: p })).toEqual('p2');
  });

  it('returns undefined for a pair of two — picking one would be arbitrary', () => {
    const p = pair('pair1', [individual('p1'), individual('p2')]);
    // The trap: renderParticipant hands a PAIR through as `individualParticipant`
    // when there is no matchUp, so the parameter name cannot be trusted.
    expect(resolveReportParticipantId({ individualParticipant: p })).toBeUndefined();
  });

  it('resolves a pair holding exactly one individual — the only possible answer', () => {
    expect(resolveReportParticipantId({ participant: pair('pair1', [individual('p1')]) })).toEqual('p1');
  });

  it('returns undefined for a team, whose card would be empty', () => {
    const t = team('team1', [individual('p1'), individual('p2'), individual('p3')]);
    expect(resolveReportParticipantId({ participant: t })).toBeUndefined();
  });

  it('returns undefined for missing, empty and id-less input', () => {
    expect(resolveReportParticipantId()).toBeUndefined();
    expect(resolveReportParticipantId({})).toBeUndefined();
    expect(resolveReportParticipantId({ participant: { participantType: 'INDIVIDUAL' } })).toBeUndefined();
    expect(
      resolveReportParticipantId({ participant: { participantType: 'INDIVIDUAL', participantId: '' } }),
    ).toBeUndefined();
  });

  it('prefers the clicked individual over the row participant', () => {
    expect(
      resolveReportParticipantId({
        individualParticipant: individual('clicked'),
        participant: individual('row'),
      }),
    ).toEqual('clicked');
  });
});

describe('collectReportParticipantIds', () => {
  it('collects individuals in row order', () => {
    const rows = [{ participant: individual('p1') }, { participant: individual('p2') }];
    expect(collectReportParticipantIds(rows)).toEqual(['p1', 'p2']);
  });

  it('expands a pair into both of its individuals', () => {
    const rows = [{ participant: pair('pair1', [individual('p1'), individual('p2')]) }];
    // Both halves must be reachable by prev/next, and the pair id itself must
    // NOT appear — the card cannot render it.
    expect(collectReportParticipantIds(rows)).toEqual(['p1', 'p2']);
  });

  it('dedupes a participant appearing in several rows', () => {
    const rows = [
      { participant: individual('p1') },
      { participant: pair('pair1', [individual('p1'), individual('p2')]) },
      { participant: individual('p2') },
    ];
    expect(collectReportParticipantIds(rows)).toEqual(['p1', 'p2']);
  });

  it('skips rows with no hydrated participant', () => {
    const rows = [{ participantId: 'p1' }, { participant: individual('p2') }, {}];
    // participantId alone is not enough — hydration is what proves the
    // participant exists in this tournament.
    expect(collectReportParticipantIds(rows)).toEqual(['p2']);
  });

  it('returns an empty list for empty and missing input', () => {
    expect(collectReportParticipantIds([])).toEqual([]);
    expect(collectReportParticipantIds(undefined as any)).toEqual([]);
  });
});
