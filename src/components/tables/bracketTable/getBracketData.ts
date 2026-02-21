type GroupParticipant = {
  drawPosition: number;
  participantName: string;
  participantId: string;
};

type GroupData = {
  groupId: string;
  groupName: string;
  participants: GroupParticipant[];
  rows: any[];
};

type GetBracketDataParams = {
  structure: any;
  participantMap: Record<string, any>;
  participantResults: any[];
  drawId: string;
};

export function getBracketData({ structure, participantMap, participantResults, drawId }: GetBracketDataParams): GroupData[] {
  const roundMatchUps = structure?.roundMatchUps ?? {};
  const allMatchUps: any[] = Object.values(roundMatchUps).flat();

  // Group matchUps by structureId (each RR group is a child structure)
  const matchUpsByGroup: Record<string, any[]> = {};
  const groupNames: Record<string, string> = {};

  for (const matchUp of allMatchUps) {
    const gId = matchUp.structureId;
    if (!matchUpsByGroup[gId]) matchUpsByGroup[gId] = [];
    matchUpsByGroup[gId].push(matchUp);
    if (matchUp.structureName) groupNames[gId] = matchUp.structureName;
  }

  // Build participantResults lookup by participantId
  const resultsMap: Record<string, any> = {};
  for (const pr of participantResults) {
    resultsMap[pr.participantId] = pr;
  }

  // Build head-to-head map: key = `${pid1}_${pid2}` → cell value object
  type H2HEntry = {
    score: string;
    won: boolean;
    complete: boolean;
    readyToScore: boolean;
    matchUpId: string;
    drawId: string;
    matchUp: any;
  };
  const h2hMap: Record<string, H2HEntry> = {};
  for (const matchUp of allMatchUps) {
    const sides = matchUp.sides;
    if (!sides || sides.length < 2) continue;
    const p1 = sides[0]?.participantId;
    const p2 = sides[1]?.participantId;
    if (!p1 || !p2) continue;

    const score1 = matchUp.score?.scoreStringSide1 || '';
    const score2 = matchUp.score?.scoreStringSide2 || '';
    const winningSide = matchUp.winningSide;
    const complete = !!winningSide;
    const readyToScore = !!(winningSide || matchUp.readyToScore);
    const shared = { complete, readyToScore, matchUpId: matchUp.matchUpId, drawId: matchUp.drawId, matchUp };

    // From side1's perspective
    h2hMap[`${p1}_${p2}`] = { score: score1, won: winningSide === 1, ...shared };
    // From side2's perspective
    h2hMap[`${p2}_${p1}`] = { score: score2, won: winningSide === 2, ...shared };
  }

  // Build position-to-participantId map from matchUp sides (covers assigned positions)
  // Also build drawPosition-to-structureId map
  const positionParticipant: Record<string, Record<number, string>> = {}; // groupId → { drawPosition → participantId }
  // Track draw positions that are BYEs (from matchUps with matchUpStatus === 'BYE')
  const byePositions: Record<string, Set<number>> = {}; // groupId → Set of BYE drawPositions
  for (const matchUp of allMatchUps) {
    const gId = matchUp.structureId;
    if (!positionParticipant[gId]) positionParticipant[gId] = {};
    if (matchUp.matchUpStatus === 'BYE') {
      if (!byePositions[gId]) byePositions[gId] = new Set();
      for (const side of matchUp.sides ?? []) {
        if (side.drawPosition && !side.participantId) {
          byePositions[gId].add(side.drawPosition);
        }
      }
    }
    for (const side of matchUp.sides ?? []) {
      if (side.drawPosition) {
        if (side.participantId) {
          positionParticipant[gId][side.drawPosition] = side.participantId;
        } else if (!positionParticipant[gId][side.drawPosition]) {
          positionParticipant[gId][side.drawPosition] = '';
        }
      }
    }
  }

  const groups: GroupData[] = [];

  for (const [groupId, matchUps] of Object.entries(matchUpsByGroup)) {
    const posMap = positionParticipant[groupId] || {};

    // Collect all draw positions in this group (from matchUp sides)
    const drawPositions = [...new Set(
      matchUps.flatMap((mu: any) => (mu.sides ?? []).map((s: any) => s.drawPosition).filter(Boolean)),
    )].sort((a: number, b: number) => a - b);

    const groupByePositions = byePositions[groupId];

    // Build participants array: one entry per draw position
    const participants: GroupParticipant[] = drawPositions.map((dp: number) => {
      const pid = posMap[dp];
      const isBye = groupByePositions?.has(dp);
      const p = pid ? participantMap[pid] : undefined;
      return {
        drawPosition: dp,
        participantId: pid || `dp_${dp}`,
        participantName: isBye ? 'BYE' : (p?.participantName || ''),
      };
    });

    // Build rows: one per draw position
    const rows = participants.map((rowP) => {
      const isAssigned = !!posMap[rowP.drawPosition];
      const pr = isAssigned
        ? (resultsMap[posMap[rowP.drawPosition]]?.participantResult ?? resultsMap[posMap[rowP.drawPosition]] ?? {})
        : {};
      const row: any = {
        participantId: isAssigned ? posMap[rowP.drawPosition] : '',
        participantName: rowP.participantName,
        drawPosition: rowP.drawPosition,
        structureId: groupId,
        drawId,
        result: isAssigned ? `${pr.matchUpsWon ?? 0}/${pr.matchUpsLost ?? 0}` : '',
        setsResult: isAssigned ? `${pr.setsWon ?? 0}/${pr.setsLost ?? 0}` : '',
        gamesResult: isAssigned ? `${pr.gamesWon ?? 0}/${pr.gamesLost ?? 0}` : '',
        matchUpsPct: pr.matchUpsPct ?? pr.result ?? '',
        setsPct: pr.setsPct ?? '',
        order: pr.groupOrder ?? pr.provisionalOrder ?? '',
        ties: pr.ties ?? 0,
        subOrder: pr.subOrder ?? 0,
      };

      // Add opponent columns
      for (const colP of participants) {
        if (colP.drawPosition === rowP.drawPosition) {
          row[`opponent_${colP.participantId}`] = { self: true };
        } else if (groupByePositions?.has(rowP.drawPosition) || groupByePositions?.has(colP.drawPosition)) {
          // Either this row or the column is a BYE position
          row[`opponent_${colP.participantId}`] = { bye: true };
        } else if (isAssigned && !!posMap[colP.drawPosition]) {
          // Both positions assigned — look up h2h
          const key = `${posMap[rowP.drawPosition]}_${posMap[colP.drawPosition]}`;
          const h2h = h2hMap[key];
          row[`opponent_${colP.participantId}`] = h2h ?? {};
        } else {
          row[`opponent_${colP.participantId}`] = {};
        }
      }

      return row;
    });

    groups.push({
      groupId,
      groupName: groupNames[groupId] || groupId,
      participants,
      rows,
    });
  }

  // Sort groups by name
  groups.sort((a, b) => a.groupName.localeCompare(b.groupName));

  return groups;
}
