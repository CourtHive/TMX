/**
 * Handle round header click for ad hoc and lucky draws.
 * Shows tipster with context-appropriate actions.
 */
import { addMatchUpsAction, addRoundAction, deleteMatchUpsAction } from './adHocRoundOptions';
import { luckyLoserSelection } from 'components/modals/luckyLoserSelection';
import { deleteAdHocMatchUps } from 'components/modals/deleteAdHocMatchUps';
import { addAdHocMatchUps } from 'components/modals/addAdHocMatchUps';
import { addAdHocRound } from 'components/modals/addAdHocRound';
import { tournamentEngine } from 'tods-competition-factory';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export function handleRoundHeaderClick(props: any): void {
  const { structureId, drawId, roundNumber } = props?.context ?? props;
  const structure = props.eventData?.drawsData
    ?.find((drawData: any) => drawData.drawId === drawId)
    ?.structures?.find((s: any) => s.structureId === structureId);

  const roundActions: any[] = [];

  if (tournamentEngine.isAdHoc({ structure })) {
    const adHocRoundAction = [
      {
        onClick: () => addAdHocMatchUps({ ...props }),
        text: addMatchUpsAction,
      },
      {
        onClick: () => addAdHocRound({ ...props, structure, roundNumber: undefined, newRound: true }),
        text: addRoundAction,
      },
      {
        onClick: () => deleteAdHocMatchUps({ ...props }),
        text: deleteMatchUpsAction,
        color: 'var(--tmx-accent-red, #ff6b6b)',
      },
    ];

    roundActions.push(...adHocRoundAction);
  }

  // Lucky draw: show round panel for any pre-feed round
  const luckyStatus = tournamentEngine.getLuckyDrawRoundStatus({ drawId });
  if (luckyStatus?.isLuckyDraw && roundNumber) {
    const round = luckyStatus.rounds?.find((r: any) => r.roundNumber === roundNumber);

    if (round?.isPreFeedRound) {
      const label = round.needsLuckySelection
        ? 'Select lucky loser...'
        : round.isComplete
          ? 'Lucky round details...'
          : `Lucky round (${round.completedCount}/${round.matchUpsCount})...`;

      roundActions.push({
        onClick: () =>
          luckyLoserSelection({
            roundNumber,
            structureId,
            callback: props.callback,
            drawId,
          }),
        text: label,
      });
    }
  }

  if (props?.pointerEvent && roundActions.length) {
    tipster({ items: roundActions, target: props.pointerEvent.target, config: { placement: BOTTOM } });
  }
}
