/**
 * The participants table's footer (individual competitors): counts that are also one-click filters, as the matchUps
 * footer's status chips are (CA 2026-11-20).
 *
 *   [Male 64] [Female 61]   [Signed in 40] [Not signed in 88]   [Entered 119] [Unentered 9]
 *   [No rating 22] [No DOB 14]   Age [U12 18] [U14 41] [U16 77] …
 *
 * Every group is a chip filter the filter popover shows too, so the two never disagree and the popover's
 * "clear filters" reaches a filter set here.
 *
 * Which rows are counted follows the call sheet: the selected rows when there are any, otherwise the rows the
 * filters leave visible. "Visible" is per group, as in the matchUps footer: a group counts the rows every OTHER
 * filter lets through, so turning on [Male] does not zero [Female].
 */
import {
  ENTERED,
  NO_AGE_CATEGORY,
  NO_DOB,
  NO_RATING,
  NOT_SIGNED_IN,
  SIGNED_IN,
  UNENTERED,
  ageBuckets,
  createAgeIndex,
  expandAgeRules,
  hasDob,
  hasRating,
  isEntered,
  isSignedIn,
} from './participantFacets';
import {
  createChipFilter,
  type ChipFilter,
  type ChipOption,
  type ChipSection,
} from 'components/tables/common/filters/chipFilter';
import { eventGovernor, genderConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

const { MALE, FEMALE } = genderConstants;

export type FacetGroup = {
  key: string;
  /** shown before the chips in the footer, and above them in the popover */
  label: string;
  options: ChipOption[];
  filter: ChipFilter;
  matches: (rowData: any, value: string) => boolean;
  /**
   * Values whose chip the footer hides while no row has them (a decade nobody is in, "No age category" in a field
   * where everyone fits). Judged on every paint over all the table's rows, so a participant added by any route (an
   * import, generated participants, a manual add, another director's mutation) brings their chip back.
   */
  hideWhenEmpty?: Set<string>;
  /**
   * A row's values at once, for a group where finding them is the expensive part (age): one lookup per row
   * instead of one `matches` call per value. Must agree with `matches`.
   */
  valuesOf?: (rowData: any) => Iterable<string> | undefined;
};

const section = (group: FacetGroup): ChipSection => ({
  options: group.options,
  isOn: group.filter.isOn,
  toggle: group.filter.toggle,
  clear: group.filter.clear,
});

/** The sex filter (built for the popover by getSexFilter) as a footer group. */
export function sexGroup(sex: { filter: ChipFilter; genders: Record<string, string> }): FacetGroup {
  const values = [MALE, FEMALE];
  return {
    key: 'sex',
    label: t('pages.participants.footer.gender'),
    options: values.map((value) => ({ value, label: sex.genders[value] })),
    filter: sex.filter,
    matches: (rowData, value) => rowData.participant?.person?.sex === value,
  };
}

/** A group's popover section: chips on the same filter the footer toggles. */
export const facetSection = (group: FacetGroup) => ({
  label: group.label,
  chips: section(group),
  isFiltered: group.filter.isFiltered,
});

type GroupArgs = {
  key: 'signIn' | 'entry' | 'gaps' | 'ages';
  label: string;
  options: ChipOption[];
  matches: (rowData: any, value: string) => boolean;
};

function chipGroup(table: any, { key, label, options, matches }: GroupArgs): FacetGroup {
  const filters = context.participantFilters;
  const filter = createChipFilter({
    table,
    values: options.map(({ value }) => value),
    matches,
    initial: filters[key],
    persist: (selected) => (filters[key] = selected),
  });
  return { key, label, options, filter, matches };
}

/**
 * The footer's groups after the sex filter (which the popover already had): sign-in, entry, missing data and age.
 * Age membership is the factory's eligibility answer per participant, worked out once for the table's data.
 */
export function createParticipantFacets(table: any): FacetGroup[] {
  const signIn = chipGroup(table, {
    key: 'signIn',
    label: t('pages.participants.footer.signIn'),
    options: [
      { value: SIGNED_IN, label: t('pages.participants.footer.signedIn') },
      { value: NOT_SIGNED_IN, label: t('pages.participants.footer.notSignedIn') },
    ],
    matches: (rowData, value) => isSignedIn(rowData) === (value === SIGNED_IN),
  });

  const entry = chipGroup(table, {
    key: 'entry',
    label: t('pages.participants.footer.entry'),
    options: [
      { value: ENTERED, label: t('pages.participants.footer.entered') },
      { value: UNENTERED, label: t('pages.participants.footer.unentered') },
    ],
    matches: (rowData, value) => isEntered(rowData) === (value === ENTERED),
  });

  const gaps = chipGroup(table, {
    key: 'gaps',
    label: t('pages.participants.footer.gaps'),
    options: [
      { value: NO_RATING, label: t('pages.participants.footer.noRating') },
      { value: NO_DOB, label: t('pages.participants.footer.noDob') },
    ],
    matches: (rowData, value) => (value === NO_RATING ? !hasRating(rowData) : !hasDob(rowData)),
  });

  const { tournamentRecord } = tournamentEngine.getTournament?.() ?? {};
  const { buckets, byCategory, index } = ageIndexFor(tournamentRecord);
  const inBucket = (rowData: any, value: string) => !!index.of(rowData)?.has(value);
  const ageOptions: ChipOption[] = [
    ...buckets.map(({ value, label }) => ({ value, label })),
    ...(byCategory ? [{ value: NO_AGE_CATEGORY, label: t('pages.participants.footer.noAgeCategory') }] : []),
  ];
  const ages: FacetGroup = {
    ...chipGroup(table, {
      key: 'ages',
      label: t('pages.participants.footer.ages'),
      options: ageOptions,
      matches: inBucket,
    }),
    valuesOf: (rowData) => index.of(rowData),
    // a category chip stays even at zero, since it names an event; decades and "No age category" only when used
    hideWhenEmpty: new Set(byCategory ? [NO_AGE_CATEGORY] : ageOptions.map(({ value }) => value)),
  };

  return [signIn, entry, gaps, ages].filter((group) => group.options.length > 1 || group.key === 'gaps');
}

/**
 * The tournament's age buckets and their membership index, kept across renders.
 *
 * The participants tab re-renders on every visit and every event change, and membership depends only on the buckets
 * (their age rules and dates) and each participant's DOB. So the index is reused for as long as the tournament's
 * buckets are unchanged; a participant whose DOB changes is simply looked up under the new DOB.
 */
let cachedAgeIndex: { key: string; value: ReturnType<typeof buildAgeIndex> } | undefined;

function buildAgeIndex(tournamentRecord: any) {
  const tournament = tournamentRecord ?? {};
  const { buckets, byCategory } = ageBuckets(tournament.events ?? [], tournament);
  const expanded = expandAgeRules(buckets, tournament, (args) => eventGovernor.getCategoryAgeDetails(args));
  const index = createAgeIndex(
    expanded,
    // the governor function itself, not the engine method: the engine resolves `event` by id from the record, and a
    // bucket's age-only event is not in the record
    (participant, event) => eventGovernor.getParticipantEligibility({ participant, event, tournamentRecord }),
    { categories: byCategory },
  );
  return { buckets, byCategory, index };
}

function ageIndexFor(tournamentRecord: any) {
  const { buckets } = ageBuckets(tournamentRecord?.events ?? [], tournamentRecord ?? {});
  const key = JSON.stringify([tournamentRecord?.tournamentId, tournamentRecord?.startDate, buckets.map((b) => b.event)]);
  if (cachedAgeIndex?.key !== key) cachedAgeIndex = { key, value: buildAgeIndex(tournamentRecord) };
  return cachedAgeIndex.value;
}

/**
 * Every group's counts, in one pass over the rows.
 *
 * The selection when there is one (as the call sheet uses). Otherwise a group counts the rows that pass every filter
 * but its own, so turning one chip on never zeroes its siblings. Rather than re-filtering the rows once per group,
 * each row runs each filter once, stopping at a second failure: a row that fails nothing counts for every group, a
 * row that fails exactly one group's own filter counts for that group alone, and anything else for none.
 */
export function paintCounts(table: any, groups: FacetGroup[]): Map<FacetGroup, Record<string, number>> {
  const slots = groups.map((group) => ({
    group,
    tallies: Object.fromEntries(group.options.map(({ value }) => [value, 0])) as Record<string, number>,
  }));
  const counts = new Map(slots.map(({ group, tallies }) => [group, tallies]));
  const tally = (rowData: any, { group, tallies }: (typeof slots)[number]) => {
    if (group.valuesOf) {
      for (const value of group.valuesOf(rowData) ?? []) if (value in tallies) tallies[value] += 1;
      return;
    }
    for (const { value } of group.options) if (group.matches(rowData, value)) tallies[value] += 1;
  };

  const selected = table.getSelectedData?.() ?? [];
  if (selected.length) {
    for (const rowData of selected) for (const slot of slots) tally(rowData, slot);
    return counts;
  }

  const filters: ((rowData: any) => boolean)[] = (table.getFilters?.() ?? [])
    .map((filter: any) => filter.field)
    .filter((field: any) => typeof field === 'function');
  const ownerOf = new Map(slots.map((slot) => [slot.group.filter.rowFilter, slot]));
  for (const rowData of table.getData?.() ?? []) {
    let failed: ((rowData: any) => boolean) | undefined;
    let failures = 0;
    for (const filter of filters) {
      if (filter(rowData)) continue;
      failed = filter;
      if (++failures > 1) break;
    }
    if (failures === 0) for (const slot of slots) tally(rowData, slot);
    else if (failures === 1 && failed) {
      const owner = ownerOf.get(failed);
      if (owner) tally(rowData, owner);
    }
  }
  return counts;
}

/** For each group that hides empty chips: the values some row of the whole table has, filters or no filters. */
export function presentValues(table: any, groups: FacetGroup[]): Map<FacetGroup, Set<string>> {
  const present = new Map<FacetGroup, Set<string>>();
  const hiding = groups.filter((group) => group.hideWhenEmpty?.size);
  if (!hiding.length) return present;
  for (const group of hiding) present.set(group, new Set());
  for (const rowData of table.getData?.() ?? []) {
    for (const group of hiding) {
      const values = present.get(group) as Set<string>;
      if (group.valuesOf) {
        for (const value of group.valuesOf(rowData) ?? []) values.add(value);
        continue;
      }
      for (const value of group.hideWhenEmpty as Set<string>) {
        if (!values.has(value) && group.matches(rowData, value)) values.add(value);
      }
    }
  }
  return present;
}

export function mountParticipantsFooter({
  table,
  element,
  groups,
  onToggle,
}: {
  table: any;
  element: HTMLElement;
  groups: FacetGroup[];
  /** after a chip here changes a filter: the popover's badge */
  onToggle: () => void;
}): { refresh: () => void } {
  element.classList.add('tmx-status-strip', 'tmx-participants-footer');
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', t('pages.participants.footer.label'));

  const scope = document.createElement('span');
  scope.className = 'tmx-participants-footer-scope';

  const chips: { group: FacetGroup; value: string; button: HTMLButtonElement }[] = [];
  const groupElements = groups.map((group) => {
    const wrap = document.createElement('span');
    wrap.className = 'tmx-participants-footer-group';
    wrap.dataset.group = group.key;
    if (group.key === 'ages') {
      const label = document.createElement('span');
      label.className = 'tmx-participants-footer-label';
      label.textContent = group.label;
      wrap.appendChild(label);
    }
    for (const { value, label } of group.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-popover-chip tmx-status-strip-chip font-medium';
      button.dataset.value = value;
      const name = document.createElement('span');
      name.textContent = label;
      const count = document.createElement('span');
      count.className = 'tmx-status-strip-count';
      button.append(name, count);
      button.addEventListener('click', () => {
        group.filter.toggle(value);
        onToggle();
      });
      wrap.appendChild(button);
      chips.push({ group, value, button });
    }
    return wrap;
  });
  element.replaceChildren(scope, ...groupElements);

  let frame = 0;
  const paint = () => {
    frame = 0;
    // Tabulator warns when getFilters runs before the table is built
    if (table.initialized === false) return;
    const selected = table.getSelectedData?.().length ?? 0;
    scope.textContent = selected
      ? t('pages.participants.footer.scopeSelected', { count: selected })
      : t('pages.participants.footer.scopeShown', { count: table.getRows?.('active')?.length ?? 0 });
    scope.dataset.scope = selected ? 'selected' : 'shown';

    const counts = paintCounts(table, groups);
    const present = presentValues(table, groups);
    for (const { group, value, button } of chips) {
      const on = group.filter.isOn(value);
      // never hide a chip that is filtering, or the table would hide rows with no visible way back
      button.hidden =
        !!group.hideWhenEmpty?.has(value) &&
        !present.get(group)?.has(value) &&
        !(group.filter.isFiltered() && on);
      button.setAttribute('aria-pressed', String(on));
      button.dataset.on = String(on);
      (button.lastElementChild as HTMLElement).textContent = String(counts.get(group)?.[value] ?? 0);
    }
  };
  const refresh = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };

  // replaceData (every add route: imports, generated participants, manual adds, remote mutations) fires
  // dataProcessed; an in-place cell edit (the sign-in toggle's setValue) fires only dataChanged
  table.on?.('dataFiltered', refresh);
  table.on?.('dataProcessed', refresh);
  table.on?.('dataChanged', refresh);
  table.on?.('tableBuilt', refresh);
  table.on?.('rowSelectionChanged', refresh);
  refresh();
  return { refresh };
}
