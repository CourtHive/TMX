/**
 * Ratings progression table for ad-hoc (DrawMatic) draws.
 * Shows dynamic rating changes per participant across rounds.
 */
import { formatParticipant } from '../common/formatters/participantFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine, scaleEngine, fixtures } from 'tods-competition-factory';
import { renderMatchUp, compositions } from 'courthive-components';
import { preferencesConfig } from 'config/preferencesConfig';
import { displayConfig } from 'config/displayConfig';
import { scalesMap } from 'config/scalesConfig';
import tippy, { type Instance } from 'tippy.js';

import { DRAWS_VIEW } from 'constants/tmxConstants';

const { ratingsParameters } = fixtures;
const ELO_RANGE = ratingsParameters.ELO?.range || [0, 3000];

/** Convert a source-scale rating to ELO via linear range interpolation. */
function convertToElo(sourceRating: number, sourceRatingType: string): number | undefined {
  const params = ratingsParameters[sourceRatingType];
  if (!params?.range) return undefined;
  const range = params.range;
  const inverted = range[0] > range[1];
  const value = inverted ? range[0] - sourceRating : sourceRating;
  const [minS, maxS] = inverted ? [range[1], range[0]] : range;
  const [minT, maxT] = ELO_RANGE;
  return Math.round(((value - minS) * (maxT - minT)) / (maxS - minS) + minT);
}

type CreateRatingsTableParams = {
  structureId: string;
  eventId: string;
  drawId: string;
};

/**
 * Extract the numeric rating from a scaleValue, which may be:
 * - a plain number (e.g. 23.45)
 * - an object with an accessor key (e.g. { wtnRating: 23.45, confidence: 78 })
 */
function extractNumeric(scaleValue: any, accessor?: string): number | undefined {
  if (scaleValue == null) return undefined;
  if (typeof scaleValue === 'number') return scaleValue;
  if (accessor && typeof scaleValue === 'object') {
    const val = scaleValue[accessor];
    return typeof val === 'number' ? val : undefined;
  }
  return undefined;
}

/**
 * Build a participant-perspective scoreline string for a matchUp.
 * If the participant is side 2, the score is shown from side 2's perspective.
 */
function getParticipantScore(mu: any, mySideNumber: number): string {
  if (!mu.score) return '';
  if (mySideNumber === 1) return mu.score.scoreStringSide1 || '';
  return mu.score.scoreStringSide2 || '';
}

// Track active tippy instance for matchUp popovers
let activeTip: Instance | undefined;

function destroyMatchUpTip() {
  if (activeTip) {
    activeTip.destroy();
    activeTip = undefined;
  }
}

/**
 * Show a tipster-style popover with a rendered matchUp view.
 * Uses findMatchUp with participantsProfile to get hydrated participant data including ratings.
 */
function showMatchUpTipster(target: HTMLElement, drawId: string, matchUpId: string) {
  destroyMatchUpTip();

  const result = tournamentEngine.findMatchUp({ drawId, matchUpId, participantsProfile: { withScaleValues: true } });
  const matchUp = result?.matchUp;
  if (!matchUp) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative; padding:8px; padding-top:20px;';

  // Close button
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '\u00d7';
  closeBtn.style.cssText =
    'position:absolute; top:2px; right:6px; cursor:pointer; font-size:16px; line-height:1; color:var(--chc-text-secondary, #888); z-index:1;';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    destroyMatchUpTip();
  };
  wrapper.appendChild(closeBtn);

  const composition = displayConfig.get().composition || compositions.National;
  // Ensure scaleAttributes is set so ratings render in the popover
  const _activeScale = preferencesConfig.get().activeScale;
  if (composition.configuration && scalesMap[_activeScale]) {
    composition.configuration.scaleAttributes = scalesMap[_activeScale];
  }
  const matchUpElement = renderMatchUp({ matchUp, composition, isLucky: true });
  wrapper.appendChild(matchUpElement);

  activeTip = tippy(target, {
    content: wrapper,
    theme: 'light-border',
    trigger: 'manual',
    interactive: true,
    maxWidth: 'none',
    appendTo: document.body,
    onClickOutside: () => destroyMatchUpTip(),
  });
  activeTip.show();
}

