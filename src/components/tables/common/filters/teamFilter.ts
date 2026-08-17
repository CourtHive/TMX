import { context } from 'services/context';
import { t } from 'i18n';

export function getTeamFilter({
  table,
  teamParticipants,
  onChange,
}: {
  table: any;
  teamParticipants: any[];
  onChange?: () => void;
}) {
  let filterValue: string | undefined = context.participantFilters.teamId;
  // See the sibling filters: removeFilter on a never-added filter makes
  // Tabulator warn "Filter Error - No matching filter type found".
  let teamFilterApplied = false;

  const teamFilter = (rowData) => rowData.teams.some((team) => team?.participantId === filterValue);
  const updateTeamFilter = (participantId?) => {
    if (teamFilterApplied) {
      table.removeFilter(teamFilter);
      teamFilterApplied = false;
    }
    filterValue = participantId;
    context.participantFilters.teamId = participantId;
    if (participantId) {
      table.addFilter(teamFilter);
      teamFilterApplied = true;
    }
    if (onChange) onChange();
  };

  // Restore saved filter
  if (filterValue) {
    table.addFilter(teamFilter);
    teamFilterApplied = true;
  }
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
        filterValue: team.participantId,
        close: true,
      })),
  );

  const isFiltered = () => !!filterValue;

  const selectableOptions = teamOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    return idx >= 0 ? idx : 0;
  };

  return { teamOptions, isFiltered, activeIndex };
}
