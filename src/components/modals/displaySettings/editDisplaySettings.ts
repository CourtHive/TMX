import { getUserCompositionsSync, loadUserCompositions } from 'pages/templates/compositionBridge';
import { mocksEngine, queryGovernor, tools, extensionConstants } from 'tods-competition-factory';
import { resolveCompositionByName } from 'services/compositions/resolveCompositionByName';
import { compositions, renderMatchUp, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'services/factory/engine';
import { displayConfig } from 'config/displayConfig';
import { escapeHtml } from 'utilities/escapeHtml';
import { isFunction } from 'functions/typeOf';

// constants
import { ADD_DRAW_DEFINITION_EXTENSION, ADD_EVENT_EXTENSION } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';
import { t } from 'i18n';

export async function editDisplaySettings(params) {
  const { eventId, drawId, callback } = params;

  // Ensure the user-composition cache is populated before building the
  // selector options + render lookup. Idempotent — repeated calls just
  // re-read IndexedDB.
  await loadUserCompositions().catch(() => {});

  const storedValue = tournamentEngine.findExtension({
    name: extensionConstants.DISPLAY,
    discover: true,
    eventId,
    drawId,
  }).extension?.value;

  // support there being multiple "scopes", e.g. admin, public, etc.
  const scopedValue = storedValue?.admin ?? storedValue;

  const noScheduleInfo = new Set(['Wimbledon', 'French', 'ITF']);
  const saveId = 'saveDisplaySettings';
  const initialName = scopedValue?.compositionName ?? displayConfig.get().composition?.compositionName ?? 'Australian';
  // the saved snapshot belongs to the composition it was saved with, never to one chosen after it
  const snapshotFor = (compositionName) =>
    compositionName === scopedValue?.compositionName ? scopedValue?.configuration : undefined;
  const initialConfiguration = snapshotFor(initialName) ?? resolveCompositionByName(initialName)?.configuration;
  const selections: any = {
    compositionName: initialName,
    // only the form's own fields; everything else comes from the composition (or its saved snapshot)
    configuration: {
      scheduleInfo: !!initialConfiguration?.scheduleInfo,
      pathHighlight: !!initialConfiguration?.pathHighlight,
      participantDetail: initialConfiguration?.participantDetail,
    },
    storedColors: scopedValue?.colors,
    composition: undefined,
    inputs: undefined,
  };

  const startDate = tools.dateTime.extractDate(new Date().toISOString());
  const mockDrawId = 'drawId';
  const venueId = 'venueId';
  const venueProfiles = [
    {
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
  const participantsProfile = { withISO2: true };

  // auto-scheduled, the mocks schedule the draw before playing it, so its completed matchUps carry their schedules
  const tournamentRecord = mocksEngine.generateTournamentRecord({
    completeAllMatchUps: true,
    participantsProfile,
    autoSchedule: true,
    schedulingProfile,
    venueProfiles,
    drawProfiles,
    startDate,
  }).tournamentRecord;
  // the mocks build venues from courts and times only, so the preview venue's online resources are
  // attached to the generated venue (as a venueProfile key they were never read)
  const previewVenue = tournamentRecord.venues?.find((venue) => venue.venueId === venueId);
  if (previewVenue) {
    previewVenue.onlineResources = [
      { identifier: 'https://www.google.com', name: t('modals.displaySettings.google'), resourceType: 'URL' },
    ];
  }

  const matchUps = queryGovernor.allTournamentMatchUps({ tournamentRecord }).matchUps ?? [];
  const matchUp = matchUps.find((matchUp) => matchUp.matchUpType === 'SINGLES');

  const content = document.createElement('div');
  content.style.maxWidth = '500px';
  const matchUpNode = document.createElement('div');
  content.appendChild(matchUpNode);

  const render = ({ compositionName, configuration }) => {
    removeAllChildNodes(matchUpNode);
    const resolved = resolveCompositionByName(compositionName);
    if (!resolved) return;
    selections.composition = resolved;
    const compositionConfiguration = (selections.composition.configuration ??= {});
    Object.assign(compositionConfiguration, snapshotFor(compositionName));
    // the toggle turns the header on or off; when on, a composition's own header options (elapsed, layout) stand
    const scheduleInfo = configuration.scheduleInfo ? compositionConfiguration.scheduleInfo || true : false;
    Object.assign(compositionConfiguration, { ...configuration, scheduleInfo });

    // Extension-level colors (saved snapshot) win over the resolver's
    // user-composition colors so the displayed state survives later edits
    // to the underlying user composition. Only apply on first render
    // for the originally-stored compositionName.
    if (selections.storedColors && compositionName === scopedValue?.compositionName) {
      selections.composition.colors = { ...selections.storedColors };
    }

    selections.composition.genderColor = true;
    selections.composition.compositionName = compositionName;
    const renderedMatchUp = renderMatchUp({
      isLucky: true,
      composition: selections.composition,
      matchUp: matchUp as any,
    });
    matchUpNode.appendChild(renderedMatchUp);
  };

  render(selections);

  const builtinOptions = Object.keys(compositions)
    .filter((x) => x !== 'Night' && x !== 'InlineScoring')
    .map((key) => ({
      selected: key === selections.compositionName,
      label: key,
      value: key,
    }));

  const userOptions = getUserCompositionsSync().map((u) => ({
    selected: u.name === selections.compositionName,
    label: `${escapeHtml(u.name)} (custom)`,
    value: u.name,
  }));

  const compositionOptions = [...builtinOptions, ...userOptions];

  const participantDetail = selections.configuration.participantDetail;
  const detailOptions = [
    { label: t('none'), value: 'NONE', selected: !participantDetail },
    { label: t('locations.address'), value: 'ADDRESS', selected: participantDetail === 'ADDRESS' },
    { label: t('formats.team'), value: 'TEAM', selected: participantDetail === 'TEAM' },
  ];

  const onChange = () => {
    const compositionName = selections.inputs.composition.value;
    if (compositionName !== selections.compositionName) {
      // a newly chosen composition brings its own header setting
      const chosen = snapshotFor(compositionName) ?? resolveCompositionByName(compositionName)?.configuration;
      selections.inputs.showSchedule.checked = !!chosen?.scheduleInfo;
      selections.inputs.pathHighlight.checked = !!chosen?.pathHighlight;
    }
    selections.compositionName = compositionName;
    selections.configuration.scheduleInfo =
      !noScheduleInfo.has(selections.compositionName) && selections.inputs.showSchedule.checked;
    selections.configuration.pathHighlight = selections.inputs.pathHighlight.checked;
    selections.configuration.participantDetail = selections.inputs.detail.value;
    render(selections);
  };

  const formElements = [
    {
      options: compositionOptions,
      label: t('modals.printDraw.composition'),
      field: 'composition',
      onChange,
    },
    {
      controlVisible: !noScheduleInfo.has(selections.compositionName),
      checked: selections.configuration.scheduleInfo,
      controlId: 'scheduleToggle',
      label: t('modals.displaySettings.showSchedule'),
      field: 'showSchedule',
      id: 'showSchedule',
      checkbox: true,
      onChange,
    },
    {
      checked: selections.configuration.pathHighlight,
      label: t('modals.displaySettings.pathHighlight'),
      field: 'pathHighlight',
      checkbox: true,
      onChange,
    },
    {
      options: detailOptions,
      label: t('modals.displaySettings.detail'),
      field: 'detail',
      onChange,
    },
  ];
  const formElement = document.createElement('div');
  content.appendChild(formElement);
  const relationships = [
    {
      onChange: ({ e }) => {
        const display = !noScheduleInfo.has(e.target.value);
        const elem = document.getElementById('scheduleToggle');
        if (elem) elem.style.display = display ? 'block' : NONE;
      },
      control: 'composition',
    },
  ];
  selections.inputs = renderForm(formElement, formElements, relationships);

  const saveComposition = () => {
    const postMutation = () => {
      displayConfig.set({ composition: selections.composition });
      if (isFunction(callback)) callback(selections.composition);
    };
    const existingValue = tournamentEngine.findExtension({
      name: extensionConstants.DISPLAY,
      discover: true,
      eventId,
      drawId,
    })?.extension?.value;
    // Capture the FULL merged configuration (composition source +
    // form overrides) so the saved extension is a self-contained
    // snapshot. Required for user compositions to render with full
    // fidelity in courthive-public, where the named-composition
    // lookup falls back to 'National' (since user compositions live
    // only in TMX's IndexedDB). Saving the full configuration means
    // the public-side renderer reads every flag from the extension
    // and never needs to know what 'MyCustom' resolves to.
    // render() has already merged the form's fields into it, keeping a composition's header options
    const fullConfiguration = { ...(selections.composition.configuration || {}) };
    const extension = {
      value: {
        ...existingValue, // order is important!
        compositionName: selections.composition.compositionName,
        theme: selections.composition.theme,
        configuration: fullConfiguration,
        ...(selections.composition.colors ? { colors: selections.composition.colors } : {}),
      },
      name: extensionConstants.DISPLAY,
    };
    const method = drawId ? ADD_DRAW_DEFINITION_EXTENSION : ADD_EVENT_EXTENSION;
    const methods = [{ method, params: { eventId, drawId, extension } }];
    mutationRequest({ methods, callback: postMutation });
  };

  openModal({
    title: t('modals.displaySettings.title'),
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('common.save'), id: saveId, intent: 'is-info', close: true, onClick: saveComposition },
    ],
    content,
  });
}
