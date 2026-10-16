/**
 * Typed engine boundary for TMX.
 *
 * Re-exports the factory's singleton engines cast to `FactoryEngineTyped`,
 * which has a closed method-name set instead of `Record<string, any>`. This
 * makes typos like `tournamentEngine.findEvent(...)` (real bug, the correct
 * method is `getEvent`) a compile-time error.
 *
 * Factory lifts many parameter/result signatures and typed query facades.
 * Methods with remaining optional or any fields still need runtime validation.
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
