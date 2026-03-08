/**
 * Ratings progression table for ad-hoc (DrawMatic) draws.
 * Shows dynamic rating changes per participant across rounds.
 */
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { tournamentEngine, scaleEngine, fixtures } from 'tods-competition-factory';
import { renderMatchUp, compositions } from 'courthive-components';
import tippy, { type Instance } from 'tippy.js';
import { env } from 'settings/env';

import { DRAWS_VIEW } from 'constants/tmxConstants';

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

  const composition = env.composition || compositions.National;
  // Ensure scaleAttributes is set so ratings render in the popover
  if (composition.configuration && env.scales?.[env.activeScale]) {
    composition.configuration.scaleAttributes = env.scales[env.activeScale];
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

export function createRatingsTable({ structureId, drawId }: CreateRatingsTableParams): void {
  const { ratingsParameters } = fixtures;

  // Get draw matchups grouped by round
  const { matchUps = [] } = tournamentEngine.allDrawMatchUps({
    matchUpFilters: { structureIds: [structureId] },
    drawId,
  });

  // Get participants with hydrated scale values (ratings, rankings)
  const { participants = [] } = tournamentEngine.getParticipants({
    withScaleValues: true,
  });

  const participantMap: Record<string, any> = {};
  for (const p of participants) {
    participantMap[(p as any).participantId] = p;
  }

  // Group matchups by round
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

  // Determine matchUp type for rating lookup (SINGLES, DOUBLES, etc.)
  const matchUpType = (matchUps[0] as any)?.matchUpType || 'SINGLES';

  // Determine active scale and accessor for extracting numeric values
  const activeScale = env.activeScale?.toUpperCase() || 'WTN';
  const dynamicScaleName = `${activeScale}.DYNAMIC`;
  const rp = (ratingsParameters as any)[activeScale];
  const accessor = rp?.accessor;
  const ascending = rp?.ascending ?? false; // true = lower is better (WTN), false = higher is better (UTR)

  // Collect unique participants from the draw
  const drawParticipantIds = new Set<string>();
  for (const mu of matchUps) {
    for (const side of (mu as any).sides || []) {
      if (side.participantId) drawParticipantIds.add(side.participantId);
    }
  }

  // Compute dynamic ratings on-the-fly from all completed matchups
  const completedMatchUpIds = matchUps
    .filter((mu: any) => mu.winningSide)
    .map((mu: any) => mu.matchUpId);

  let computedRatings: Record<string, any> = {};
  if (completedMatchUpIds.length) {
    const { tournamentRecord } = tournamentEngine.getTournament();
    scaleEngine.setState(tournamentRecord);
    const result = scaleEngine.generateDynamicRatings({
      matchUpIds: completedMatchUpIds,
      ratingType: activeScale,
      asDynamic: true,
    });
    if (result.modifiedScaleValues) {
      computedRatings = result.modifiedScaleValues;
    }
  }

  // Build table data: one row per participant
  let hasDynamic = false;
  const tableData: any[] = [];

  for (const pid of drawParticipantIds) {
    const participant = participantMap[pid];
    if (!participant) continue;

    const row: any = {
      participantId: pid,
      participantName: participant.participantName || 'Unknown',
    };

    const ratings = participant.ratings?.[matchUpType] || [];

    // Base rating (the non-dynamic scale value)
    const baseEntry = ratings.find((r: any) => r.scaleName === activeScale);
    row.rating = extractNumeric(baseEntry?.scaleValue, accessor);

    // Dynamic rating: prefer on-the-fly calculation, fall back to persisted value
    const computedEntry = computedRatings[pid];
    const computedValue = computedEntry ? extractNumeric(computedEntry.scaleValue, accessor) : undefined;
    const dynEntry = ratings.find((r: any) => r.scaleName === dynamicScaleName);
    const persistedValue = extractNumeric(dynEntry?.scaleValue, accessor);
    const dynValue = computedValue ?? persistedValue;

    if (dynValue != null) {
      hasDynamic = true;
      row.dynamicRating = dynValue;
      if (row.rating != null) {
        row.ratingChange = +(dynValue - row.rating).toFixed(2);
      }
    }

    // Per-round: find this participant's matchup and extract opponent + result + scoreline
    const scorelines: { result: string; score: string; matchUpId: string }[] = [];
    for (const rn of roundNumbers) {
      const roundMatchUps = roundMap[rn];
      const mu = roundMatchUps.find((m: any) => m.sides?.some((s: any) => s.participantId === pid));
      if (mu) {
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
    }

    row.scorelines = scorelines;
    tableData.push(row);
  }

  // Sort by dynamic rating if available, otherwise by base rating (best first)
  tableData.sort((a, b) => {
    const aVal = a.dynamicRating ?? a.rating ?? (ascending ? 999 : -1);
    const bVal = b.dynamicRating ?? b.rating ?? (ascending ? 999 : -1);
    return ascending ? aVal - bVal : bVal - aVal;
  });

  // Build columns
  const ratingFormatter = (cell: any) => {
    const val = cell.getValue();
    return val != null ? val.toFixed(2) : '-';
  };

  const columns: any[] = [
    {
      title: 'Participant',
      field: 'participantName',
      minWidth: 140,
      frozen: true,
    },
    {
      title: 'Scorelines',
      field: 'scorelines',
      minWidth: 200,
      formatter: (cell: any) => {
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
      },
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

  // Round columns
  for (const rn of roundNumbers) {
    columns.push({
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
    });
  }

  // Only show dynamic rating and change columns when dynamic ratings exist
  if (hasDynamic) {
    columns.push(
      {
        title: 'Dynamic',
        field: 'dynamicRating',
        hozAlign: 'center',
        width: 100,
        formatter: ratingFormatter,
      },
      {
        title: 'Change',
        field: 'ratingChange',
        hozAlign: 'center',
        width: 100,
        formatter: (cell: any) => {
          const val = cell.getValue();
          if (val == null) return '-';
          // ascending: lower is better (WTN) → negative change is good (green)
          // !ascending: higher is better (UTR) → positive change is good (green)
          const isImprovement = ascending ? val < 0 : val > 0;
          const isDecline = ascending ? val > 0 : val < 0;
          const color = isImprovement ? 'green' : isDecline ? 'red' : '';
          const prefix = val > 0 ? '+' : '';
          return `<span style="color: ${color}; font-weight: bold;">${prefix}${val.toFixed(2)}</span>`;
        },
      },
    );
  }

  // Render table
  destroyTable({ anchorId: DRAWS_VIEW });
  const element = document.getElementById(DRAWS_VIEW);

  const sortableFields = ['participantName', 'rating', 'dynamicRating', 'ratingChange'];
  new Tabulator(element, {
    headerSortElement: headerSortElement(sortableFields),
    height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
    placeholder: 'No rating data available',
    responsiveLayout: 'collapse',
    layout: 'fitColumns',
    reactiveData: true,
    columns,
    data: tableData,
  });
}
