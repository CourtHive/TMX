export function mapParticipantResults({ participantResult, participantId, participantMap } = {}) {
  if (participantResult) console.log({ participantResult, participantId, participantMap });
  const participant = participantMap[participantId];
  return { participantId, participantName: participant.participantName, participant };
}
