export function mapTournamentRecord(tournamentRecord) {
  const searchText = tournamentRecord.tournamentName?.toLowerCase() || 'Error';
  const tournamentImageURL = tournamentRecord.onlineResources?.find(
    ({ name, resourceType }) => name === 'tournamentImage' && resourceType === 'URL'
  )?.identifier;

  return {
    tournamentId: tournamentRecord.tournamentId,
    id: tournamentRecord.tournamentId,
    searchText,
    tournament: {
      startDate: new Date(tournamentRecord.startDate).toISOString()?.split('T')[0],
      endDate: new Date(tournamentRecord.endDate).toISOString()?.split('T')[0],
      tournamentName: tournamentRecord.tournamentName,
      tournamentImageURL
    }
  };
}
