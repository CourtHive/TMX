export function updateControlBar(refresh) {
  if (refresh) getData();

  const eventOptions = events
    .map((event) => ({
      onClick: () => {
        const result = tournamentEngine.getEventData({ eventId: event.eventId });
        if (!result.eventData?.drawsData?.length) {
          navigateToEvent({ eventId: event.eventId });
        } else {
          drawId = result.eventData.drawsData?.[0]?.drawId;
          navigateToEvent({ eventId: result.eventData.eventInfo.eventId, drawId, renderDraw: true });
        }
      },
      label: event.eventName,
      close: true
    }))
    .concat([
      { divider: true },
      { label: `<div style='font-weight: bold'>${ALL_EVENTS}</div>`, onClick: displayAllEvents, close: true }
    ]);

  const drawsOptions = eventData.drawsData
    .map((draw) => ({
      onClick: () => {
        const drawId = draw.drawId;
        const structureId = draw.structures?.[0]?.structureId;
        navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      },
      label: draw.drawName,
      close: true
    }))
    .concat([{ divider: true }, { heading: 'Add flight', onClick: () => console.log('Add new flight') }]);

  const structureOptions = drawData.structures
    .map((structure) => ({
      onClick: () => {
        navigateToEvent({ eventId, drawId, structureId: structure.structureId, renderDraw: true });
      },
      label: structure.structureName,
      close: true
    }))
    .concat([
      { divider: true },
      {
        onClick: () => console.log('edit structure names'),
        label: 'Edit structure names',
        modifyLabel: false,
        close: true
      },
      {
        onClick: () => addStructures({ drawId, structureId, callback: () => updateControlBar(true) }),
        label: 'Add structure(s)',
        modifyLabel: false,
        close: true
      }
    ]);

  // PARTICIPANT filter
  const searchFilter = (rowData) => rowData.searchText?.includes(participantFilter);
  const updateParticipantFilter = (value) => {
    if (!value) {
      Object.values(context.tables)
        .filter(Boolean)
        // TODO: update this search logic!
        // .forEach((table) => table.removeFilter(searchFilter));
        .forEach((table) => table.clearFilter());
    }
    participantFilter = value?.toLowerCase();
    if (value) {
      Object.values(context.tables)
        .filter(Boolean)
        .forEach((table) => table.addFilter(searchFilter));
    }
    args.nameFilter = value; // tods-react-draws
    updateDrawDisplay(args);
  };

  const deleteDraw = () => {
    const methods = [{ method: DELETE_FLIGHT_AND_DRAW, params: { eventId, drawId } }];
    const postMutation = (result) => result.success && navigateToEvent({ eventId });
    mutationRequest({ methods, callback: postMutation });
  };

  const editMatchUpFormat = ({ structureId, drawId }) => {
    const existingMatchUpFormat = tournamentEngine.getMatchUpFormat({ drawId, structureId }).matchUpFormat;
    const callback = (matchUpFormat) => {
      if (matchUpFormat) {
        if (matchUpFormat === existingMatchUpFormat) {
          tmxToast({ message: 'No changes', intent: 'is-warning' });
        } else {
          const methods = [
            {
              params: { matchUpFormat, structureId, drawId },
              method: SET_MATCHUP_FORMAT
            }
          ];
          const postMutation = (result) => result.success && tmxToast({ message: 'Scoring changed' });
          mutationRequest({ methods, callback: postMutation });
        }
      }
    };
    getMatchUpFormat({ callback });
  };

  const actionOptions = [
    {
      hide: eventData.eventInfo.eventType !== TEAM,
      onClick: () => updateTieFormat({ structureId, eventId, drawId }),
      label: 'Edit scorecard',
      close: true
    },
    {
      hide: eventData.eventInfo.eventType === TEAM,
      onClick: () => editMatchUpFormat({ structureId, eventId, drawId }),
      label: `Edit ${structureName} scoring`,
      close: true
    },
    {
      onClick: () => navigateToEvent({ eventId, drawId }),
      label: 'View entries'
    },
    {
      onClick: deleteDraw,
      label: 'Delete draw'
    }
  ];

  const items = [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateParticipantFilter(''),
      onChange: (e) => updateParticipantFilter(e.target.value),
      onKeyUp: (e) => updateParticipantFilter(e.target.value),
      placeholder: 'Participant name',
      location: LEFT
    },
    {
      options: eventOptions.length > 1 ? eventOptions : undefined,
      label: eventData.eventInfo.eventName,
      modifyLabel: true,
      location: LEFT
    },
    {
      options: drawsOptions.length > 1 ? drawsOptions : undefined,
      label: drawData.drawName,
      modifyLabel: true,
      location: LEFT
    },
    {
      options: structureOptions.length > 1 ? structureOptions : undefined,
      label: structureName,
      modifyLabel: true,
      location: LEFT
    },
    {
      options: actionOptions,
      intent: 'is-info',
      label: 'Actions',
      location: RIGHT,
      align: RIGHT
    }
  ];

  controlBar({ target: eventControlElement, items });
}
