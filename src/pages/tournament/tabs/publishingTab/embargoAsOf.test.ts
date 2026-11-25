/**
 * Embargo state is judged at TMX's COMPETITION clock, passed to `tools.publishing` as an explicit `asOf`
 * (factory 8.0.0 makes `asOf` required). A demo clock moved past an embargo must show it lifted, and one
 * held before it must show it in force, whatever the device's wall clock says.
 */
import { setCompetitionClock } from 'services/clock/competitionClock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { getActiveEmbargoes } from './publishingData';

vi.mock('i18n', () => ({ t: (k: string) => k }));

const embargo = '2026-06-05T12:00:00.000Z';
const at = (iso: string) => ({ nowMs: () => new Date(iso).getTime() });

const orderOfPlay = () => getActiveEmbargoes().find(({ type }) => type === 'orderOfPlay');

beforeEach(() => {
  mocksEngine.generateTournamentRecord({ startDate: '2026-06-01', endDate: '2026-06-10', setState: true });
  const result: any = tournamentEngine.executionQueue([{ method: 'publishOrderOfPlay', params: { embargo } }]);
  expect(result.success).toBe(true);
});

afterEach(() => {
  setCompetitionClock();
});

describe('embargo state follows the competition clock', () => {
  it('is in force while the competition clock is before the embargo', () => {
    setCompetitionClock(at('2026-06-05T11:59:00.000Z'));
    expect(orderOfPlay()).toMatchObject({ embargo, embargoActive: true });
  });

  it('has lifted once the competition clock passes the embargo', () => {
    setCompetitionClock(at('2026-06-05T12:01:00.000Z'));
    expect(orderOfPlay()).toMatchObject({ embargo, embargoActive: false });
  });
});
