import { mocksEngine, queryGovernor, tournamentEngine, tools, extensionConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { compositions, renderMatchUp } from 'courthive-components';
import { openModal } from 'components/modals/baseModal/baseModal';
import { removeAllChildNodes } from 'services/dom/transformers';
import { renderForm } from 'components/renderers/renderForm';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

// constants
import { ADD_DRAW_DEFINITION_EXTENSION, ADD_EVENT_EXTENSION } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function editDisplaySettings(params) {
  const { eventId, drawId, callback } = params;
  const storedValue = tournamentEngine.findExtension({
    name: extensionConstants.DISPLAY,
    discover: true,
    eventId,
    drawId,
  }).extension?.value;

  // support there being multiple "scopes", e.g. admin, public, etc.
  const scopedValue = storedValue?.admin ?? storedValue;

  const noScheduleInfo = ['Wimbledon', 'French', 'ITF'];
  const saveId = 'saveDisplaySettings';
  const selections: any = {
    compositionName: scopedValue?.compositionName ?? env.composition?.compositionName ?? 'Australian',
    configuration: scopedValue?.configuration ?? {},
    composition: undefined,
    inputs: undefined,
  };

  const startDate = tools.dateTime.extractDate(new Date().toISOString());
  const mockDrawId = 'drawId';
  const venueId = 'venueId';
  const venueProfiles = [
    {
      onlineResources: [{ link: 'https://www.google.com', label: 'Google' }],
      venueName: 'Club Courts',
      venueAbbreviation: 'CC',
      startTime: '08:00',
      endTime: '20:00',
      courtsCount: 6,
      venueId,
    },
  ];
  const drawProfiles = [
    {
      eventName: `WTN 14-19 SINGLES`,
      category: { ratingType: 'WTN', ratingMin: 14, ratingMax: 19.99 },
      drawId: mockDrawId,
      generate: true,
      drawSize: 4,
    },
  ];
  const schedulingProfile = [
    {
      scheduleDate: startDate,
      venues: [
        {
          rounds: [{ drawId: mockDrawId, winnerFinishingPositionRange: '1-2' }],
          venueId: venueProfiles[0].venueId,
        },
      ],
    },
  ];
  const participantsProfile = { withScaleValues: true };

  const tournamentRecord = mocksEngine.generateTournamentRecord({
    scheduleCompletedMatchUps: true,
    completeAllMatchUps: true,
    participantsProfile,
    autoSchedule: true,
    schedulingProfile,
    venueProfiles,
    drawProfiles,
    startDate,
  }).tournamentRecord;

  const matchUps = queryGovernor.allTournamentMatchUps({ tournamentRecord }).matchUps;
  const matchUp = matchUps.find((matchUp) => matchUp.matchUpType === 'SINGLES');

  const content = document.createElement('div');
  content.style.maxWidth = '500px';
  const matchUpNode = document.createElement('div');
  content.appendChild(matchUpNode);

  const render = ({ compositionName, configuration }) => {
    removeAllChildNodes(matchUpNode);
    selections.composition = compositions[compositionName];
    selections.composition.configuration.flags = undefined;
    Object.assign(selections.composition.configuration, configuration);

    selections.composition.genderColor = true;
    selections.composition.compositionName = compositionName;
    const renderedMatchUp = renderMatchUp({ isLucky: true, composition: selections.composition, matchUp });
    matchUpNode.appendChild(renderedMatchUp);
  };

  render(selections);

  const compositionOptions = Object.keys(compositions)
    .filter((x) => x !== 'Night')
    .map((key) => ({
      selected: key === selections.compositionName,
      label: key,
      value: key,
    }));

  const participantDetail = selections.configuration.participantDetail;
  const detailOptions = [
    { label: 'None', value: 'NONE', selected: !participantDetail },
    { label: 'Address', value: 'ADDRESS', selected: participantDetail === 'ADDRESS' },
    { label: 'Team', value: 'TEAM', selected: participantDetail === 'TEAM' },
  ];

  const onChange = () => {
    selections.compositionName = selections.inputs.composition.value;
    selections.configuration.scheduleInfo =
      !noScheduleInfo.includes(selections.compositionName) && selections.inputs.showSchedule.checked;
    selections.configuration.participantDetail = selections.inputs.detail.value;
    render(selections);
  };

  const formElements = [
    {
      options: compositionOptions,
      label: 'Composition',
      field: 'composition',
      onChange,
    },
    {
      controlVisible: !noScheduleInfo.includes(selections.compositionName),
      checked: selections.configuration.scheduleInfo,
      controlId: 'scheduleToggle',
      label: 'Show Schedule',
      field: 'showSchedule',
      id: 'showSchedule',
      checkbox: true,
      onChange,
    },
    {
      options: detailOptions,
      label: 'Detail',
      field: 'detail',
      onChange,
    },
  ];
  const formElement = document.createElement('div');
  content.appendChild(formElement);
  const relationships = [
    {
      onChange: ({ e }) => {
        const display = !noScheduleInfo.includes(e.target.value);
        const elem = document.getElementById('scheduleToggle');
        if (elem) elem.style.display = display ? 'block' : NONE;
      },
      control: 'composition',
    },
  ];
  selections.inputs = renderForm(formElement, formElements, relationships);

  const saveComposition = () => {
    const postMutation = () => {
      console.log('Mutation completed');
    };
    const existingValue = tournamentEngine.findExtension({
      name: extensionConstants.DISPLAY,
      discover: true,
      eventId,
      drawId,
    })?.extension?.value;
    const extension = {
      value: {
        ...existingValue, // order is important!
        compositionName: selections.composition.compositionName,
        configuration: selections.configuration,
      },
      name: extensionConstants.DISPLAY,
    };
    const method = drawId ? ADD_DRAW_DEFINITION_EXTENSION : ADD_EVENT_EXTENSION;
    const methods = [{ method, params: { eventId, drawId, extension } }];
    mutationRequest({ methods, callback: postMutation });
    if (isFunction(callback)) callback(selections.composition);
    env.composition = selections.composition;
  };

  openModal({
    title: `Edit display settings`,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Save', id: saveId, intent: 'is-info', close: true, onClick: saveComposition },
    ],
    content,
  });
}
