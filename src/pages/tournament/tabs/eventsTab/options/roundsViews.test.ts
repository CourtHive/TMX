import { defaultRoundsView, getRoundsViews, resolveRoundsView } from './roundsViews';
import { mocksEngine, tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

// constants
import {
  ROUNDS_BRACKET,
  ROUNDS_COLUMNS,
  ROUNDS_RATINGS,
  ROUNDS_STANDINGS,
  ROUNDS_STATS,
  ROUNDS_SWISS_CHART,
  ROUNDS_TABLE,
} from 'constants/tmxConstants';

const { AD_HOC, ROUND_ROBIN, SINGLE_ELIMINATION, SWISS } = drawDefinitionConstants;

/** The draw's structures as the events tab reads them: from eventData, so each carries its hydrated matchUps. */
function drawData(drawType: string) {
  const drawProfile =
    drawType === AD_HOC || drawType === SWISS ? { drawSize: 8, drawType, automated: true } : { drawSize: 8, drawType };
  const { eventIds } = mocksEngine.generateTournamentRecord({ drawProfiles: [drawProfile], setState: true });
  const { eventData } = tournamentEngine.getEventData({ eventId: eventIds?.[0] });
  return eventData.drawsData[0];
}

describe('getRoundsViews', () => {
  it('offers an elimination structure no stats and no grid: it has no tally', () => {
    const { structures, drawType } = drawData(SINGLE_ELIMINATION);
    expect(getRoundsViews({ structure: structures[0], drawType })).toEqual([ROUNDS_COLUMNS, ROUNDS_TABLE]);
  });

  it('offers a round robin its grid and its stats', () => {
    const { structures, drawType } = drawData(ROUND_ROBIN);
    expect(getRoundsViews({ structure: structures[0], drawType })).toEqual([
      ROUNDS_BRACKET,
      ROUNDS_COLUMNS,
      ROUNDS_TABLE,
      ROUNDS_STATS,
    ]);
  });

  it('offers an ad hoc structure stats and ratings', () => {
    const { structures, drawType } = drawData(AD_HOC);
    expect(getRoundsViews({ structure: structures[0], drawType })).toEqual([
      ROUNDS_COLUMNS,
      ROUNDS_TABLE,
      ROUNDS_STATS,
      ROUNDS_RATINGS,
    ]);
  });

  it('offers a swiss structure its chart and standings, and no ratings', () => {
    const { structures, drawType } = drawData(SWISS);
    expect(getRoundsViews({ structure: structures[0], drawType })).toEqual([
      ROUNDS_COLUMNS,
      ROUNDS_SWISS_CHART,
      ROUNDS_TABLE,
      ROUNDS_STATS,
      ROUNDS_STANDINGS,
    ]);
  });
});

describe('resolveRoundsView', () => {
  it('falls back to the default view when the route names one the structure does not offer', () => {
    const { structures, drawType } = drawData(SINGLE_ELIMINATION);
    const structure = structures[0];
    expect(resolveRoundsView({ structure, drawType, roundsView: ROUNDS_STATS })).toEqual(ROUNDS_COLUMNS);
    expect(resolveRoundsView({ structure, drawType, roundsView: ROUNDS_BRACKET })).toEqual(ROUNDS_COLUMNS);
    expect(resolveRoundsView({ structure, drawType, roundsView: ROUNDS_TABLE })).toEqual(ROUNDS_TABLE);
  });

  it('keeps an offered view and defaults a round robin to its grid', () => {
    const { structures, drawType } = drawData(ROUND_ROBIN);
    const structure = structures[0];
    expect(resolveRoundsView({ structure, drawType, roundsView: ROUNDS_STATS })).toEqual(ROUNDS_STATS);
    expect(resolveRoundsView({ structure, drawType })).toEqual(ROUNDS_BRACKET);
    expect(defaultRoundsView(structure)).toEqual(ROUNDS_BRACKET);
  });

  it('defaults to columns when the structure is not found', () => {
    expect(resolveRoundsView({ roundsView: ROUNDS_STATS })).toEqual(ROUNDS_COLUMNS);
  });
});
