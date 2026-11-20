/**
 * What the participants footer counts and filters by, as pure functions of a table row (`mapParticipant`).
 *
 * Age is never computed here. A bucket is a category, and whether a participant falls in it is the factory's
 * eligibility answer (`getParticipantEligibility`) for an event carrying only that category's age rule. So "U14 23"
 * in the footer is exactly the 23 the U14 event would accept on age: the same reference dates (age must hold at the
 * event's start AND end), the same birthYear convention, the same code expansion. A footer that computed age itself
 * would drift from the entry check the first time either changed.
 */

export const SIGNED_IN = 'signedIn';
export const NOT_SIGNED_IN = 'notSignedIn';
export const ENTERED = 'entered';
export const UNENTERED = 'unentered';
export const NO_RATING = 'noRating';
export const NO_DOB = 'noDob';
/** has a birth date, yet fits none of the tournament's age categories: an adult in a junior tournament */
export const NO_AGE_CATEGORY = 'noAgeCategory';

const person = (rowData: any) => rowData?.participant?.person;

export const isSignedIn = (rowData: any): boolean => !!rowData?.signedIn;
export const isEntered = (rowData: any): boolean => (rowData?.eventIds?.length ?? 0) > 0;
export const hasRating = (rowData: any): boolean => Object.keys(rowData?.ratings ?? {}).length > 0;
/** what the factory needs to decide age: a birth date, or a birth year for the calendar-year convention */
export const hasDob = (rowData: any): boolean =>
  !!person(rowData)?.birthDate || person(rowData)?.birthYear !== undefined;

export type AgeBucket = {
  value: string;
  label: string;
  /** an event carrying only the age rule, at the dates eligibility is judged on */
  event: { eventId: string; category: Record<string, any>; startDate?: string; endDate?: string };
};

const AGE_FIELDS = ['ageCategoryCode', 'ageMin', 'ageMax', 'ageMinDate', 'ageMaxDate'] as const;

const hasAgeRule = (category: any) => AGE_FIELDS.some((field) => category?.[field] !== undefined);

const ageLabel = (category: any): string => {
  if (category.ageCategoryCode) return category.ageCategoryCode;
  if (category.ageMin !== undefined && category.ageMax !== undefined) return `${category.ageMin}–${category.ageMax}`;
  if (category.ageMax !== undefined) return `≤${category.ageMax}`;
  if (category.ageMin !== undefined) return `${category.ageMin}+`;
  return category.categoryName ?? '?';
};

/** the youngest-first sort key: a category's upper age, else its lower, else last */
const ageOrder = (category: any): number => {
  const coded = /(\d{1,2})/.exec(category.ageCategoryCode ?? '');
  return category.ageMax ?? (coded ? Number(coded[1]) : undefined) ?? category.ageMin ?? Number.POSITIVE_INFINITY;
};

const DECADES: { value: string; label: string; ageMin?: number; ageMax?: number }[] = [
  { value: 'age:<10', label: '<10', ageMax: 9 },
  ...[10, 20, 30, 40, 50].map((min) => ({
    value: `age:${min}s`,
    label: `${min}–${min + 9}`,
    ageMin: min,
    ageMax: min + 9,
  })),
  { value: 'age:60+', label: '60+', ageMin: 60 },
];

/**
 * The age buckets for a tournament: one per distinct age category among its events, youngest first, each judged at
 * its own event's dates. A tournament with no age categories gets decades instead, judged on its first day, so an
 * open event still shows its age spread.
 */
export function ageBuckets(
  events: any[],
  tournament: { startDate?: string } = {},
): { buckets: AgeBucket[]; byCategory: boolean } {
  const byKey = new Map<string, AgeBucket & { order: number }>();
  for (const event of events ?? []) {
    const category = event?.category;
    if (!hasAgeRule(category)) continue;
    const ageRule = Object.fromEntries(
      AGE_FIELDS.filter((f) => category[f] !== undefined).map((f) => [f, category[f]]),
    );
    const label = ageLabel(category);
    if (byKey.has(label)) continue;
    byKey.set(label, {
      value: `age:${label}`,
      label,
      order: ageOrder(category),
      event: { eventId: `age:${label}`, category: ageRule, startDate: event.startDate, endDate: event.endDate },
    });
  }
  if (byKey.size) {
    const buckets = [...byKey.values()].sort((a, b) => a.order - b.order).map(({ order: _order, ...bucket }) => bucket);
    return { buckets, byCategory: true };
  }

  const day = tournament.startDate;
  const buckets = DECADES.map(({ value, label, ageMin, ageMax }) => ({
    value,
    label,
    event: { eventId: value, category: { ageMin, ageMax }, startDate: day, endDate: day },
  }));
  return { buckets, byCategory: false };
}

type Eligibility = { eligible?: boolean; indeterminate?: boolean; error?: any };

/**
 * Which buckets each participant falls in, keyed by participantId. A participant with no DOB is in none: the footer
 * counts them under NO_DOB instead. Categories overlap (a 12-year-old is eligible for U14 and U16), decades do not;
 * with categories, a participant who fits none is put in NO_AGE_CATEGORY so they are counted somewhere.
 */
export function ageMembership(
  rows: any[],
  buckets: AgeBucket[],
  eligibility: (participant: any, event: AgeBucket['event']) => Eligibility,
  { categories }: { categories: boolean },
): Map<string, Set<string>> {
  const membership = new Map<string, Set<string>>();
  for (const rowData of rows ?? []) {
    if (!hasDob(rowData)) continue;
    const values = new Set<string>();
    for (const bucket of buckets) {
      if (eligibility(rowData.participant, bucket.event)?.eligible) values.add(bucket.value);
    }
    if (categories && !values.size) values.add(NO_AGE_CATEGORY);
    membership.set(rowData.participantId, values);
  }
  return membership;
}
