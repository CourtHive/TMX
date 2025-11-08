const sum = (values: number[]) => values.reduce((total, value) => total + parseFloat(value.toString()), 0);
const avg = (values: number[]) => parseFloat((sum(values) / values.length).toFixed(2));

type MapParticipantResultsParams = {
  participantResult?: any;
  drawPosition?: number;
  participantId?: string;
  participantMap?: Record<string, any>;
};

export function mapParticipantResults({ participantResult, drawPosition, participantId, participantMap }: MapParticipantResultsParams = {}): any {
  const pointsResult = `${participantResult?.pointsWon || 0}/${participantResult?.pointsLost || 0}`;
  const gamesResult = `${participantResult?.gamesWon || 0}/${participantResult?.gamesLost || 0}`;
  const setsResult = `${participantResult?.setsWon || 0}/${participantResult?.setsLost || 0}`;
  const order = participantResult?.groupOrder || participantResult?.provisionalOrder;
  const averagePressure = participantResult?.pressureScores?.length ? avg(participantResult.pressureScores) : 0;
  const averageVariation = participantResult?.ratingVariation?.length ? avg(participantResult.ratingVariation) : 0;
  const participant = participantMap?.[participantId || ''];

  return {
    participantName: participant?.participantName,
    groupName: participant?.groupName,
    ...participantResult,
    averageVariation,
    averagePressure,
    participantId,
    pointsResult,
    drawPosition,
    participant,
    gamesResult,
    setsResult,
    order,
  };
}