function computeDynamicRatings(
  matchUps: any[],
  activeScale: string,
): { computedRatings: Record<string, any>; isEloDynamic: boolean } {
  const completedMatchUpIds = matchUps
    .filter((mu: any) => mu.winningSide)
    .map((mu: any) => mu.matchUpId);

  if (!completedMatchUpIds.length) {
    return { computedRatings: {}, isEloDynamic: false };
  }

  const { tournamentRecord } = tournamentEngine.getTournament();
  scaleEngine.setState(tournamentRecord);
  const result = scaleEngine.generateDynamicRatings({
    matchUpIds: completedMatchUpIds,
    ratingType: activeScale,
    convertToELO: true,
    asDynamic: true,
  });

  if (result.modifiedScaleValues) {
    return {
      computedRatings: result.modifiedScaleValues,
      isEloDynamic: !!result.sourceRatingType,
    };
  }

  return { computedRatings: {}, isEloDynamic: false };
}

function resolveDynamicValue(
  pid: string,
  ratings: any[],
  dynamicScaleName: string,
  accessor: string | undefined,
  computedRatings: Record<string, any>,
  isEloDynamic: boolean,
): number | undefined {
  const computedEntry = computedRatings[pid];
  const computedValue = computedEntry
    ? isEloDynamic
      ? computedEntry.scaleValue
      : extractNumeric(computedEntry.scaleValue, accessor)
    : undefined;
  const dynEntry = ratings.find((r: any) => r.scaleName === dynamicScaleName || r.scaleName === 'ELO.DYNAMIC');
  const persistedValue = dynEntry
    ? dynEntry.scaleName === 'ELO.DYNAMIC'
      ? extractNumeric(dynEntry.scaleValue, undefined)
      : extractNumeric(dynEntry.scaleValue, accessor)
    : undefined;
  return computedValue ?? persistedValue;
}

function populateRoundData(
  row: any,
  pid: string,
  roundNumbers: number[],
  roundMap: Record<number, any[]>,
): { result: string; score: string; matchUpId: string }[] {
  const scorelines: { result: string; score: string; matchUpId: string }[] = [];
  for (const rn of roundNumbers) {
    const roundMatchUps = roundMap[rn];
    const mu = roundMatchUps.find((m: any) => m.sides?.some((s: any) => s.participantId === pid));
    if (!mu) continue;

    const mySide = (mu as any).sides.find((s: any) => s.participantId === pid);
    const oppSide = (mu as any).sides.find((s: any) => s.participantId !== pid);
    const oppName = oppSide?.participant?.participantName || oppSide?.participantId || '-';
    const won = (mu as any).winningSide === mySide?.sideNumber;
    const lost = (mu as any).winningSide && (mu as any).winningSide !== mySide?.sideNumber;
    const participantScore = getParticipantScore(mu, mySide?.sideNumber);
    const matchUpId = (mu as any).matchUpId;
    row[`r${rn}_opponent`] = oppName;
    row[`r${rn}_result`] = won ? 'W' : lost ? 'L' : '';
    row[`r${rn}_score`] = participantScore;
    row[`r${rn}_matchUpId`] = matchUpId;

    if (participantScore) {
      const result = won ? 'W' : lost ? 'L' : '';
      scorelines.push({ result, score: participantScore, matchUpId });
    }
  }
  return scorelines;
}

