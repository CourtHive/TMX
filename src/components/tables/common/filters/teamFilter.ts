import { t } from 'i18n';

export function getTeamFilter({ table, teamParticipants }) {
  let filterValue;
  const teamFilter = (rowData) => rowData.teams.some((team) => team?.participantId === filterValue);
  const updateTeamFilter = (participantId?) => {
    table.removeFilter(teamFilter);
    filterValue = participantId;
    if (participantId) table.addFilter(teamFilter);
  };
  const anyTeamLabel = t('pages.participants.anyTeam');
  const allTeams = {
    label: `<span style='font-weight: bold'>${anyTeamLabel}</span>`,
    onClick: () => updateTeamFilter(),
    close: true,
  };

  // TODO: teamOptions => use element.options.replaceWith to update to only those teams with results
  const teamOptions = [allTeams, { divider: true }].concat(
    teamParticipants
      .sort((a, b) => a?.participantName?.localeCompare(b?.participantName))
      .map((team) => ({
        onClick: () => updateTeamFilter(team.participantId),
        label: team.participantName,
        close: true,
      })),
  );

  return { teamOptions };
}
