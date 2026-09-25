import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  buildLiveScheduleProfile,
  ANCHOR_LATEST_HOUR,
  LIVE_VENUE_ID,
  MINUTES_BEFORE_ANCHOR,
} from './liveScheduleProfile';

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

  it('straddles the anchor — matchUps behind it, and matchUps ahead', () => {
    // Asserted against a FIXED in-band instant, not `Date.now()`. Since the anchor is clamped to
    // 09:00-16:00, a run late in the day anchors at 16:00, the day's schedule ends before the
    // current time, and "matchUps ahead of now" is legitimately zero — which is the example
    // behaving as designed, not a regression. This test used the wall clock and so failed on CI at
    // 23:35 UTC while passing at 18:48; the property it means to check is about the ANCHOR.
    const now = new Date(2026, 8, 24, 14, 0);
    const result: any = mocksEngine.generateTournamentRecord(buildLiveScheduleProfile(now) as any);
    expect(result.error).toBeUndefined();
    tournamentEngine.setState(result.tournamentRecord);

    const times = scheduled().map(instantOf);
    expect(times.filter((t) => t < now.getTime()).length).toBeGreaterThan(0);
    expect(times.filter((t) => t > now.getTime()).length).toBeGreaterThan(0);
  });

  it('starts the day the requested distance before the anchor', () => {
    // Inside the demonstrating band the anchor IS now, so this is the original contract: the day
    // starts `MINUTES_BEFORE_ANCHOR` before the current time. Asserted at a fixed instant rather
    // than against the wall clock, because outside the band the anchor is deliberately clamped and
    // this assertion would then be measuring the clamp instead of the offset.
    const now = new Date(2026, 8, 24, 14, 0);
    const result: any = mocksEngine.generateTournamentRecord(buildLiveScheduleProfile(now) as any);
    expect(result.error).toBeUndefined();
    tournamentEngine.setState(result.tournamentRecord);

    const earliest = Math.min(...scheduled().map(instantOf));
    const expected = now.getTime() - MINUTES_BEFORE_ANCHOR * 60_000;
    expect(Math.abs(earliest - expected)).toBeLessThan(120_000);
  });

  it('clamps the anchor when opened outside the demonstrating band', () => {
    // 22:00 is the case that used to fail outright. The day now generates and sits against the
    // latest feasible anchor, so the example shows a finished day rather than nothing at all.
    const now = new Date(2026, 8, 24, 22, 0);
    const result: any = mocksEngine.generateTournamentRecord(buildLiveScheduleProfile(now) as any);
    expect(result.error).toBeUndefined();
    tournamentEngine.setState(result.tournamentRecord);

    const earliest = Math.min(...scheduled().map(instantOf));
    const clamped = new Date(2026, 8, 24, ANCHOR_LATEST_HOUR, 0).getTime() - MINUTES_BEFORE_ANCHOR * 60_000;
    expect(Math.abs(earliest - clamped)).toBeLessThan(120_000);
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

/**
 * The example must GENERATE at any hour, and straddle the current time during the hours anyone
 * actually demonstrates it.
 *
 * It did neither reliably. The schedule is anchored 150 minutes before the anchor and runs five
 * rounds in sequence inside a SINGLE day, so the hour it was opened decided whether it fit — and
 * the factory refused the whole generation when it did not. Measured on 2026-09-24 under
 * `nonRandom`: ~4 failures in 20 generations at a fixed midday clock with random data, 20 of 20
 * deterministically, failing at 19:00 and 22:00 forwards and at 00:30 backwards.
 *
 * The profile now passes an explicit clamped anchor instead of `'NOW'`, which also makes `now` the
 * only input: these tests need no fake timers, because the argument fully determines the output.
 */
describe('Live Schedule example — at any hour of the day', () => {
  const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 23];

  it.each(HOURS)('generates without error at %i:30', (hour) => {
    const result: any = mocksEngine.generateTournamentRecord(
      buildLiveScheduleProfile(new Date(2026, 8, 24, hour, 30)) as any,
    );
    // `info` carries the factory's refusal reason, which is the useful half of the failure.
    expect(result.error, `${hour}:30 → ${result.info ?? ''}`).toBeUndefined();
  });

  it.each(HOURS)('keeps every matchUp inside the venue hours at %i:30', (hour) => {
    const result: any = mocksEngine.generateTournamentRecord(
      buildLiveScheduleProfile(new Date(2026, 8, 24, hour, 30)) as any,
    );
    expect(result.error).toBeUndefined();
    tournamentEngine.setState(result.tournamentRecord);
    const hours = scheduled().map((m: any) => Number(m.schedule.scheduledTime.split('T').pop().split(':')[0]));
    // Generating is not enough: an anchor that merely fits the DATE can still put matchUps at 01:00,
    // on courts that are shut. That is what a two-day window did when tried first.
    expect(Math.min(...hours), `earliest at ${hour}:30`).toBeGreaterThanOrEqual(6);
    expect(Math.max(...hours), `latest at ${hour}:30`).toBeLessThanOrEqual(23);
  });

  it('is REPRODUCIBLE — the same instant generates the same day', () => {
    // `nonRandom: 1` is not tidiness. The draw layout decides how long the day's schedule runs, so
    // with random data the anchored span varies generation to generation. Clamping the anchor took
    // the failure rate from ~20% to 1 in 100 measured runs; determinism takes it to zero, and makes
    // a demo that opens the same way twice.
    const now = new Date(2026, 8, 24, 11, 0);
    const times = () => {
      const result: any = mocksEngine.generateTournamentRecord(buildLiveScheduleProfile(now) as any);
      expect(result.error).toBeUndefined();
      tournamentEngine.setState(result.tournamentRecord);
      return scheduled()
        .map((m: any) => `${m.schedule.scheduledDate}T${m.schedule.scheduledTime}`)
        .sort()
        .join('|');
    };

    expect(times()).toEqual(times());
  });

  it('straddles the current time during demonstrating hours', () => {
    const now = new Date(2026, 8, 24, 14, 0);
    const result: any = mocksEngine.generateTournamentRecord(buildLiveScheduleProfile(now) as any);
    expect(result.error).toBeUndefined();
    tournamentEngine.setState(result.tournamentRecord);

    // The point of the example: matchUps behind the current time and ahead of it, so the now-strip,
    // auto-call and due badges have something to act on.
    const instants = scheduled().map(instantOf);
    expect(instants.filter((t) => t < now.getTime()).length).toBeGreaterThan(0);
    expect(instants.filter((t) => t > now.getTime()).length).toBeGreaterThan(0);
  });
});
