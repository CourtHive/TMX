import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';

// Constants
const { SWISS } = drawDefinitionConstants;

// Derive color from win ratio: 1.0 = green, 0.5 = amber, 0.0 = red
// Interpolates through green → yellow → orange → red
function getScoreGroupStyle(groupKey: string): { bg: string; border: string } {
  const [wins, losses, draws] = groupKey.split('-').map(Number);
  const total = wins + losses + draws;
  // ratio 1.0 = all wins, 0.0 = all losses; 0-0-0 (start) treated as neutral
  const ratio = total > 0 ? (wins + draws * 0.5) / total : 0.5;

  // hue: 0 = red, 30 = orange, 50 = amber, 120 = green
  const hue = Math.round(ratio * 120);
  const saturation = 70;
  const borderLight = 45;
  const bgAlpha = 0.15;

  const border = 'hsl(' + hue + ', ' + saturation + '%, ' + borderLight + '%)';
  const bg = 'hsla(' + hue + ', ' + saturation + '%, ' + borderLight + '%, ' + bgAlpha + ')';

  return { bg, border };
}

function formatScoreGroupLabel(groupKey: string): string {
  const [wins, losses, draws] = groupKey.split('-').map(Number);
  const tiesSuffix = draws ? '-' + draws + 'T' : '';
  return wins + 'W-' + losses + 'L' + tiesSuffix;
}

function wrapScoreGroup(elements: HTMLElement[], style: { bg: string; border: string }, label: string): void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'background: ' +
    style.bg +
    '; border-left: 3px solid ' +
    style.border +
    '; border-radius: 4px; margin: 4px 0; padding: 4px 0;';

  const header = document.createElement('div');
  header.style.cssText =
    'display: inline-block; font-size: 10px; font-weight: 700; color: #fff; background: ' +
    style.border +
    '; border-radius: 3px; padding: 1px 6px; margin: 0 0 2px 6px; letter-spacing: 0.5px;';
  header.textContent = label;
  wrapper.appendChild(header);

  elements[0].parentNode?.insertBefore(wrapper, elements[0]);
  for (const el of elements) wrapper.appendChild(el);
}

function getParticipantIdsFromMatchUp(el: Element): string[] {
  const pids: string[] = [];
  for (const sideEl of el.querySelectorAll('.tmx-p')) {
    const pid = sideEl.id;
    if (pid && pid !== 'undefined') pids.push(pid);
  }
  return pids;
}

function buildPerRoundStandingMaps(drawId: string): Map<number, Map<string, string>> {
  // getSwissChart returns per-round score group nodes with participantIds
  // round 0 = start (all 0-0), round N = state AFTER round N results
  // For pairing display, round N matchUps were paired using the state AFTER round N-1
  // So round N's shading should use chart round N-1's groups
  const chart: any = tournamentEngine.getSwissChart?.({ drawId });
  if (!chart?.rounds?.length) return new Map();

  const roundMaps = new Map<number, Map<string, string>>();

  for (const chartRound of chart.rounds) {
    const pidToGroup = new Map<string, string>();
    for (const node of chartRound.nodes) {
      const key = node.wins + '-' + node.losses + '-' + node.draws;
      for (const pid of node.participantIds) pidToGroup.set(pid, key);
    }
    roundMaps.set(chartRound.roundNumber, pidToGroup);
  }

  return roundMaps;
}

function getWinnerDominance(matchUp: any): number {
  // returns a ratio (0-1) of how decisively the winner won
  // higher = more dominant (e.g., 6-1 6-1 > 7-5 6-3)
  if (!matchUp?.winningSide || !matchUp?.score?.sets?.length) return 0;

  let winnerGames = 0;
  let totalGames = 0;
  let winnerPoints = 0;
  let totalPoints = 0;

  for (const set of matchUp.score.sets) {
    const s1 = set.side1Score ?? 0;
    const s2 = set.side2Score ?? 0;
    totalGames += s1 + s2;
    winnerGames += matchUp.winningSide === 1 ? s1 : s2;

    const p1 = typeof set.side1PointScore === 'number' ? set.side1PointScore : 0;
    const p2 = typeof set.side2PointScore === 'number' ? set.side2PointScore : 0;
    if (p1 + p2 > 0) {
      totalPoints += p1 + p2;
      winnerPoints += matchUp.winningSide === 1 ? p1 : p2;
    }
  }

  // prefer point ratio if available, fall back to game ratio
  if (totalPoints > 0) return winnerPoints / totalPoints;
  if (totalGames > 0) return winnerGames / totalGames;
  return 0;
}

export function sortSwissRoundMatchUpsByScoreGroup(roundMatchUps: Record<string, any[]>, drawId: string): void {
  const roundMaps = buildPerRoundStandingMaps(drawId);
  if (!roundMaps.size) return;

  for (const roundNumber of Object.keys(roundMatchUps)) {
    const rn = Number(roundNumber);
    // use chart round rn-1 (state before this round's pairing)
    const priorMap = roundMaps.get(rn - 1) ?? roundMaps.get(0);
    if (!priorMap) continue;

    const matchUps = roundMatchUps[roundNumber];
    if (!matchUps?.length) continue;

    matchUps.sort((a: any, b: any) => {
      // primary: score group (higher W-L record first)
      const aKey = priorMap.get(a.sides?.[0]?.participantId) ?? '0-0-0';
      const bKey = priorMap.get(b.sides?.[0]?.participantId) ?? '0-0-0';
      const groupCmp = bKey.localeCompare(aKey);
      if (groupCmp !== 0) return groupCmp;

      // secondary: winner dominance (most decisive win first)
      return getWinnerDominance(b) - getWinnerDominance(a);
    });
  }
}

export function applySwissScoreGroupShading(content: HTMLElement, drawId: string): void {
  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  if (drawDefinition?.drawType !== SWISS) return;

  const roundMaps = buildPerRoundStandingMaps(drawId);
  if (!roundMaps.size) return;

  for (const roundEl of content.querySelectorAll('.tmx-rd')) {
    const roundNumber = Number(roundEl.getAttribute('roundnumber') || '0');
    // use state from BEFORE this round (chart round N-1)
    const priorMap = roundMaps.get(roundNumber - 1) ?? roundMaps.get(0);
    if (!priorMap) continue;

    const matchUpEls = roundEl.querySelectorAll('.tmx-m');
    const groups = new Map<string, HTMLElement[]>();

    for (const el of matchUpEls) {
      const pids = getParticipantIdsFromMatchUp(el);
      let groupKey = '';
      for (const pid of pids) {
        const key = priorMap.get(pid);
        if (key) {
          groupKey = key;
          break;
        }
      }
      if (!groupKey) continue;

      const existing = groups.get(groupKey) ?? [];
      existing.push(el as HTMLElement);
      groups.set(groupKey, existing);
    }

    for (const [groupKey, elements] of groups) {
      wrapScoreGroup(elements, getScoreGroupStyle(groupKey), formatScoreGroupLabel(groupKey));
    }
  }
}
