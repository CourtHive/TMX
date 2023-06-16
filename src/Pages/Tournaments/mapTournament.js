export function mapTournament(tournament) {
  const tournamentName = tournament.tournamentName || tournament.name;
  const searchText = tournamentName?.toLowerCase() || 'Error';

  return {
    tournamentId: tournament.tuid,
    category: tournament.category,
    searchText,
    tournament: {
      startDate: new Date(tournament.start).toISOString()?.split('T')[0],
      endDate: new Date(tournament.end).toISOString()?.split('T')[0],
      media: tournament.publishing?.logo,
      tournamentName
    }
  };
}
