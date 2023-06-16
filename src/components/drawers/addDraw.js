import { tournamentEngine, drawDefinitionConstants, utilities } from 'tods-competition-factory';
import { nameValidator } from 'components/validators/nameValidator';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { RIGHT, acceptedEntryStatuses } from 'constants/tmxConstants';
import { ADD_DRAW_DEFINITION } from 'constants/mutationConstants';

const {
  AD_HOC,
  COMPASS,
  CURTIS,
  DOUBLE_ELIMINATION,
  /*
  FEED_IN_CHAMPIONSHIP_TO_QF,
  FEED_IN_CHAMPIONSHIP_TO_R16,
  */
  FEED_IN_CHAMPIONSHIP_TO_SF,
  FEED_IN_CHAMPIONSHIP,
  FEED_IN,
  FIRST_MATCH_LOSER_CONSOLATION,
  FIRST_ROUND_LOSER_CONSOLATION,
  // LUCKY_DRAW,
  // MODIFIED_FEED_IN_CHAMPIONSHIP,
  OLYMPIC,
  PLAY_OFF,
  MAIN,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SINGLE_ELIMINATION
} = drawDefinitionConstants;

function acceptedEntriesCount(event) {
  return event.entries.filter(({ entryStage = MAIN, entryStatus }) =>
    acceptedEntryStatuses.includes(`${entryStage}.${entryStatus}`)
  ).length;
}

export function addDraw({ eventId, callback }) {
  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  const drawsCount = event.drawDefinitions?.length || 0;

  const AUTOMATED = 'Automated';
  const MANUAL = 'Manual';

  const scoreFormatOptions = [{ label: 'Best of 3 Sets', value: 'SET3-S:6/TB7', selected: true }];

  let inputs;
  const content = (elem) => {
    inputs = renderForm(elem, [
      {
        placeholder: 'Display name of the draw',
        value: `Draw ${drawsCount + 1}`,
        label: 'Draw name',
        field: 'drawName',
        error: 'Please enter a name of at least 5 characters',
        validator: nameValidator(5)
      },
      {
        value: '',
        label: 'Draw Type',
        field: 'drawType',
        options: [
          { label: 'Single elimination', value: SINGLE_ELIMINATION },
          { label: 'Feed in championship', value: FEED_IN_CHAMPIONSHIP },
          { label: 'Feed in championship to SF', value: FEED_IN_CHAMPIONSHIP_TO_SF },
          { label: 'First match loser consolation', value: FIRST_MATCH_LOSER_CONSOLATION },
          { label: 'First round loser consolation', value: FIRST_ROUND_LOSER_CONSOLATION },
          { label: 'Compass', value: COMPASS },
          { label: 'Olympic', value: OLYMPIC },
          { label: 'Curtis consolation', value: CURTIS },
          { label: 'Round robin', value: ROUND_ROBIN },
          { label: 'Round robin w/ playoff', value: ROUND_ROBIN_WITH_PLAYOFF },
          { label: 'Double elimination', value: DOUBLE_ELIMINATION },
          { label: 'Feed in', value: FEED_IN },
          { label: 'Playoff', value: PLAY_OFF },
          { label: 'Ad-hoc', value: AD_HOC }
        ]
      },
      {
        value: acceptedEntriesCount(event),
        label: 'Draw size',
        field: 'drawSize'
      },
      {
        value: '',
        label: 'Creation',
        field: 'automated',
        options: [
          { label: AUTOMATED, value: AUTOMATED, selected: true },
          { label: MANUAL, value: false }
        ]
      },
      {
        value: '',
        label: 'Score format',
        field: 'matchUpFormat',
        options: scoreFormatOptions
      }
    ]);
  };

  const isValid = () => nameValidator(5)(inputs.drawName.value);
  const submit = () => {
    if (!isValid()) {
      tmxToast({ message: 'Missing Draw name', intent: 'is-danger' });
    } else {
      const drawType = inputs.drawType.options[inputs.drawType.selectedIndex].getAttribute('value');
      const automated = inputs.automated.value === AUTOMATED;
      const matchUpFormat = inputs.matchUpFormat.value;
      const drawName = inputs.drawName.value;

      const drawSizeValue = inputs.drawSize.value;
      const drawSizeInteger = utilities.isConvertableInteger(drawSizeValue) && parseInt(drawSizeValue);
      const drawSize = (drawType === FEED_IN && drawSizeInteger) || utilities.nextPowerOf2(drawSizeInteger);

      if (drawSizeInteger) {
        const result = tournamentEngine.generateDrawDefinition({
          drawEntries: event.entries,
          matchUpFormat,
          automated,
          drawType,
          drawName,
          drawSize,
          eventId
        });

        if (result.success) {
          const drawDefinition = result.drawDefinition;
          const methods = [{ method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition } }];
          const postMutation = (result) => isFunction(callback) && callback({ drawDefinition, ...result });
          mutationRequest({ methods, callback: postMutation });
        } else if (result.error) {
          tmxToast({
            message: result.error?.message,
            intent: 'is-warning',
            pauseOnHover: true
          });
        }
      } else {
        tmxToast({
          message: 'Invalid draw size',
          intent: 'is-warning',
          pauseOnHover: true
        });
      }
    }
  };
  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Generate', intent: 'is-primary', onClick: submit, close: isValid }
  ];
  const title = `Configure draw`;

  const footer = (elem, close) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, context: 'tournament', side: RIGHT, width: 400 });
}
