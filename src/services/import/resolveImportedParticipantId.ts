import { tournamentEngine } from 'services/factory/engine';

/** A retired import ID belongs to its survivor, including event entries and later updates. */
export function resolveImportedParticipantId(participantId: string): string | undefined {
  const engine = tournamentEngine as unknown as {
    resolveMergedParticipantId?: (args: { participantId: string }) => unknown;
  };
  if (engine.resolveMergedParticipantId) {
    const resolved = engine.resolveMergedParticipantId({ participantId });
    return typeof resolved === 'string' && resolved ? resolved : undefined;
  }
  const record = tournamentEngine.getTournament().tournamentRecord;
  if (record?.extensions?.some(({ name }) => name === 'individualParticipantMerges')) return undefined;
  // Older factory builds cannot have created a merge locally. Server add guards remain authoritative.
  return participantId;
}
