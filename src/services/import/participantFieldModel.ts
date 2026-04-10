/**
 * Schema for the participant import mapping pipeline.
 *
 * `TargetFieldKind` enumerates every internal target a source column can be mapped to.
 * `SYNONYM_RULES` provides the auto-mapper with header text → kind hints, including
 *   partial-match support via the `*` prefix (e.g. `*birth` matches "Birth Date" or
 *   "Date of Birth").
 * `RATING_SYNONYMS` is a separate table mapping header text to a rating scale name
 *   so the auto-mapper can pre-populate `{ kind: 'rating', ratingScaleName }`.
 * `TARGET_FIELD_GROUPS` is the source of truth for the grouped dropdown rendered in
 *   the import view (Milestone 3).
 *
 * The kinds and their semantics deliberately mirror the TODS Person / Participant /
 * Contact / Address types from `factory/src/types/tournamentTypes.ts`, but the model
 * is kept here in TMX so the import UI vocabulary can evolve independently of the
 * factory schema.
 */

export type TargetFieldKind =
  // Person — basic
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'otherName'
  | 'sex'
  | 'birthDate'
  | 'nationalityCode'
  | 'wheelchair'
  // Address (single address — populates person.addresses[0])
  | 'city'
  | 'state'
  | 'countryCode'
  | 'postalCode'
  | 'addressLine1'
  // Contact (populates person.contacts[0])
  | 'email'
  | 'phone'
  | 'mobilePhone'
  // Identifiers
  | 'tennisId'
  | 'ustaId'
  | 'itfId'
  | 'utrProfile'
  | 'participantId'
  // Ratings (one TimeItem per rating column; ratingScaleName carries the scale)
  | 'rating'
  // Event entries (committer issues addEventEntries per mapped column; eventId required)
  | 'eventEntry'
  // Participant
  | 'participantName'
  | 'representing'
  | 'notes'
  // Composite / utility
  | 'split'
  | 'ignore';

export type TargetField = {
  kind: TargetFieldKind;
  /** For `kind === 'rating'` — which scale (UTR, WTN, NTRP, …). */
  ratingScaleName?: string;
  /** For `kind === 'eventEntry'` — which event the column maps to. */
  eventId?: string;
  /** For `kind === 'split'` — delimiter and per-piece destinations. */
  split?: {
    delimiter: string;
    pieces: TargetField[];
  };
};

type SynonymRule = {
  kind: TargetFieldKind;
  /** Synonyms are matched against normalized headers (lowercase, no whitespace/underscores/hyphens).
   *  A leading `*` marks a partial match (substring of the normalized header). */
  synonyms: string[];
};

export const SYNONYM_RULES: SynonymRule[] = [
  // --- Person, basic ---
  { kind: 'firstName', synonyms: ['firstname', 'first', 'givenname', 'standardgivenname'] },
  { kind: 'lastName', synonyms: ['lastname', 'last', 'familyname', 'standardfamilyname', 'surname'] },
  { kind: 'fullName', synonyms: ['fullname', 'name', 'playername'] },
  { kind: 'otherName', synonyms: ['nickname', 'othername', 'displayname', 'preferredname'] },
  { kind: 'sex', synonyms: ['sex', 'gender'] },
  { kind: 'birthDate', synonyms: ['birthdate', 'dateofbirth', 'dob', '*birth'] },
  { kind: 'nationalityCode', synonyms: ['ioc', 'country', 'nationality', 'nationalitycode'] },
  { kind: 'wheelchair', synonyms: ['wheelchair'] },
  // --- Address ---
  { kind: 'city', synonyms: ['city', 'town'] },
  { kind: 'state', synonyms: ['state', 'province', 'region'] },
  { kind: 'countryCode', synonyms: ['countrycode'] },
  { kind: 'postalCode', synonyms: ['postalcode', 'zip', 'zipcode', 'postcode'] },
  { kind: 'addressLine1', synonyms: ['address', 'addressline1', 'streetaddress'] },
  // --- Contact ---
  { kind: 'email', synonyms: ['email', 'emailaddress', 'e-mail'] },
  { kind: 'phone', synonyms: ['phone', 'phonenumber', 'telephone'] },
  { kind: 'mobilePhone', synonyms: ['mobile', 'mobilephone', 'cell', 'cellphone'] },
  // --- Identifiers ---
  { kind: 'tennisId', synonyms: ['tennisid'] },
  { kind: 'ustaId', synonyms: ['ustaid', 'ustanumber'] },
  { kind: 'itfId', synonyms: ['itfid', 'itfnumber', 'ipin'] },
  { kind: 'utrProfile', synonyms: ['utrprofile', 'utrlink', 'utrurl'] },
  { kind: 'participantId', synonyms: ['id', 'participantid'] },
  // --- Participant ---
  { kind: 'representing', synonyms: ['representing', 'represents'] },
  { kind: 'notes', synonyms: ['notes', 'note', 'comments', 'comment'] },
];

/** Header → rating scale mapping. The auto-mapper turns matches into
 *  `{ kind: 'rating', ratingScaleName }`. */
export const RATING_SYNONYMS: Array<{ scaleName: string; synonyms: string[] }> = [
  { scaleName: 'UTR', synonyms: ['utr', 'utrrating', 'universaltennisrating'] },
  { scaleName: 'WTN', synonyms: ['wtn', 'worldtennisnumber'] },
  { scaleName: 'NTRP', synonyms: ['ntrp', 'ustarating'] },
  { scaleName: 'DUPR', synonyms: ['dupr', 'duprrating'] },
  { scaleName: 'ELO', synonyms: ['elo', 'elorating'] },
  { scaleName: 'USATT', synonyms: ['usatt', 'usattrating'] },
  { scaleName: 'ITTF', synonyms: ['ittf', 'ittfrating'] },
  { scaleName: 'TRN', synonyms: ['trn'] },
  { scaleName: 'UTR_P', synonyms: ['utrp'] },
  { scaleName: 'UTPR', synonyms: ['utpr'] },
  { scaleName: 'BWF', synonyms: ['bwf'] },
];

/** Grouped target fields for the import view's per-column dropdown. */
export const TARGET_FIELD_GROUPS: Array<{ label: string; fields: TargetFieldKind[] }> = [
  {
    label: 'Person',
    fields: ['firstName', 'lastName', 'fullName', 'otherName', 'sex', 'birthDate', 'nationalityCode', 'wheelchair'],
  },
  { label: 'Address', fields: ['city', 'state', 'countryCode', 'postalCode', 'addressLine1'] },
  { label: 'Contact', fields: ['email', 'phone', 'mobilePhone'] },
  { label: 'Identifiers', fields: ['tennisId', 'ustaId', 'itfId', 'utrProfile', 'participantId'] },
  { label: 'Rating', fields: ['rating'] },
  { label: 'Event entry', fields: ['eventEntry'] },
  { label: 'Participant', fields: ['participantName', 'representing', 'notes'] },
  { label: 'Other', fields: ['split', 'ignore'] },
];

/** Normalize a header or synonym string for comparison.
 *  Lowercases and strips whitespace, underscores, hyphens, and slashes. */
export function normalizeHeader(s: string): string {
  return (s || '').toLowerCase().replace(/[\s_\-/]/g, '');
}
