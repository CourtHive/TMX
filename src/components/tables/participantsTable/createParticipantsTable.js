import { tournamentEngine, participantConstants, participantRoles, tools } from 'tods-competition-factory';
import { participantResponsiveLayourFormatter } from './participantResponsiveLayoutFormatter';
import { mapParticipant } from 'pages/tournament/tabs/participantTab/mapParticipant';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { getParticipantColumns } from './getParticipantColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { findAncestor } from 'services/dom/parentAndChild';

import { TOURNAMENT_PARTICIPANTS } from 'constants/tmxConstants';
import { env } from 'settings/env';

const { INDIVIDUAL, GROUP, TEAM } = participantConstants;
const { OFFICIAL, COMPETITOR } = participantRoles;

export function createParticipantsTable({ view } = {}) {
  let table, participants, derivedEventInfo, ready, teamParticipants, groupParticipants;

  const participantFilters = { participantRoles: [view === OFFICIAL ? OFFICIAL : COMPETITOR] };

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      withSignInStatus: true,
      withScaleValues: true,
      participantFilters,
      withEvents: true,
      withISO2: true,
    });
    ({ participants, derivedEventInfo } = result);

    const individualParticipants = participants.filter(({ participantType }) => participantType === INDIVIDUAL);
    groupParticipants = participants.filter(({ participantType }) => participantType === GROUP);
    teamParticipants = participants.filter(({ participantType }) => participantType === TEAM);
    const ratingsScales = tools.unique(
      individualParticipants
        .flatMap(({ ratings }) => ratings?.SINGLES?.map(({ scaleName }) => scaleName))
        .filter(Boolean),
    );
    env.activeScale = (ratingsScales.includes('WTN') && 'wtn') || (ratingsScales.includes('UTR') && 'utr') || 'wtn';

    return individualParticipants?.map((p) => mapParticipant(p, derivedEventInfo)) || [];
  };

  const replaceTableData = () => {
    const refresh = () => table.replaceData(getTableData());
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const data = getTableData();
  const columns = getParticipantColumns(data);

  const simpleAddition = (a, b) => {
    return ((tools.isNumeric(a) && a) || 0) + ((tools.isNumeric(b) && b) || 0);
  };

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_PARTICIPANTS });
    const element = document.getElementById(TOURNAMENT_PARTICIPANTS);
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader');

    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'sex',
        'signedIn',
        'events',
        'teams',
        'cityState',
        'tennisId',
        'ratings.wtn.wtnRating',
        'ratings.utr.utrRating',
      ]),
      responsiveLayoutCollapseFormatter: participantResponsiveLayourFormatter,
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.86,
      placeholder: 'No participants',
      responsiveLayout: 'collapse',
      index: 'participantId',
      layout: 'fitColumns',
      reactiveData: true,
      columns,
      data,
    });

    /**
    const span = `<span class='badge is-danger'>1</span>`;
    // const span = `<span class='icon'>🎾</span>`;
    const getHeader = (rows) => `<button class='button is-inverted is-info'>${span}Participants (${rows.length})</button>`;
    */
    const getHeader = (rows) => `Participants (${rows.length})`;
    table.on('dataChanged', (rows) => headerElement && (headerElement.innerHTML = getHeader(rows)));
    table.on('dataFiltered', (filters, rows) => {
      headerElement && (headerElement.innerHTML = getHeader(rows));
      const wtns = [];
      const utrs = [];
      for (const row of rows) {
        const data = row.getData();
        const { wtn, utr } = data.ratings;
        tools.isNumeric(utr?.utrRating) && utrs.push(parseFloat(utr.utrRating));
        tools.isNumeric(wtn?.wtnRating) && wtns.push(parseFloat(wtn.wtnRating));
      }
      const utrTotal = utrs.reduce(simpleAddition, 0);
      const wtnTotal = wtns.reduce(simpleAddition, 0);
      const utrAverage = (utrs.length ? utrTotal / utrs.length : 0).toFixed(2);
      const wtnAverage = (wtns.length ? wtnTotal / wtns.length : 0).toFixed(2);
      console.log(`UTR ${utrAverage}x̄`);
      console.log(`WTN ${wtnAverage}x̄`);
    });
    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(data);

  return { table, replaceTableData, teamParticipants, groupParticipants };
}
