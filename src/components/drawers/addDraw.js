import { numericValidator } from 'components/validators/numericValidator';
import { nameValidator } from 'components/validators/nameValidator';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderOptions } from 'components/renderers/renderField';
import { removeAllChildNodes } from 'services/dom/transformers';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import {
  tournamentEngine,
  drawDefinitionConstants,
  entryStatusConstants,
  eventConstants,
  drawEngine,
  utilities
} from 'tods-competition-factory';

import { NONE, RIGHT, acceptedEntryStatuses } from 'constants/tmxConstants';
import { ADD_DRAW_DEFINITION } from 'constants/mutationConstants';

const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;
const { TEAM } = eventConstants;

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
  const tieFormatOptions = [{ label: 'Dominant Duo', value: 'DOMINANT_DUO', selected: true }];

  let inputs,
    drawType = SINGLE_ELIMINATION;

  const { validGroupSizes } = drawEngine.getValidGroupSizes({ drawSize: 32, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size) => ({ label: size, value: size }));

  const items = [
    {
      placeholder: 'Display name of the draw',
      value: `Draw ${drawsCount + 1}`,
      label: 'Draw name',
      field: 'drawName',
      error: 'Please enter a name of at least 5 characters',
      validator: nameValidator(5)
    },
    {
      value: drawType,
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
      validator: numericValidator,
      label: 'Draw size',
      field: 'drawSize'
    },
    {
      visible: [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: roundRobinOptions,
      label: 'Group size',
      field: 'groupSize',
      value: 4
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
      hide: event.eventType === TEAM,
      options: scoreFormatOptions,
      field: 'matchUpFormat',
      label: 'Score format',
      value: ''
    },
    {
      hide: event.eventType !== TEAM,
      options: tieFormatOptions,
      field: 'tieFormatName',
      label: 'Tie format',
      value: ''
    }
  ];

  const drawTypeChange = ({ e, fields }) => {
    const visible = [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(e.target.value);
    fields['groupSize'].style.display = visible ? '' : NONE;
  };

  const drawSizeChange = ({ inputs }) => {
    const drawSize = inputs['drawSize'].value;
    const { validGroupSizes } = drawEngine.getValidGroupSizes({ drawSize, groupSizeLimit: 8 });
    const options = validGroupSizes.map((size) => ({ label: size, value: size }));
    const groupSizeSelect = inputs['groupSize'];
    const value = validGroupSizes.includes(4) ? 4 : validGroupSizes[0];
    removeAllChildNodes(groupSizeSelect);
    renderOptions(groupSizeSelect, { options, value });
  };

  const relationships = [
    {
      onChange: drawTypeChange,
      control: 'drawType'
    },
    {
      onChange: drawSizeChange,
      control: 'drawSize'
    }
  ];

  const content = (elem) => {
    inputs = renderForm(elem, items, relationships);
  };

  const isValid = () => nameValidator(5)(inputs.drawName.value);
  const submit = () => {
    if (!isValid()) {
      tmxToast({ message: 'Missing Draw name', intent: 'is-danger' });
    } else {
      const drawType = inputs.drawType.options[inputs.drawType.selectedIndex].getAttribute('value');
      const automated = inputs.automated.value === AUTOMATED;
      const tieFormatName = inputs.tieFormatName?.value;
      const matchUpFormat = inputs.matchUpFormat?.value;
      const drawName = inputs.drawName.value;

      const drawSizeValue = inputs.drawSize.value;
      const groupSize = parseInt(inputs.groupSize.value);
      const drawSizeInteger = utilities.isConvertableInteger(drawSizeValue) && parseInt(drawSizeValue);
      const drawSize = (drawType === FEED_IN && drawSizeInteger) || utilities.nextPowerOf2(drawSizeInteger);
      const drawEntries = event.entries.filter(
        ({ entryStage, entryStatus }) => entryStage === MAIN && DIRECT_ENTRY_STATUSES.includes(entryStatus)
      );

      const drawOptions = {
        tieFormatName,
        matchUpFormat,
        drawEntries,
        automated,
        drawType,
        drawName,
        drawSize,
        eventId
      };
      if ([ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType)) {
        drawOptions.structureOptions = { groupSize };
      }

      if (drawSizeInteger) {
        const result = tournamentEngine.generateDrawDefinition(drawOptions);

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
  context.drawer.open({ title, content, footer, context: 'tournament', side: RIGHT, width: '300px' });
}
