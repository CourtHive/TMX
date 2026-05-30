import { describe, expect, it } from 'vitest';
import { jerseySorter, parseJersey, splitMembership } from './teamProfileLogic';

// ── Fixture helpers ──

const individual = (
  id: string,
  overrides: { role?: string; teamName?: string } = {},
): any => ({
  participantId: id,
  participantName: id,
  participantType: 'INDIVIDUAL',
  participantRole: overrides.role,
  person: {
    biographicalInformation: overrides.teamName ? { teamAttributes: [{ teamName: overrides.teamName }] } : undefined,
  },
});

const team = (
  name: string,
  members: any[] = [],
): any => ({
  participantId: `t-${name}`,
  participantName: name,
  participantType: 'TEAM',
  individualParticipants: members,
});

const ALTITUDE = 'Altitude';
const FORTUNE = 'Fortune';

// ── splitMembership ──

describe('splitMembership', () => {
  it('returns the team roster as-is when no other participants are associated by name', () => {
    const rosterPlayers = [individual('p1'), individual('p2')];
    const t = team(ALTITUDE, rosterPlayers);
    const result = splitMembership(t, []);
    expect(result.roster).toEqual(rosterPlayers);
    expect(result.coaches).toEqual([]);
    expect(result.staff).toEqual([]);
  });

  it('routes individuals matched by teamName + role=COACH into the coaches bucket', () => {
    const t = team(ALTITUDE);
    const coach = individual('coach-1', { role: 'COACH', teamName: ALTITUDE });
    const result = splitMembership(t, [coach]);
    expect(result.coaches).toEqual([coach]);
    expect(result.staff).toEqual([]);
  });

  it('routes non-COMPETITOR, non-COACH roles into the staff bucket', () => {
    const t = team(ALTITUDE);
    const medical = individual('med-1', { role: 'MEDICAL', teamName: ALTITUDE });
    const physio = individual('phy-1', { role: 'PHYSIO', teamName: ALTITUDE });
    const captain = individual('cap-1', { role: 'CAPTAIN', teamName: ALTITUDE });
    const result = splitMembership(t, [medical, physio, captain]);
    expect(result.staff).toEqual([medical, physio, captain]);
    expect(result.coaches).toEqual([]);
  });

  it('appends roster-extras — imported COMPETITORs matched by teamName but absent from individualParticipantIds', () => {
    // Mirrors the import-race where a person has been added to the
    // tournament with teamAttributes.teamName set but the team participant's
    // individualParticipantIds[] has not yet been updated. The roster must
    // still show that player.
    const onRoster = individual('on-roster');
    const t = team(ALTITUDE, [onRoster]);
    const importedNotYetOnRoster = individual('extra', { role: 'COMPETITOR', teamName: ALTITUDE });
    const result = splitMembership(t, [importedNotYetOnRoster]);
    expect(result.roster).toEqual([onRoster, importedNotYetOnRoster]);
  });

  it('treats an individual with no participantRole the same as COMPETITOR', () => {
    const t = team(ALTITUDE);
    const noRole = individual('p1', { teamName: ALTITUDE });
    const result = splitMembership(t, [noRole]);
    expect(result.roster).toEqual([noRole]);
    expect(result.coaches).toEqual([]);
    expect(result.staff).toEqual([]);
  });

  it('ignores individuals whose teamAttributes.teamName matches a different team', () => {
    const t = team(ALTITUDE);
    const onFortune = individual('p1', { role: 'COACH', teamName: FORTUNE });
    const result = splitMembership(t, [onFortune]);
    expect(result.coaches).toEqual([]);
    expect(result.staff).toEqual([]);
  });
});

// ── parseJersey ──

describe('parseJersey', () => {
  it('returns the numeric value of a numeric string', () => {
    expect(parseJersey('11')).toBe(11);
    expect(parseJersey('0')).toBe(0);
  });

  it('returns null for empty / nullish values', () => {
    expect(parseJersey('')).toBeNull();
    expect(parseJersey(null)).toBeNull();
    expect(parseJersey(undefined)).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(parseJersey('TBD')).toBeNull();
    expect(parseJersey('11A')).toBeNull();
  });
});

// ── jerseySorter ──

describe('jerseySorter', () => {
  it('orders numeric values ascending', () => {
    expect(jerseySorter('2', '11')).toBeLessThan(0);
    expect(jerseySorter('11', '2')).toBeGreaterThan(0);
    expect(jerseySorter('7', '7')).toBe(0);
  });

  it('sinks empty / missing values below numeric ones regardless of direction', () => {
    // Comparator returns positive when `a` should come AFTER `b` in ascending
    // sort. Empty `a` must be greater than numeric `b` to fall to the bottom.
    expect(jerseySorter('', '11')).toBeGreaterThan(0);
    expect(jerseySorter('11', '')).toBeLessThan(0);
  });

  it('sinks non-numeric strings below numeric ones', () => {
    expect(jerseySorter('TBD', '11')).toBeGreaterThan(0);
    expect(jerseySorter('11', 'TBD')).toBeLessThan(0);
  });

  it('returns 0 when both values are empty / non-numeric (stable tie)', () => {
    expect(jerseySorter('', '')).toBe(0);
    expect(jerseySorter('TBD', 'TBD')).toBe(0);
    expect(jerseySorter(null, undefined)).toBe(0);
  });
});
