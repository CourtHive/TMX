/**
 * MatchUp team filter for filterPopoverButton.
 * Filters matchUps by team participant, with optional stats panel display.
 */
import { participantConstants, eventConstants, unwrapOr } from 'tods-competition-factory';
import { getTeamVs, getSideScore, getSide } from 'components/elements/getTeamVs';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { NONE } from 'constants/tmxConstants';

const { TEAM } = participantConstants;
const { TEAM_EVENT } = eventConstants;

const EMPTY_FILTER = {
  teamOptions: [] as any[],
  hasOptions: false,
  isFiltered: () => false,
  activeIndex: () => 0,
};

export function getMatchUpTeamFilter(
  table: any,
  statsPanel: HTMLElement,
  preFetchedEvents?: any[],
): { teamOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  let filterValue: string | undefined = context.matchUpFilters.teamId;

  // Short-circuit when the tournament has no TEAM events. The filter
  // is a no-op in that state and the participants query just to
  // confirm "no teams" is pure waste. Caller can hand in a pre-fetched
  // events list to share one q.events() call across the event/flight/team
  // filters on the matchUps tab.
  const events = preFetchedEvents ?? tournamentEngine.q.events() ?? [];
  if (!events.some((e: any) => e.eventType === TEAM_EVENT)) return EMPTY_FILTER;

  const teamParticipants =
    tournamentEngine.q.participants({ participantFilters: { participantTypes: [TEAM] } }) || [];
  const teamMap = Object.assign(
    {},
    ...teamParticipants.map((p: any) => ({ [p.participantId]: p.individualParticipantIds })),
  );

  const teamFilter = (rowData: any): boolean =>
    filterValue
      ? rowData.individualParticipantIds.some((id: string) => teamMap[filterValue as string]?.includes(id))
      : true;

  // Restore saved filter
  if (filterValue) table.addFilter(teamFilter);

  const updateFilter = (teamParticipantId?: string) => {
    if (filterValue) table.removeFilter(teamFilter);
    filterValue = teamParticipantId;
    context.matchUpFilters.teamId = teamParticipantId;
    if (teamParticipantId) {
      table.addFilter(teamFilter);
      // Engine return is `ResultType | TeamStatsResults`; the optional-`error`
      // ResultType prevents `Unwrap` from narrowing to the success arm
      // automatically, so cast at the destructure.
      const { teamStats } = unwrapOr(tournamentEngine.getParticipantStats({ teamParticipantId }), {}) as {
        teamStats?: any;
      };
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
