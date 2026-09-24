import { buildLiveScheduleProfile, LIVE_VENUE_ID, MINUTES_BEFORE_ANCHOR } from './liveScheduleProfile';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

/**
 * What the Live Schedule example must actually produce.
 *
 * The catalogue's other examples generate draws and a venue and stop — measured, zero matchUps
 * anywhere carried a `schedule`. This asserts the outcome rather than the profile's shape: a
 * profile that merely *contains* a schedulingProfile proves nothing, which is how "it should
 * schedule" survived as an assumption.
 */

function generate() {
  const profile = buildLiveScheduleProfile();
  const result: any = mocksEngine.generateTournamentRecord(profile as any);
  tournamentEngine.setState(result.tournamentRecord);
  return result;
}

function scheduled() {
  const matchUps = tournamentEngine.allTournamentMatchUps().matchUps ?? [];
  return matchUps.filter((m: any) => m.schedule?.scheduledTime);
}

function instantOf(matchUp: any) {
  const t = matchUp.schedule.scheduledTime;
  const time = t.includes('T') ? t.split('T')[1] : t;
  const [h, mi] = time.split(':').map(Number);
  const [y, mo, d] = String(matchUp.schedule.scheduledDate).split('T')[0].split('-').map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

describe('Live Schedule example', () => {
  it('generates without error', () => {
    expect(generate().error).toBeUndefined();
  });

  it('actually puts matchUps on the clock — the thing every other example fails to do', () => {
    generate();
    expect(scheduled().length).toBeGreaterThan(8);
  });

  it('puts them on COURTS, not merely at times', () => {
    generate();
    const courted = scheduled().filter((m: any) => m.schedule?.courtId);
    expect(courted.length).toBeGreaterThan(8);
    // every scheduled matchUp should have landed on a court
    expect(courted.length).toEqual(scheduled().length);
  });

  it('straddles NOW — matchUps behind, and matchUps ahead', () => {
    generate();
    const now = Date.now();
    const times = scheduled().map(instantOf);
    expect(times.filter((t) => t < now).length).toBeGreaterThan(0);
    expect(times.filter((t) => t > now).length).toBeGreaterThan(0);
  });

  it('starts the day the requested distance before now', () => {
    generate();
    const earliest = Math.min(...scheduled().map(instantOf));
    const expected = Date.now() - MINUTES_BEFORE_ANCHOR * 60_000;
    expect(Math.abs(earliest - expected)).toBeLessThan(120_000);
  });

  it('keeps the schedule inside the venue hours, so courts are open when matchUps are on them', () => {
    generate();
    const hours = scheduled().map((m: any) => Number(m.schedule.scheduledTime.split('T').pop().split(':')[0]));
    expect(Math.min(...hours)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...hours)).toBeLessThanOrEqual(23);
  });

  it('blocks exactly one court for maintenance, leaving the rest to reschedule onto', () => {
    generate();
    const courts: any[] = tournamentEngine.getVenuesAndCourts({ venueIds: [LIVE_VENUE_ID] }).courts ?? [];
    const blocked = courts.filter((c: any) => (c.dateAvailability ?? []).some((d: any) => d.bookings?.length));
    expect(courts.length).toEqual(8);
    expect(blocked.length).toEqual(1);
    const bookings = (blocked[0]?.dateAvailability ?? []).flatMap((d: any) => d.bookings ?? []);
    expect(bookings[0]?.bookingType).toEqual('MAINTENANCE');
  });

  it('leaves later rounds unplayed, so there is something still to come', () => {
    generate();
    const matchUps = tournamentEngine.allTournamentMatchUps().matchUps ?? [];
    const completed = matchUps.filter((m: any) => m.winningSide);
    expect(completed.length).toBeGreaterThan(0);
    expect(completed.length).toBeLessThan(matchUps.length);
  });

  it('carries the scheduling policy, so recovery and average minutes are real', () => {
    generate();
    const policy: any = tournamentEngine.findPolicy({ policyType: 'scheduling' });
    expect(policy?.policy?.matchUpRecoveryTimes ?? policy?.matchUpRecoveryTimes).toBeDefined();
  });
});
