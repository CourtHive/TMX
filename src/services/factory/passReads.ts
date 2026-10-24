import { competitionEngine, tournamentEngine } from 'services/factory/engine';
import { readOncePerPass } from 'functions/renderPass';

/**
 * Engine reads that several panels of one render ask for, answered once per render pass.
 *
 * Measured with `dev.context({ perf: 0, params: true })`: a render asked the same question of the same
 * record up to four times (publishing: publish state, events and date range three times each; schedule:
 * tournament info three times; overview: participants and matchUps twice). Each reader here keys one
 * engine method with the params that change its answer, so every caller of a reader shares one value
 * for the pass (`readOncePerPass`: dropped at the next microtask, on a mutation and on a tournament
 * switch). Callers only read what they get.
 *
 * One home for the keys, so two callers can never share a key for different questions.
 */

export function readPublishState(): any {
  return readOncePerPass('tournamentEngine.q.publishState', () => tournamentEngine.q?.publishState?.());
}

export function readEvents(): any[] {
  return readOncePerPass('tournamentEngine.q.events', () => tournamentEngine.q.events() || []);
}

/**
 * Two engines, two answers: the competition engine's range spans every linked tournament it holds, the
 * tournament engine's covers the active tournament alone. Keyed apart, never interchangeable.
 */
export function readCompetitionDateRange(): any {
  return readOncePerPass('competitionEngine.getCompetitionDateRange', () =>
    competitionEngine.getCompetitionDateRange(),
  );
}

export function readTournamentDateRange(): any {
  return readOncePerPass('tournamentEngine.getCompetitionDateRange', () => tournamentEngine.getCompetitionDateRange());
}

export function readTournamentInfo(): any {
  return readOncePerPass('competitionEngine.getTournamentInfo', () => competitionEngine.getTournamentInfo());
}

/** `getParticipants({ withScaleValues: true })`: the rating chips and the scalings histogram. */
export function readParticipantsWithScaleValues(): any {
  return readOncePerPass('tournamentEngine.getParticipants:withScaleValues', () =>
    tournamentEngine.getParticipants({ withScaleValues: true }),
  );
}

/** `allTournamentMatchUps()` with no params: the plain (not inContext) matchUps. */
export function readAllTournamentMatchUps(): any {
  return readOncePerPass('tournamentEngine.allTournamentMatchUps', () => tournamentEngine.allTournamentMatchUps());
}
