import { fixtures, factoryConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;

/**
 * Compute the set of rating scaleNames present on tournament participants
 * for which we have known parameters in `fixtures.ratingsParameters`.
 *
 * Two callers (`matchUpsTab` and `createMatchUpsTable`) both walked
 * participants.ratings[SINGLES] to drive predictive-accuracy UI; each
 * was making its own `getParticipants({ withScaleValues: true })` call
 * and building the same Set. Consolidating here removes one factory
 * call per matchUps-tab render.
 *
 * The optional `participants` parameter lets callers share an already-
 * fetched list so a third caller doesn't accidentally add a new call.
 */
export function getPresentRatings(participants?: any[]): Set<string> {
  const list = participants ?? tournamentEngine.getParticipants({ withScaleValues: true })?.participants ?? [];
  const presentRatings = new Set<string>();
  for (const p of list) {
    for (const item of p.ratings?.[SINGLES] || []) {
      if (ratingsParameters[item.scaleName]) {
        presentRatings.add(item.scaleName);
      }
    }
  }
  return presentRatings;
}

/**
 * The rating scales a choice of scale offers: those present on the participants given (all of the tournament's by
 * default), in the order the factory lists them, without the deprecated. The Add Draw drawer's DrawMatic scale and the
 * Add flights rating systems both read it, so neither offers a scale nobody holds (CA, 2026-11-17).
 */
export function activeRatingScales(participants?: any[]): string[] {
  const present = getPresentRatings(participants);
  return Object.keys(ratingsParameters).filter(
    (key) => !(ratingsParameters as any)[key].deprecated && present.has(key),
  );
}
