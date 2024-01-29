export function mapParticipantResults({ participantResult, drawPosition, participantId, participantMap } = {}) {
  const setsResult = `${participantResult?.setsWon || 0}/${participantResult?.setsLost || 0}`;
  const gamesResult = `${participantResult?.gamesWon || 0}/${participantResult?.gamesLost || 0}`;
  const order = participantResult?.groupOrder || participantResult?.provisionalOrder;
  const participant = participantMap[participantId];

  return {
    participantName: participant.participantName,
    groupName: participant.groupName,
    ...participantResult,
    participantId,
    drawPosition,
    participant,
    gamesResult,
    setsResult,
    order,
  };
}