function buildParticipantRow(
  pid: string,
  participantMap: Record<string, any>,
  matchUpType: string,
  activeScale: string,
  dynamicScaleName: string,
  accessor: string | undefined,
  computedRatings: Record<string, any>,
  isEloDynamic: boolean,
  roundNumbers: number[],
  roundMap: Record<number, any[]>,
): { row: any; hasDynamic: boolean } | undefined {
  const participant = participantMap[pid];
  if (!participant) return undefined;

  const row: any = {
    participantId: pid,
    participantName: participant.participantName || 'Unknown',
    participant,
  };

  const ratings = participant.ratings?.[matchUpType] || [];
  const baseEntry = ratings.find((r: any) => r.scaleName === activeScale);
  row.rating = extractNumeric(baseEntry?.scaleValue, accessor);

  const dynValue = resolveDynamicValue(pid, ratings, dynamicScaleName, accessor, computedRatings, isEloDynamic);

  let hasDynamic = false;
  if (dynValue != null) {
    hasDynamic = true;
    const roundedDyn = isEloDynamic ? Math.round(dynValue) : dynValue;
    row.dynamicRating = roundedDyn;
    if (row.rating != null) {
      const baseValue = isEloDynamic ? convertToElo(row.rating, activeScale) : row.rating;
      if (baseValue) {
        row.ratingChange = +(((roundedDyn - baseValue) / baseValue) * 100).toFixed(1);
      }
    }
  }

  row.scorelines = populateRoundData(row, pid, roundNumbers, roundMap);
  return { row, hasDynamic };
}

function buildScorelineFormatter(drawId: string) {
  return (cell: any) => {
    const entries: { result: string; score: string; matchUpId: string }[] = cell.getValue() || [];
    if (!entries.length) return '';

    const container = document.createElement('span');
    entries.forEach((entry, i) => {
      if (i > 0) container.appendChild(document.createTextNode(', '));

      const span = document.createElement('span');
      span.style.cursor = 'pointer';
      const color = entry.result === 'W' ? 'green' : entry.result === 'L' ? 'red' : '';
      const prefix = entry.result ? `<span style="color:${color};font-weight:bold;">${entry.result}</span> ` : '';
      span.innerHTML = `${prefix}${entry.score}`;
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        showMatchUpTipster(span, drawId, entry.matchUpId);
      });
      container.appendChild(span);
    });

    return container;
  };
}

function buildRoundColumn(rn: number, drawId: string): any {
  return {
    title: `R${rn}`,
    field: `r${rn}_result`,
    hozAlign: 'center',
    width: 55,
    formatter: (cell: any) => {
      const val = cell.getValue();
      const rowData = cell.getRow().getData();
      const score = rowData[`r${rn}_score`];
      const opponent = rowData[`r${rn}_opponent`] || '';
      const matchUpId = rowData[`r${rn}_matchUpId`];
      const color = val === 'W' ? 'green' : val === 'L' ? 'red' : '';
      const tooltip = `${opponent}${score ? ' ' + score : ''}`;
      const cursor = matchUpId && val ? 'cursor:pointer;' : '';
      return `<span style="color:${color}; font-weight:bold; ${cursor}" title="${tooltip}">${val || '-'}</span>`;
    },
    cellClick: (_e: any, cell: any) => {
      const rowData = cell.getRow().getData();
      const matchUpId = rowData[`r${rn}_matchUpId`];
      const val = rowData[`r${rn}_result`];
      if (!matchUpId || !val) return;

      showMatchUpTipster(cell.getElement(), drawId, matchUpId);
    },
  };
}

function buildDynamicColumns(isEloDynamic: boolean, activeScale: string, ascending: boolean): any[] {
  return [
    {
      title: isEloDynamic ? `ELO<br>(from ${activeScale})` : 'Dynamic',
      field: 'dynamicRating',
      headerHozAlign: 'center',
      hozAlign: 'center',
      width: 150,
      formatter: (cell: any) => {
        const val = cell.getValue();
        if (val == null) return '-';
        return isEloDynamic ? Math.round(val).toString() : val.toFixed(2);
      },
    },
    {
      title: 'Change',
      field: 'ratingChange',
      hozAlign: 'center',
      headerHozAlign: 'center',
      width: 100,
      formatter: (cell: any) => {
        const val = cell.getValue();
        if (val == null) return '-';
        const pctAscending = isEloDynamic ? false : ascending;
        const isImprovement = pctAscending ? val < 0 : val > 0;
        const isDecline = pctAscending ? val > 0 : val < 0;
        const color = isImprovement ? 'green' : isDecline ? 'red' : '';
        const prefix = val > 0 ? '+' : '';
        return `<span style="color: ${color}; font-weight: bold;">${prefix}${val.toFixed(1)}%</span>`;
      },
    },
  ];
}

