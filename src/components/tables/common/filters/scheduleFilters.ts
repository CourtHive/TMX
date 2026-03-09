/**
 * Schedule-specific table filters for the unscheduled matchUps grid.
 * Each filter follows the same pattern as sexFilter/eventFilter/teamFilter:
 * returns { options[], isFiltered() } for use with filterPopoverButton.
 */
import { tournamentEngine, tools } from 'tods-competition-factory';
import { t } from 'i18n';

export function getScheduleEventFilter(
  table: any,
  onChange?: () => void,
): { eventOptions: any[]; hasOptions: boolean; isFiltered: () => boolean } {
  let filterValue: string | undefined;

  const eventFilter = (rowData: any): boolean => rowData.eventId === filterValue;
  const updateFilter = (eventId?: string) => {
    table.removeFilter(eventFilter);
    filterValue = eventId;
    if (eventId) table.addFilter(eventFilter);
    if (onChange) onChange();
  };

  const events = tournamentEngine.getEvents().events || [];
  const allLabel = t('pages.schedule.allEvents');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const eventOptions = [allOption, { divider: true }].concat(
    events.map((event: any) => ({
      onClick: () => updateFilter(event.eventId),
      label: event.eventName,
      close: true,
    })),
  );

  return { eventOptions, hasOptions: events.length > 1, isFiltered: () => !!filterValue };
}

export function getScheduleEventTypeFilter(
  table: any,
  onChange?: () => void,
): { eventTypeOptions: any[]; hasOptions: boolean; isFiltered: () => boolean } {
  let filterValue: string | undefined;

  const eventTypeFilter = (rowData: any): boolean => rowData.eventType === filterValue;
  const updateFilter = (eventType?: string) => {
    table.removeFilter(eventTypeFilter);
    filterValue = eventType;
    if (eventType) table.addFilter(eventTypeFilter);
    if (onChange) onChange();
  };

  const events = tournamentEngine.getEvents().events || [];
  const eventTypes = tools.unique(events.map((event: any) => event.eventType)).filter(Boolean);
  const allLabel = t('pages.schedule.allEventTypes');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const eventTypeOptions = [allOption, { divider: true }].concat(
    eventTypes.map((eventType: string) => ({
      onClick: () => updateFilter(eventType),
      label: eventType,
      close: true,
    })),
  );

  return { eventTypeOptions, hasOptions: eventTypes.length > 1, isFiltered: () => !!filterValue };
}

export function getScheduleGenderFilter(
  table: any,
  onChange?: () => void,
): { genderOptions: any[]; hasOptions: boolean; isFiltered: () => boolean } {
  let filterValue: string | undefined;

  const genderFilter = (rowData: any): boolean => rowData.gender === filterValue;
  const updateFilter = (gender?: string) => {
    table.removeFilter(genderFilter);
    filterValue = gender;
    if (gender) table.addFilter(genderFilter);
    if (onChange) onChange();
  };

  const events = tournamentEngine.getEvents().events || [];
  const genders = tools.unique(events.map((event: any) => event.gender)).filter(Boolean);
  const allLabel = t('pages.schedule.allGenders');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const genderOptions = [allOption, { divider: true }].concat(
    genders.map((gender: string) => ({
      onClick: () => updateFilter(gender),
      label: gender,
      close: true,
    })),
  );

  return { genderOptions, hasOptions: genders.length > 1, isFiltered: () => !!filterValue };
}

export function getScheduleRoundFilter(
  table: any,
  matchUps: any[],
  onChange?: () => void,
): { roundOptions: any[]; hasOptions: boolean; isFiltered: () => boolean } {
  let filterValue: string | undefined;

  const roundFilter = (rowData: any): boolean => rowData.roundName === filterValue;
  const updateFilter = (roundName?: string) => {
    table.removeFilter(roundFilter);
    filterValue = roundName;
    if (roundName) table.addFilter(roundFilter);
    if (onChange) onChange();
  };

  const roundNames = tools.unique(matchUps.map((m: any) => m.roundName)).filter(Boolean);
  const allLabel = t('pages.schedule.allRounds');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const roundOptions = [allOption, { divider: true }].concat(
    roundNames.map((roundName: string) => ({
      onClick: () => updateFilter(roundName),
      label: roundName,
      close: true,
    })),
  );

  return { roundOptions, hasOptions: roundNames.length > 1, isFiltered: () => !!filterValue };
}

export function getScheduleFlightFilter(
  table: any,
  matchUps: any[],
  onChange?: () => void,
): { flightOptions: any[]; hasOptions: boolean; isFiltered: () => boolean } {
  let filterValue: string | undefined;

  const flightFilter = (rowData: any): boolean => rowData.flight === filterValue;
  const updateFilter = (flightName?: string) => {
    table.removeFilter(flightFilter);
    filterValue = flightName;
    if (flightName) table.addFilter(flightFilter);
    if (onChange) onChange();
  };

  const flightNames = tools.unique(matchUps.map((m: any) => m.drawName)).filter(Boolean);
  const allLabel = t('pages.schedule.allFlights');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const flightOptions = [allOption, { divider: true }].concat(
    flightNames.map((flightName: string) => ({
      onClick: () => updateFilter(flightName),
      label: flightName,
      close: true,
    })),
  );

  return { flightOptions, hasOptions: flightNames.length > 1, isFiltered: () => !!filterValue };
}
