/**
 * MatchUp team filter for filterPopoverButton.
 * Filters matchUps by team participant, with optional stats panel display.
 */
import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { getTeamVs, getSideScore, getSide } from 'components/elements/getTeamVs';
import { removeAllChildNodes } from 'services/dom/transformers';
import { t } from 'i18n';

// constants
import { NONE } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function getMatchUpTeamFilter(
  table: any,
  statsPanel: HTMLElement,
): { teamOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  let filterValue: string | undefined;

  const teamParticipants =
    tournamentEngine.getParticipants({ participantFilters: { participantTypes: [TEAM] } }).participants || [];
  const teamMap = Object.assign(
    {},
    ...teamParticipants.map((p: any) => ({ [p.participantId]: p.individualParticipantIds })),
  );

  const teamFilter = (rowData: any): boolean =>
    filterValue
      ? rowData.individualParticipantIds.some((id: string) => teamMap[filterValue as string]?.includes(id))
      : true;

  const updateFilter = (teamParticipantId?: string) => {
    if (filterValue) table.removeFilter(teamFilter);
    filterValue = teamParticipantId;
    if (teamParticipantId) {
      table.addFilter(teamFilter);
      const { teamStats } = tournamentEngine.getParticipantStats({ teamParticipantId });
      if (teamStats?.participantName) {
        statsPanel.style.display = '';
        const side1 = getSide({ participantName: teamStats.participantName, justify: 'end' });
        const side2 = getSide({ participantName: t('pages.matchUps.opponents'), justify: 'start' });
        const sets = [{ side1Score: teamStats.matchUps[0], side2Score: teamStats.matchUps[1] }];
        const side1Score = getSideScore({ sets, sideNumber: 1 });
        const side2Score = getSideScore({ sets, sideNumber: 2 });
        removeAllChildNodes(statsPanel);
        statsPanel.appendChild(getTeamVs({ side1, side2, side1Score, side2Score }));
      }
    } else {
      statsPanel.style.display = NONE;
    }
  };

  const allLabel = t('pages.matchUps.allTeams');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const teamOptions = [allOption, { divider: true }].concat(
    teamParticipants
      .sort((a: any, b: any) => a?.participantName?.localeCompare(b?.participantName))
      .map((team: any) => ({
        onClick: () => updateFilter(team.participantId),
        label: team.participantName,
        filterValue: team.participantId,
        close: true,
      })),
  );

  const selectableOptions = teamOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    return idx >= 0 ? idx : 0;
  };

  return { teamOptions, hasOptions: teamParticipants.length > 0, isFiltered: () => !!filterValue, activeIndex };
}
