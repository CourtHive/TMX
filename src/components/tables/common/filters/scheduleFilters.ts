/**
 * Schedule-specific table filters for the unscheduled matchUps grid.
 * Built on a generic factory; each exported function is a thin wrapper
 * that supplies the field, values, and label for its filter type.
 */
import { tournamentEngine, tools } from 'tods-competition-factory';
import { t } from 'i18n';

// ---------------------------------------------------------------------------
// Generic schedule filter factory
// ---------------------------------------------------------------------------

type FilterResult = { options: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number };

type ScheduleFilterConfig = {
  field: string;
  values: { value: string; label: string }[];
  allLabel: string;
};

function createScheduleFilter(table: any, config: ScheduleFilterConfig, onChange?: () => void): FilterResult {
  let filterValue: string | undefined;

  const filterFn = (rowData: any): boolean => rowData[config.field] === filterValue;
  const updateFilter = (value?: string) => {
    table.removeFilter(filterFn);
    filterValue = value;
    if (value) table.addFilter(filterFn);
    if (onChange) onChange();
  };

  const allOption = {
    label: `<span style='font-weight: bold'>${config.allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const options = [allOption, { divider: true }].concat(
    config.values.map(({ value, label }) => ({
      onClick: () => updateFilter(value),
      filterValue: value,
      label,
      close: true,
    })),
  );

  const selectableOptions = options.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    return idx >= 0 ? idx : 0;
  };

  return { options, hasOptions: config.values.length > 1, isFiltered: () => !!filterValue, activeIndex };
}

// ---------------------------------------------------------------------------
// Concrete filters
// ---------------------------------------------------------------------------

export function getScheduleEventFilter(
  table: any,
  onChange?: () => void,
): { eventOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  const events = tournamentEngine.getEvents().events || [];
  const { options, ...rest } = createScheduleFilter(
    table,
    {
      field: 'eventId',
      values: events.map((e: any) => ({ value: e.eventId, label: e.eventName })),
      allLabel: t('pages.schedule.allEvents'),
    },
    onChange,
  );
  return { eventOptions: options, ...rest };
}

export function getScheduleEventTypeFilter(
  table: any,
  onChange?: () => void,
): { eventTypeOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  const events = tournamentEngine.getEvents().events || [];
  const eventTypes: string[] = tools.unique(events.map((e: any) => e.eventType)).filter(Boolean);
  const { options, ...rest } = createScheduleFilter(
    table,
    {
      field: 'eventType',
      values: eventTypes.map((v) => ({ value: v, label: v })),
      allLabel: t('pages.schedule.allEventTypes'),
    },
    onChange,
  );
  return { eventTypeOptions: options, ...rest };
}

export function getScheduleGenderFilter(
  table: any,
  onChange?: () => void,
): { genderOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  const events = tournamentEngine.getEvents().events || [];
  const genders: string[] = tools.unique(events.map((e: any) => e.gender)).filter(Boolean);
  const { options, ...rest } = createScheduleFilter(
    table,
    {
      field: 'gender',
      values: genders.map((v) => ({ value: v, label: v })),
      allLabel: t('pages.schedule.allGenders'),
    },
    onChange,
  );
  return { genderOptions: options, ...rest };
}

export function getScheduleRoundFilter(
  table: any,
  matchUps: any[],
  onChange?: () => void,
): { roundOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  const roundNames: string[] = tools.unique(matchUps.map((m: any) => m.roundName)).filter(Boolean);
  const { options, ...rest } = createScheduleFilter(
    table,
    {
      field: 'roundName',
      values: roundNames.map((v) => ({ value: v, label: v })),
      allLabel: t('pages.schedule.allRounds'),
    },
    onChange,
  );
  return { roundOptions: options, ...rest };
}

export function getScheduleFlightFilter(
  table: any,
  matchUps: any[],
  onChange?: () => void,
): { flightOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  const flightNames: string[] = tools.unique(matchUps.map((m: any) => m.drawName)).filter(Boolean);
  const { options, ...rest } = createScheduleFilter(
    table,
    {
      field: 'flight',
      values: flightNames.map((v) => ({ value: v, label: v })),
      allLabel: t('pages.schedule.allFlights'),
    },
    onChange,
  );
  return { flightOptions: options, ...rest };
}
