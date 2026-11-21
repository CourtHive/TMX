/**
 * What a tournament category means, in words, and how it relates to the events using it.
 *
 * The categories editor listed a category by its name and code only, so "U18" said nothing about who may
 * enter: that it means under 18 (17 at most), on which date, born on or after when. Age rules are expanded
 * by the factory's getCategoryAgeDetails at the tournament's start date, the same expansion eligibility
 * uses, so the editor states the rule entries are checked against.
 */

export interface TournamentCategory {
  categoryName?: string;
  type?: string;
  ageCategoryCode?: string;
  ageMin?: number;
  ageMax?: number;
  ratingType?: string;
  ratingMin?: number;
  ratingMax?: number;
  ballType?: string;
  notes?: string;
}

/** The category editor's section switch (courthive-components getCategoryModal). */
export type CategoryEditorType = 'AGE' | 'RATING' | 'BOTH';

type AgeDetails = { ageMin?: number; ageMax?: number; ageMinDate?: string; ageMaxDate?: string; error?: any };
type Translate = (key: string, values?: Record<string, any>) => string;

/** A placeholder code (a dash) carries no rule. */
export const cleanCode = (code?: string) => (code && !/^[-—–_]+$/.test(code) ? code : undefined);

/** Whether an event's category refers to this tournament category, by code or by name. */
export function categoryMatches(tournamentCategory: TournamentCategory, eventCategory: any): boolean {
  if (!eventCategory) return false;
  const code = cleanCode(tournamentCategory.ageCategoryCode);
  const name = tournamentCategory.categoryName;
  const eventCode = cleanCode(eventCategory.ageCategoryCode);
  const eventName = eventCategory.categoryName;
  return (
    (!!code && (eventCode === code || eventName === code)) || (!!name && (eventCode === name || eventName === name))
  );
}

/** The names of the events whose category refers to this one. */
export function referencingEvents(category: TournamentCategory, events: any[]): string[] {
  return events
    .filter((event) => categoryMatches(category, event?.category))
    .map((event) => event.eventName ?? event.eventId ?? '?');
}

/**
 * Event categories the tournament does not define, each with the events using it: what an event says it
 * is restricted to, with nothing in the tournament's own list to show for it.
 */
export function undefinedEventCategories(
  tournamentCategories: TournamentCategory[],
  events: any[],
): { category: TournamentCategory; usedBy: string[] }[] {
  const found = new Map<string, { category: TournamentCategory; usedBy: string[] }>();
  for (const event of events) {
    const category = event?.category;
    if (!category || tournamentCategories.some((defined) => categoryMatches(defined, category))) continue;
    const key = category.categoryName ?? cleanCode(category.ageCategoryCode) ?? category.ratingType ?? '?';
    const entry = found.get(key) ?? { category: { ...category }, usedBy: [] as string[] };
    entry.usedBy.push(event.eventName ?? event.eventId ?? '?');
    found.set(key, entry);
  }
  return [...found.values()];
}

/** The editor's section switch (AGE / RATING / BOTH), for a category it did not create itself. */
export function editorCategoryType(category: TournamentCategory): CategoryEditorType | undefined {
  if (category.type) return category.type as CategoryEditorType;
  const hasAge =
    !!cleanCode(category.ageCategoryCode) || category.ageMin !== undefined || category.ageMax !== undefined;
  const hasRating = !!category.ratingType;
  if (hasAge && hasRating) return 'BOTH';
  if (hasAge) return 'AGE';
  if (hasRating) return 'RATING';
  return undefined;
}

function ageFragment(
  category: TournamentCategory,
  consideredDate: string | undefined,
  getAgeDetails: (args: any) => AgeDetails,
  t: Translate,
): string | undefined {
  const hasAge =
    !!cleanCode(category.ageCategoryCode) || category.ageMin !== undefined || category.ageMax !== undefined;
  if (!hasAge || !consideredDate) return undefined;
  const details = getAgeDetails({ category, consideredDate });
  if (!details || details.error) return undefined;
  const { ageMin, ageMax, ageMinDate, ageMaxDate } = details;
  const date = consideredDate;
  if (ageMin !== undefined && ageMax !== undefined)
    return t('modals.editCategories.ageBetween', { min: ageMin, max: ageMax, date });
  if (ageMax !== undefined) return t('modals.editCategories.ageAtMost', { max: ageMax, date, born: ageMinDate });
  if (ageMin !== undefined) return t('modals.editCategories.ageAtLeast', { min: ageMin, date, born: ageMaxDate });
  return undefined;
}

function ratingFragment(category: TournamentCategory, t: Translate): string | undefined {
  const { ratingType, ratingMin, ratingMax } = category;
  if (!ratingType) return undefined;
  if (ratingMin !== undefined && ratingMax !== undefined)
    return t('modals.editCategories.ratingBetween', { ratingType, min: ratingMin, max: ratingMax });
  if (ratingMax !== undefined) return t('modals.editCategories.ratingAtMost', { ratingType, max: ratingMax });
  if (ratingMin !== undefined) return t('modals.editCategories.ratingAtLeast', { ratingType, min: ratingMin });
  return t('modals.editCategories.ratingAny', { ratingType });
}

/**
 * The rule a category applies, in words: its age limits on the tournament's start date (with the birth
 * date that decides them), its rating band, its ball. A category with none of these restricts nobody, and
 * says so, rather than looking like a rule that is not there.
 */
export function describeCategory(
  category: TournamentCategory,
  {
    consideredDate,
    getAgeDetails,
    t,
  }: { consideredDate?: string; getAgeDetails: (args: any) => AgeDetails; t: Translate },
): string[] {
  const fragments = [ageFragment(category, consideredDate, getAgeDetails, t), ratingFragment(category, t)].filter(
    Boolean,
  ) as string[];
  if (!fragments.length) fragments.push(t('modals.editCategories.noRule'));
  if (category.ballType) fragments.push(t('modals.editCategories.ball', { ballType: category.ballType }));
  return fragments;
}
