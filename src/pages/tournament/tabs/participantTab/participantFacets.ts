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
type AgeDetails = { ageMin?: number; ageMax?: number; error?: any };

/**
 * Buckets whose age rule is a bare code (`U14`), with the code's range filled in once.
 *
 * The factory expands a code with no `ageMin`/`ageMax` on EVERY eligibility call (`validateParticipantAge` runs
 * `getCategoryAgeDetails` with the event's start date as `consideredDate`). Doing that same expansion here, once per
 * bucket and with that same date, sends every later call down the path that skips it, with the same range: the
 * verdicts are unchanged and the per-call parse is gone. A code the factory cannot expand is left as it was.
 */
export function expandAgeRules(
  buckets: AgeBucket[],
  tournament: { startDate?: string },
  getDetails: (args: { category: any; consideredDate?: string }) => AgeDetails,
): AgeBucket[] {
  return buckets.map((bucket) => {
    const { category } = bucket.event;
    if (!category.ageCategoryCode || category.ageMin || category.ageMax) return bucket;
    const consideredDate = bucket.event.startDate ?? tournament.startDate;
    const details = getDetails({ category, consideredDate });
    if (details?.error || (!details?.ageMin && !details?.ageMax)) return bucket;
    const range = Object.fromEntries(
      (['ageMin', 'ageMax'] as const).filter((key) => details[key] !== undefined).map((key) => [key, details[key]]),
    );
    return { ...bucket, event: { ...bucket.event, category: { ...category, ...range } } };
  });
}

/** What an age verdict depends on: the birth date, or else the birth year (the factory's own precedence). */
const dobKey = (rowData: any): string | undefined => {
  const p = person(rowData);
  if (p?.birthDate) return `d:${p.birthDate}`;
  return p?.birthYear === undefined ? undefined : `y:${p.birthYear}`;
};

export type AgeIndex = {
  /** the buckets a row falls in; undefined for a row with no DOB, which the footer counts as NO_DOB instead */
  of: (rowData: any) => Set<string> | undefined;
  /** factory calls made so far: what the memo saves is visible to a test */
  calls: () => number;
};

/**
 * Bucket membership, worked out the first time a row is asked about and remembered by DOB.
 *
 * An age-only category's verdict reads nothing of the participant but `birthDate` / `birthYear`
 * (`validateParticipantAge`), so everyone sharing a DOB shares the answer: the factory is asked once per distinct DOB,
 * not once per participant. Lazy, so a participant added after the footer was built is answered when first counted.
 * Categories overlap (a 12-year-old is eligible for U14 and U16), decades do not; with categories, a participant who
 * fits none is put in NO_AGE_CATEGORY so they are counted somewhere.
 */
export function createAgeIndex(
  buckets: AgeBucket[],
  eligibility: (participant: any, event: AgeBucket['event']) => Eligibility,
  { categories }: { categories: boolean },
): AgeIndex {
  const byDob = new Map<string, Set<string>>();
  // a paint asks about every row on every repaint: remember each row object's answer, so a repaint is one lookup
  // per row with no key to build. replaceData brings new row objects, which are looked up afresh by DOB
  const byRow = new WeakMap<object, Set<string> | null>();
  let calls = 0;
  const of = (rowData: any) => {
    const known = rowData && typeof rowData === 'object' ? byRow.get(rowData) : undefined;
    if (known !== undefined) return known ?? undefined;
    const values = lookup(rowData);
    if (rowData && typeof rowData === 'object') byRow.set(rowData, values ?? null);
    return values;
  };
  const lookup = (rowData: any) => {
    const key = dobKey(rowData);
    if (key === undefined) return undefined;
    let values = byDob.get(key);
    if (!values) {
      values = new Set<string>();
      for (const bucket of buckets) {
        calls += 1;
        if (eligibility(rowData.participant, bucket.event)?.eligible) values.add(bucket.value);
      }
      if (categories && !values.size) values.add(NO_AGE_CATEGORY);
      byDob.set(key, values);
    }
    return values;
  };
  return { of, calls: () => calls };
}

/** Which buckets each participant falls in, keyed by participantId; participants with no DOB are left out. */
export function ageMembership(
  rows: any[],
  buckets: AgeBucket[],
  eligibility: (participant: any, event: AgeBucket['event']) => Eligibility,
  { categories }: { categories: boolean },
): Map<string, Set<string>> {
  const index = createAgeIndex(buckets, eligibility, { categories });
  const membership = new Map<string, Set<string>>();
  for (const rowData of rows ?? []) {
    const values = index.of(rowData);
    if (values) membership.set(rowData.participantId, values);
  }
  return membership;
}
