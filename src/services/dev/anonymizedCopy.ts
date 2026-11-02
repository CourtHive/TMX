/**
 * An anonymized deep copy of a tournament record, for sharing a record for support without personal data.
 *
 * The factory's `anonymizeTournamentRecord` rewrites the record it is given IN PLACE and returns it as
 * `tournamentRecord`. It is therefore only ever run here on a structured clone, and never through the engine or
 * `mutationRequest`: the server loads mocksGovernor too, so a mutation would rewrite the live record for everybody.
 *
 * Everything that names, locates or contacts somebody, or links the copy back to the original in another system,
 * is the factory's job: it replaces persons (and the participant-level personId that points at them), every id the
 * record defines, venue names and addresses, team and group names, presence attesters and non-internal extensions,
 * and clears notes, contacts, online resources, other-system ids, court coordinates and the identifying tournament,
 * venue and event attributes. Without a tournamentId, name or parentOrganisation it generates a fresh id, an
 * "Anonymized: <date>" name, and drops the parentOrganisation.
 */
import { mocksGovernor } from 'tods-competition-factory';

export type AnonymizedCopyResult = { tournamentRecord?: any; error?: any };

export function anonymizedCopy(tournamentRecord: any): AnonymizedCopyResult {
  if (!tournamentRecord?.tournamentId) return { error: 'Missing tournamentRecord' };

  const result: any = mocksGovernor.anonymizeTournamentRecord({ tournamentRecord: structuredClone(tournamentRecord) });
  if (result?.error) return { error: result.error };

  return { tournamentRecord: result.tournamentRecord };
}
