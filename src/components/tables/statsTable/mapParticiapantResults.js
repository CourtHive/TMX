export function mapParticipantResults({ participantResult, participantId, participantMap } = {}) {
  if (participantResult) console.log({ participantResult, participantId, participantMap });
  return { participantId, participantName: participantResult.GEMscore };
}
