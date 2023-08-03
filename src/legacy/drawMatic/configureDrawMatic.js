import { renderForm } from 'components/renderers/renderForm';
import { drawMatic } from 'legacy/drawMatic/drawMatic';
import { utilities } from 'tods-competition-factory';
import { context } from 'services/context';
import { env } from 'settings/env';

const NO_SELECTION = '-';

export function configureDrawMatic() {
  let evt = context.displayed.draw_event;
  let draw = evt?.draw;
  const hideDelete = !draw?.matches?.length;

  const drawMaticComplete = () => context.modal.close();
  const generate = () => {
    // context.modal.setContent('Generating.... please be patient');
    // context.modal.footerButtons([]);
    setTimeout(() => drawMatic.genRound({ tournament: undefined, env, callback: drawMaticComplete }), 200);
  };

  const content = 'Modify Adhoc event';
  let inputs;

  /*
  const deleteRound = () => {
    const roundNumber = inputs?.roundNumber.value;
    if (!roundNumber || roundNumber === NO_SELECTION) return;

    const round = parseInt(roundNumber);
    draw.matches = draw.matches.filter((m) => m.round !== round || m.match?.score);
    const max_round = Math.max(...[0].concat(draw.matches.map((m) => m.round)));
    context.displayed.draw_event.rounds = max_round || undefined;
  };
  */

  const deleteAdhocRound = () => {
    console.log('footerButtons', { inputs });
    /*
    context.modal.footerButtons([
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Delete', intent: 'is-danger', close: true, onClick: deleteRound }
    ]);
    */
    const existingRounds = (
      draw.matches.reduce((p, c) => (p.indexOf(c.round) >= 0 ? p : p.concat(c.round)), []) || []
    ).sort(utilities.numericSort);

    const content = (elem) => {
      inputs = renderForm(elem, [
        {
          value: '',
          label: 'Round number',
          field: 'roundNumber',
          options: [NO_SELECTION, ...existingRounds].map((round) => ({ label: round, value: round }))
        }
      ]);
    };
    context.modal.setContent(content);
  };

  context.modal.open({
    title: 'DrawMatic',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Delete Round', intent: 'is-warning', hide: hideDelete, onClick: deleteAdhocRound },
      { label: 'Generate Round', intent: 'is-primary', onClick: generate }
    ]
  });
}