export function createRatingsTable({ structureId, drawId }: CreateRatingsTableParams): void {
  const { ratingsParameters } = fixtures;

  const { matchUps = [] } = tournamentEngine.allDrawMatchUps({
    matchUpFilters: { structureIds: [structureId] },
    drawId,
  });

  const { participants = [] } = tournamentEngine.getParticipants({
    withScaleValues: true,
  });

  const participantMap: Record<string, any> = {};
  for (const p of participants) {
    participantMap[(p as any).participantId] = p;
  }

  const roundMap: Record<number, any[]> = {};
  for (const mu of matchUps) {
    const rn = (mu as any).roundNumber;
    if (!rn) continue;
    if (!roundMap[rn]) roundMap[rn] = [];
    roundMap[rn].push(mu);
  }
  const roundNumbers = Object.keys(roundMap)
    .map(Number)
    .sort((a, b) => a - b);

  const matchUpType = (matchUps[0] as any)?.matchUpType || 'SINGLES';
  const activeScale = preferencesConfig.get().activeScale?.toUpperCase() || 'WTN';
  const dynamicScaleName = `${activeScale}.DYNAMIC`;
  const rp = (ratingsParameters as any)[activeScale];
  const accessor = rp?.accessor;
  const ascending = rp?.ascending ?? false;

  const drawParticipantIds = new Set<string>();
  for (const mu of matchUps) {
    for (const side of (mu as any).sides || []) {
      if (side.participantId) drawParticipantIds.add(side.participantId);
    }
  }

  const { computedRatings, isEloDynamic } = computeDynamicRatings(matchUps, activeScale);

  let hasDynamic = false;
  const tableData: any[] = [];

  for (const pid of drawParticipantIds) {
    const result = buildParticipantRow(
      pid,
      participantMap,
      matchUpType,
      activeScale,
      dynamicScaleName,
      accessor,
      computedRatings,
      isEloDynamic,
      roundNumbers,
      roundMap,
    );
    if (!result) continue;
    if (result.hasDynamic) hasDynamic = true;
    tableData.push(result.row);
  }

  tableData.sort((a, b) => {
    const aVal = a.dynamicRating ?? a.rating ?? (ascending ? 999 : -1);
    const bVal = b.dynamicRating ?? b.rating ?? (ascending ? 999 : -1);
    return ascending ? aVal - bVal : bVal - aVal;
  });

  const ratingFormatter = (cell: any) => {
    const val = cell.getValue();
    return val != null ? val.toFixed(2) : '-';
  };

  const columns: any[] = [
    {
      title: 'Participant',
      field: 'participantName',
      formatter: formatParticipant(undefined),
      sorter: participantSorter,
      minWidth: 180,
      frozen: true,
    },
    {
      title: 'Scorelines',
      field: 'scorelines',
      minWidth: 200,
      formatter: buildScorelineFormatter(drawId),
    },
    {
      title: `Rating<br>(${activeScale})`,
      field: 'rating',
      hozAlign: 'center',
      headerHozAlign: 'center',
      width: 80,
      formatter: ratingFormatter,
    },
  ];

  for (const rn of roundNumbers) {
    columns.push(buildRoundColumn(rn, drawId));
  }

  if (hasDynamic) {
    columns.push(...buildDynamicColumns(isEloDynamic, activeScale, ascending));
  }

  destroyTable({ anchorId: DRAWS_VIEW });
  const element = document.getElementById(DRAWS_VIEW);

  const sortableFields = ['participantName', 'rating', 'dynamicRating', 'ratingChange'];
  new Tabulator(element, {
    headerSortElement: headerSortElement(sortableFields),
    height: window.innerHeight * (displayConfig.get().tableHeightMultiplier ?? 0.85),
    placeholder: 'No rating data available',
    responsiveLayout: 'collapse',
    layout: 'fitColumns',
    reactiveData: true,
    columns,
    data: tableData,
  });
}
