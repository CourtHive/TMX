import { renderParticipant } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

export function scoringModal(params) {
  const { matchUp } = params ?? {};

  let inputs;

  /*
  const enableSubmit = () => {
    const submit = document.getElementById('submitScore');
    console.log({ submit });
  };
  */

  const submitScore = () => {
    console.log({ matchUp, inputs });
    isFunction(params.callback) && console.log('Callback');
  };

  const scaleAttributes = env.scales[env.activeScale];
  const participant = ({ matchUp, sideNumber }) => {
    const participant = matchUp?.sides.find((side) => side.sideNumber === sideNumber)?.participant;
    return renderParticipant({
      composition: {
        configuration: {
          participantDetail: 'TEAM', // ['ADDRESS', 'TEAM'] // TODO: pass display into formatParticipant, or use env
          genderColor: true,
          winnerColor: true,
          scaleAttributes,
          flag: false,
        },
      },
      placeholder: 'TBD',
      participant,
      sideNumber,
      matchUp,
    });
  };
  const p1 = participant({ matchUp, sideNumber: 1 });
  const p2 = participant({ matchUp, sideNumber: 2 });

  const spaceBetween = 'space-between';
  const flexEnd = 'flex-end';

  const container = document.createElement('div');
  container.style.flexDirection = 'column';
  container.style.display = 'flex';
  container.style.padding = '1em';
  container.style.width = '100%';

  const getSide = (marginBottom, p) => {
    const side = document.createElement('div');
    side.style.justifyContent = spaceBetween;
    side.style.marginBottom = marginBottom;
    side.style.flexDirection = 'row';
    side.style.display = 'flex';
    side.appendChild(p);
    return side;
  };

  const side1 = getSide('0.5em', p1);
  const side2 = getSide('0em', p2);

  const getInput = (sideNumber, i) => {
    const input = document.createElement('input');
    input.style.marginLeft = '0.5em';
    input.className = 'input';
    input.style.width = '2em';
    input.id = `i${sideNumber}-${i}`;
    return input;
  };

  const getScoreLine = (marginBottom, sideNumber) => {
    const scoreline = document.createElement('div');
    scoreline.style.marginBottom = marginBottom;
    scoreline.style.justifyContent = flexEnd;
    scoreline.style.flexDirection = 'row';
    scoreline.style.display = 'flex';

    const input1 = getInput(sideNumber, 1);
    const input2 = getInput(sideNumber, 2);
    scoreline.appendChild(input1);
    scoreline.appendChild(input2);

    return scoreline;
  };

  const scorelineSide1 = getScoreLine('0.5em', 1);
  side1.appendChild(scorelineSide1);

  const scorelineSide2 = getScoreLine('0em', 2);
  side2.appendChild(scorelineSide2);

  container.appendChild(side1);
  container.appendChild(side2);

  openModal({
    title: 'Score entry',
    content: container,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      {
        onClick: submitScore,
        intent: 'is-primary',
        id: 'submitScore',
        disabled: false,
        label: 'Submit',
        close: true,
      },
    ],
  });
}
