export function mapTournamentRecord(tournamentRecord) {
  const searchText = tournamentRecord.tournamentName?.toLowerCase() || 'Error';

  return {
    tournamentId: tournamentRecord.tournamentId,
    id: tournamentRecord.tournamentId,
    searchText,
    tournament: {
      startDate: new Date(tournamentRecord.startDate).toISOString()?.split('T')[0],
      endDate: new Date(tournamentRecord.endDate).toISOString()?.split('T')[0],
      // media: tournament.publishing?.logo,
      tournamentName: tournamentRecord.tournamentName
    }
  };
}
