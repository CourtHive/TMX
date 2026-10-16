/** Request ownership for asynchronous tournament loads and mutation acknowledgements. */
import { tournamentEngine } from 'services/factory/engine';

let loadGeneration = 0;
let selectionGeneration = 0;
let recordGeneration = 0;
let requestedTournamentId: string | undefined;

export function beginTournamentLoad(tournamentId: string): () => boolean {
  if (requestedTournamentId !== tournamentId) {
    requestedTournamentId = tournamentId;
    selectionGeneration++;
  }
  const generation = ++loadGeneration;
  return () => generation === loadGeneration && requestedTournamentId === tournamentId;
}

/** Invalidate work before navigating away, including requests that have not installed a record yet. */
export function invalidatePendingTournamentLoads(): void {
  loadGeneration++;
}

/** A full record replacement supersedes operations captured over an older local copy. */
export function markTournamentRecordInstalled(): void {
  recordGeneration++;
}

/** Capture before permission/network awaits; a replay captures a new owner when it is sent. */
export function captureTournamentSelection(tournamentIds: string[]): () => boolean {
  const generation = selectionGeneration;
  const owner = tournamentEngine.getTournamentId();
  return () => {
    if (generation !== selectionGeneration || tournamentEngine.getTournamentId() !== owner) return false;
    const { tournamentIds: loaded = [] } = tournamentEngine.getTournamentIds();
    return tournamentIds.every((id) => loaded.includes(id));
  };
}

/** Strict ownership for previews/refreshes tied to the installed copy, in addition to selection. */
export function captureTournamentOperation(tournamentIds: string[]): () => boolean {
  const generation = recordGeneration;
  const isSelected = captureTournamentSelection(tournamentIds);
  return () => generation === recordGeneration && isSelected();
}
