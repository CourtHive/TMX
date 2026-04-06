import { renderDrawView } from 'pages/tournament/tabs/eventsTab/renderDraws/renderDrawView';
import { drawControlBar } from 'pages/tournament/tabs/eventsTab/renderDraws/drawControlBar';
import { cleanupDrawPanel } from 'pages/tournament/tabs/eventsTab/cleanupDrawPanel';
import { destroyTable } from 'pages/tournament/destroyTable';
import { navigateToEvent } from '../common/navigateToEvent';
import { tournamentEngine } from 'tods-competition-factory';
import { preferencesConfig } from 'config/preferencesConfig';
import { renderParticipant } from 'courthive-components';
import { scalesMap } from 'config/scalesConfig';

// Constants
import { DRAWS_VIEW, ROUNDS_SWISS_CHART } from 'constants/tmxConstants';

function formatGroupLabel(node: any): string {
  const tiesSuffix = node.draws ? '-' + node.draws + 'T' : '';
  return node.wins + 'W-' + node.losses + 'L' + tiesSuffix;
}

function getScoreGroupStyle(node: any): { bg: string; border: string } {
  const total = node.wins + node.losses + node.draws;
  const ratio = total > 0 ? (node.wins + node.draws * 0.5) / total : 0.5;
  const hue = Math.round(ratio * 120);
  const saturation = 70;
  const borderLight = 45;
  return {
    border: 'hsl(' + hue + ', ' + saturation + '%, ' + borderLight + '%)',
    bg: 'hsla(' + hue + ', ' + saturation + '%, ' + borderLight + '%, 0.18)',
  };
}

function buildParticipantMap(): Map<string, any> {
  const { participants } = tournamentEngine.getParticipants({});
  const map = new Map<string, any>();
  for (const p of participants ?? []) map.set(p.participantId, p);
  return map;
}

function renderParticipantName(participant: any): HTMLElement {
  const scaleAttributes = scalesMap[preferencesConfig.get().activeScale];
  return renderParticipant({
    composition: { theme: 'default', configuration: { genderColor: true, scaleAttributes, flag: false } },
    participant,
  });
}

export async function renderSwissChart({
  structureId,
  eventId,
  drawId,
}: {
  structureId: string;
  eventId: string;
  drawId: string;
}) {
  const chartResult: any = tournamentEngine.getSwissChart?.({ drawId });
  if (!chartResult?.success) return;

  const { rounds } = chartResult;
  const participantMap = buildParticipantMap();

  destroyTable({ anchorId: DRAWS_VIEW });
  const drawsView = document.getElementById(DRAWS_VIEW);
  if (!drawsView) return;

  const container = document.createElement('div');
  container.style.cssText = 'display: flex; gap: 12px; overflow-x: auto; padding: 8px;';

  for (const round of rounds) {
    const col = document.createElement('div');
    col.style.cssText = 'min-width: 160px; flex-shrink: 0;';

    const header = document.createElement('div');
    header.style.cssText =
      'font-weight: 700; font-size: 13px; padding: 4px 8px; margin-bottom: 6px; ' +
      'border-bottom: 2px solid var(--sp-border, #ddd); color: var(--sp-text, #333);';
    header.textContent = round.roundNumber === 0 ? 'Start' : 'Round ' + round.roundNumber;
    col.appendChild(header);

    for (const node of round.nodes) {
      const color = getScoreGroupStyle(node);

      const groupEl = document.createElement('div');
      groupEl.style.cssText =
        'background: ' +
        color.bg +
        '; border-left: 3px solid ' +
        color.border +
        '; border-radius: 4px; margin-bottom: 6px; padding: 4px 6px;';

      const label = document.createElement('div');
      label.style.cssText =
        'display: inline-block; font-size: 10px; font-weight: 700; color: #fff; background: ' +
        color.border +
        '; border-radius: 3px; padding: 1px 6px; margin-bottom: 3px; letter-spacing: 0.5px;';
      label.textContent = formatGroupLabel(node);
      groupEl.appendChild(label);

      for (const pid of node.participantIds) {
        const participant = participantMap.get(pid);
        if (participant) {
          const nameEl = document.createElement('div');
          nameEl.style.cssText = 'padding: 1px 2px; overflow: hidden;';
          nameEl.appendChild(renderParticipantName(participant));
          groupEl.appendChild(nameEl);
        }
      }

      col.appendChild(groupEl);
    }

    container.appendChild(col);
  }

  drawsView.appendChild(container);

  // wire control bar
  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  const structure = drawDefinition?.structures?.find((s: any) => s.structureId === structureId);

  const callback = ({ refresh, view }: { refresh?: boolean; view?: string } = {}) => {
    cleanupDrawPanel();
    if (view) {
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else {
      renderDrawView({ eventId, drawId, structureId, redraw: refresh, roundsView: view });
    }
  };

  drawControlBar({ structure, drawId, existingView: ROUNDS_SWISS_CHART, callback });
}
