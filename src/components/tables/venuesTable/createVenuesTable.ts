import { makeAverageMinutesResolver } from 'pages/tournament/tabs/scheduleViews/scheduleTimingResolver';
import { scheduledMatchUpsByVenue } from 'pages/tournament/tabs/venuesTab/scheduledMatchUpsByVenue';
import { gridMinutesByCourt } from 'pages/tournament/tabs/venuesTab/gridMinutesByCourt';
import { competitionEngine, tournamentEngine } from 'services/factory/engine';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { fillToViewportBottom } from 'functions/heightToViewportBottom';
import { mapVenue } from 'pages/tournament/tabs/venuesTab/mapVenue';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { AvailabilityEngine } from 'tods-competition-factory';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { venueRowFormatter } from './venueRowFormatter';
import { getVenuesColumns } from './getVenueColumns';
import { displayConfig } from 'config/displayConfig';

// constants
import { TOURNAMENT_VENUES } from 'constants/tmxConstants';
import { t } from 'i18n';

type CreateVenuesTableResult = {
  table: any;
  replaceTableData: () => void;
};

// Format, type and event come only with context; hydrate just the matchUps in a grid row, not the whole tournament.
function gridMatchUpsInContext(matchUps: any[]): any[] {
  const matchUpIds = matchUps.filter((m: any) => m.schedule?.courtId && m.schedule?.courtOrder).map((m) => m.matchUpId);
  if (!matchUpIds.length) return [];
  const result: any = competitionEngine.allCompetitionMatchUps({ inContext: true, matchUpFilters: { matchUpIds } });
  return result?.matchUps ?? [];
}

export function createVenuesTable({ table }: { table?: any } = {}): CreateVenuesTableResult {
  const nestedTables = new Map();
  const setNestedTable = (venueId: string, courtsTable: any) => {
    if (nestedTables.has(venueId)) return;
    nestedTables.set(venueId, courtsTable);
  };

  const createSchedulingEngine = () => {
    const tournamentRecord = tournamentEngine.q.tournament();
    if (!tournamentRecord) return undefined;
    const engine = new AvailabilityEngine();
    engine.init(tournamentRecord);
    return engine;
  };

  const getTableData = () => {
    const { venues = [] } = competitionEngine.getVenuesAndCourts();
    const engine = createSchedulingEngine();
    const { matchUps = [] } = competitionEngine.allCompetitionMatchUps({ inContext: false }) ?? {};
    const scheduledByVenue = scheduledMatchUpsByVenue(matchUps, venues);
    const gridMinutes = gridMinutesByCourt(gridMatchUpsInContext(matchUps), makeAverageMinutesResolver());
    const rows = venues.map((v: any) => mapVenue(v, engine, scheduledByVenue, gridMinutes));
    return { rows };
  };

  const replaceTableData = () => {
    const { rows } = getTableData();
    table?.replaceData(rows);
  };

  const columns = getVenuesColumns(nestedTables);

  if (table) {
    replaceTableData();
  } else {
    destroyTable({ anchorId: TOURNAMENT_VENUES });
    const element = document.getElementById(TOURNAMENT_VENUES);
    const { rows: data } = getTableData();
    // Header text is owned by the orchestrator (`venuesTab.ts`) so the same
    // line can carry the cards/table view toggle.

    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'scheduledMatchUpsCount',
        'venueAbbreviation',
        'availableTime',
        'courtsCount',
        'venueName',
      ]),
      minHeight: window.innerHeight * (displayConfig.get().tableHeightMultiplier ?? 0.85),
      rowFormatter: venueRowFormatter(setNestedTable),
      placeholder: t('ui.noVenues'),
      layout: 'fitColumns',
      reactiveData: true,
      index: 'venueId',
      columns,
      data,
    });

    // at least to the window's bottom, as every page table reaches; still a minimum, never a height: a venue's row
    // expands into a table of its courts, and a fixed height would put those nested tables in Tabulator's virtual rows
    table.on('tableBuilt', () => {
      if (!element) return;
      const release = fillToViewportBottom(element, { gap: 8, property: 'minHeight' });
      table.on('tableDestroyed', release);
    });
    table.on('scrollVertical', destroyTipster);
    table.on('cellEdited', (cell: any) => {
      const def = cell.getColumn().getDefinition();
      const row = cell.getRow().getData();
      const value = cell.getValue();
      console.log({ cell, row, value, def });
    });
  }

  return { table, replaceTableData };
}
