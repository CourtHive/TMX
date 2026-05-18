/**
 * Typed engine boundary for TMX.
 *
 * Re-exports the factory's singleton engines cast to `FactoryEngineTyped`,
 * which has a closed method-name set instead of `Record<string, any>`. This
 * makes typos like `tournamentEngine.findEvent(...)` (real bug, the correct
 * method is `getEvent`) a compile-time error.
 *
 * Per-method param shapes are still `any` upstream — this layer only catches
 * unregistered method names, not bad argument shapes.
 *
 * Always import the engines from here, never directly from
 * `tods-competition-factory`.
 */
import {
  tournamentEngine as untypedTournamentEngine,
  competitionEngine as untypedCompetitionEngine,
  type FactoryEngineTyped,
} from 'tods-competition-factory';

export const tournamentEngine = untypedTournamentEngine as FactoryEngineTyped;
export const competitionEngine = untypedCompetitionEngine as FactoryEngineTyped;
