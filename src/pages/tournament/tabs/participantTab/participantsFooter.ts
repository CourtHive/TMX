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
  ageMembership,
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
import { rowsPassingOthers } from 'components/tables/common/filters/rowsPassingOthers';
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
export function createParticipantFacets(table: any, data: any[]): FacetGroup[] {
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
  const { buckets, byCategory } = ageBuckets(tournamentRecord?.events ?? [], tournamentRecord ?? {});
  const membership = ageMembership(
    data,
    buckets,
    // the governor function itself, not the engine method: the engine resolves `event` by id from the record, and a
    // bucket's age-only event is not in the record
    (participant, event) => eventGovernor.getParticipantEligibility({ participant, event, tournamentRecord }),
    { categories: byCategory },
  );
  const inBucket = (rowData: any, value: string) => !!membership.get(rowData.participantId)?.has(value);
  // decades with nobody in them are noise; a category bucket stays even at zero, since it names an event
  const used = (value: string) => [...membership.values()].some((values) => values.has(value));
  const ageOptions: ChipOption[] = [
    ...buckets.filter(({ value }) => byCategory || used(value)).map(({ value, label }) => ({ value, label })),
    ...(byCategory && used(NO_AGE_CATEGORY)
      ? [{ value: NO_AGE_CATEGORY, label: t('pages.participants.footer.noAgeCategory') }]
      : []),
  ];
  const ages = chipGroup(table, {
    key: 'ages',
    label: t('pages.participants.footer.ages'),
    options: ageOptions,
    matches: inBucket,
  });

  return [signIn, entry, gaps, ages].filter((group) => group.options.length > 1 || group.key === 'gaps');
}

/** The rows a group counts: the selection when there is one (as the call sheet uses), else the rows other filters pass. */
export function countedRows(table: any, group: FacetGroup): any[] {
  const selected = table.getSelectedData?.() ?? [];
  return selected.length ? selected : rowsPassingOthers(table, group.filter.rowFilter);
}

export function facetCounts(rows: any[], group: FacetGroup): Record<string, number> {
  return Object.fromEntries(
    group.options.map(({ value }) => [value, rows.filter((rowData) => group.matches(rowData, value)).length]),
  );
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

    const counts = new Map(groups.map((group) => [group, facetCounts(countedRows(table, group), group)]));
    for (const { group, value, button } of chips) {
      const on = group.filter.isOn(value);
      button.setAttribute('aria-pressed', String(on));
      button.dataset.on = String(on);
      (button.lastElementChild as HTMLElement).textContent = String(counts.get(group)?.[value] ?? 0);
    }
  };
  const refresh = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };

  table.on?.('dataFiltered', refresh);
  table.on?.('dataProcessed', refresh);
  table.on?.('tableBuilt', refresh);
  table.on?.('rowSelectionChanged', refresh);
  refresh();
  return { refresh };
}
