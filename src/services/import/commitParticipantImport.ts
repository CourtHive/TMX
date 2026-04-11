/**
 * Mapping-driven committer for the participant import pipeline.
 *
 * Consumes the canonical `{ headers, rows }` shape produced by `parseDelimited`
 * (or by the Google Sheet normalizer) plus an explicit column-index → `TargetField`
 * mapping, builds TODS-shaped INDIVIDUAL participants, and dispatches them via
 * `mutationRequest`.
 *
 * The flow is **parse first, merge after** — every input row is parsed to a
 * participant draft independently, then drafts that share an email address are
 * merged per-field via `mergeParticipantDrafts`. This is critical for handling
 * registration forms where a person submits multiple times: a later submission
 * with placeholder text in some columns (e.g. "TBD" in a combined "City / State"
 * column) cannot erase fields that an earlier, fuller submission successfully
 * parsed. Merging raw cell strings before parsing — the previous approach —
 * would silently drop the parsed state in that scenario.
 *
 * The dispatched mutation request batches:
 *   1. `ADD_PARTICIPANTS` — creates the new participants in one call
 *   2. one `ADD_EVENT_ENTRIES` per mapped event-entry column — enters the
 *      participants whose corresponding row had a non-empty cell in that
 *      column. Fires with `enforceCategory: false, enforceGender: false`
 *      so a category/gender mismatch surfaces in the result context as a
 *      warning rather than aborting the whole import.
 *   3. any `additionalMethods` provided by the caller (the Google Sheet
 *      flow chains a `ADD_TOURNAMENT_EXTENSION` write to record the sheet ID)
 *
 * Validation is best-effort (Decision E from the import-enhancement plan): when a
 * field can't be parsed, the field is dropped, the row still imports, and the
 * caller receives a `warnings` array describing what was skipped and why.
 */

import { fixtures, tools, tournamentEngine } from 'tods-competition-factory';
import { mergeParticipantDrafts } from './mergeParticipantDrafts';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { parseRatingCell } from './parseRatingCell';
import { isFunction } from 'functions/typeOf';
import { hashCode } from 'functions/hashCode';
import { t } from 'i18n';

// constants and types
import { TargetField, TargetFieldKind } from './participantFieldModel';
import { ADD_EVENT_ENTRIES, ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';

export type ImportRowWarning = {
  rowIndex: number;
  field: TargetFieldKind;
  originalValue: string;
  reason: string;
};

/** Identifier-like target kinds the user can pick for grouping duplicate rows. */
export type DedupeKey = 'email' | 'phone' | 'mobilePhone' | 'tennisId' | 'ustaId' | 'itfId' | 'participantId';

export type CommitImportArgs = {
  headers: string[];
  rows: string[][];
  mapping: Record<number, TargetField>;
  additionalMethods?: any[];
  /** Default `entryStatus` applied to every event-entry column in this import. */
  entryStatus?: string;
  /** Default `entryStage` applied to every event-entry column in this import. */
  entryStage?: string;
  /**
   * Identifier kind used to group rows that represent the same person.
   * `null` disables grouping entirely — every parsed row becomes its own participant.
   * Defaults to `'email'` to preserve historical behavior.
   */
  dedupeKey?: DedupeKey | null;
  /**
   * When true, drafts whose `participantId` already exists in the tournament
   * are dispatched as `MODIFY_PARTICIPANT` instead of being skipped, so the
   * existing record is updated per-field with new data. Default `false` —
   * the safe behavior is to leave existing participants alone on re-import.
   */
  updateExisting?: boolean;
  callback?: (result: any) => void;
};

export type EventEntryDispatch = {
  eventId: string;
  participantIds: string[];
};

export type CommitImportResult = {
  success: boolean;
  addedCount: number;
  warnings: ImportRowWarning[];
  mergeCount: number;
  eventEntries: EventEntryDispatch[];
  raw?: any;
};

const FEMALE_PREFIXES = new Set(['F', 'W', 'G']);
const MALE_PREFIXES = new Set(['M', 'B']);
const VALID_SEX_VALUES = new Set(['MALE', 'FEMALE']);
const TRUTHY_WHEELCHAIR_VALUES = new Set(['true', 'yes', 'y', '1', 'wheelchair']);

const REASON_UNKNOWN_COUNTRY = 'unknown country code';

export function commitParticipantImport({
  headers,
  rows,
  mapping,
  additionalMethods = [],
  entryStatus = 'DIRECT_ACCEPTANCE',
  entryStage = 'MAIN',
  dedupeKey = 'email',
  updateExisting = false,
  callback,
}: CommitImportArgs): void {
  void headers; // headers are reserved for future preview / debug surfaces

  const validNationalityCodes = new Set<string>(
    fixtures.countries.flatMap((f: any) => [f.ioc, f.iso]).filter(Boolean),
  );

  const existingParticipants = tournamentEngine.getParticipants().participants ?? [];
  const existingIds = new Set<string>(existingParticipants.map(({ participantId }: any) => participantId));

  const warnings: ImportRowWarning[] = [];

  const { participants, updates, mergeCount, rowParticipantIds } = parseGroupAndResolve({
    rows,
    mapping,
    validNationalityCodes,
    dedupeKey,
    updateExisting,
    existingIds,
    warnings,
  });

  const eventEntries = buildEventEntryDispatch(rows, mapping, rowParticipantIds);

  if (!participants.length && !updates.length && !eventEntries.length) {
    tmxToast({ message: t('toasts.noNewParticipants'), intent: 'is-primary' });
    if (isFunction(callback)) {
      callback({ success: false, addedCount: 0, warnings, mergeCount, eventEntries: [] });
    }
    return;
  }

  const methods: any[] = [];
  if (participants.length) methods.push({ method: ADD_PARTICIPANTS, params: { participants } });
  for (const participant of updates) {
    methods.push({ method: MODIFY_PARTICIPANT, params: { participant } });
  }
  for (const dispatch of eventEntries) {
    methods.push({
      method: ADD_EVENT_ENTRIES,
      params: {
        eventId: dispatch.eventId,
        participantIds: dispatch.participantIds,
        entryStatus,
        entryStage,
        enforceCategory: false,
        enforceGender: false,
      },
    });
  }
  methods.push(...additionalMethods);

  mutationRequest({
    methods,
    callback: (result: any) => {
      const addedCount = result?.results?.[0]?.addedCount ?? participants.length;
      const updatedCount = updates.length;
      if (result?.success) {
        const message = buildSuccessMessage(addedCount, updatedCount, eventEntries);
        tmxToast({ message, intent: 'is-success' });
      } else {
        console.error('participant import failed', result);
      }
      if (isFunction(callback)) {
        const finalResult: CommitImportResult = {
          success: !!result?.success,
          addedCount,
          warnings,
          mergeCount,
          eventEntries,
          raw: result,
        };
        callback(finalResult);
      }
    },
  });
}

function buildEventEntryDispatch(
  rows: string[][],
  mapping: Record<number, TargetField>,
  rowParticipantIds: Map<number, string>,
): EventEntryDispatch[] {
  const grouped = new Map<string, string[]>();
  for (const [key, field] of Object.entries(mapping)) {
    if (field?.kind !== 'eventEntry' || !field.eventId) continue;
    const colIdx = Number(key);
    for (let r = 0; r < rows.length; r++) {
      const cell = rows[r]?.[colIdx];
      if (cell == null || String(cell).trim() === '') continue;
      const participantId = rowParticipantIds.get(r);
      if (!participantId) continue;
      const list = grouped.get(field.eventId) ?? [];
      if (!list.includes(participantId)) list.push(participantId);
      grouped.set(field.eventId, list);
    }
  }
  return Array.from(grouped.entries()).map(([eventId, participantIds]) => ({ eventId, participantIds }));
}

function buildSuccessMessage(
  addedCount: number,
  updatedCount: number,
  eventEntries: EventEntryDispatch[],
): string {
  const parts: string[] = [];
  if (addedCount > 0) parts.push(t('toasts.addedParticipants', { count: addedCount }));
  if (updatedCount > 0) parts.push(t('toasts.updatedParticipants', { count: updatedCount }));
  if (eventEntries.length) {
    const entriesTotal = eventEntries.reduce((sum, e) => sum + e.participantIds.length, 0);
    parts.push(t('toasts.addedEventEntries', { entries: entriesTotal, events: eventEntries.length }));
  }
  return parts.join('. ');
}

type ResolvedDrafts = {
  participants: any[];
  updates: any[];
  mergeCount: number;
  rowParticipantIds: Map<number, string>;
};

/**
 * Parse → group → merge → resolve-against-existing pipeline. Extracted from
 * `commitParticipantImport` to keep that function under the cognitive-complexity
 * threshold; this helper owns every per-row decision and returns ready-to-dispatch
 * lists for the mutation request builder.
 */
function parseGroupAndResolve({
  rows,
  mapping,
  validNationalityCodes,
  dedupeKey,
  updateExisting,
  existingIds,
  warnings,
}: {
  rows: string[][];
  mapping: Record<number, TargetField>;
  validNationalityCodes: Set<string>;
  dedupeKey: DedupeKey | null;
  updateExisting: boolean;
  existingIds: Set<string>;
  warnings: ImportRowWarning[];
}): ResolvedDrafts {
  // Phase 1 — parse every input row into a participant draft independently.
  const rowDrafts: Array<{ rowIdx: number; draft: any; groupKey: string }> = [];
  for (let r = 0; r < rows.length; r++) {
    const built = buildParticipantFromRow(rows[r], mapping, validNationalityCodes, r, warnings);
    if (!built) continue;
    rowDrafts.push({ rowIdx: r, draft: built, groupKey: computeDedupeGroupKey(built, dedupeKey, r) });
  }

  // Phase 2 — group drafts by the chosen identifier (or unique sentinel when
  // dedupeKey is null) and merge each group per-field.
  const groups = new Map<string, typeof rowDrafts>();
  const groupOrder: string[] = [];
  for (const item of rowDrafts) {
    if (!groups.has(item.groupKey)) {
      groups.set(item.groupKey, []);
      groupOrder.push(item.groupKey);
    }
    groups.get(item.groupKey)!.push(item);
  }

  const participants: any[] = [];
  const updates: any[] = [];
  const rowParticipantIds = new Map<number, string>();
  let mergeCount = 0;

  for (const key of groupOrder) {
    const group = groups.get(key)!;
    const mergedDraft = group.length === 1 ? group[0].draft : mergeParticipantDrafts(group.map((g) => g.draft));
    if (!mergedDraft) continue;
    if (group.length > 1) mergeCount += group.length - 1;

    // ParticipantId resolution:
    //   - Single-row groups (or no-merge mode) keep the per-row ID computed in
    //     `buildParticipantFromRow`, which already honors any column the user
    //     mapped to `participantId` (hashed via `XXX-${hashCode(...)}`).
    //   - Multi-row merged groups need a single deterministic ID; recompute it
    //     from the merged participantName so it stays stable across re-imports
    //     even though the merger drops the per-draft IDs.
    const finalParticipantId =
      group.length === 1 && group[0].draft.participantId
        ? group[0].draft.participantId
        : `XXX-${hashCode(mergedDraft.participantName)}`;
    mergedDraft.participantId = finalParticipantId;

    for (const item of group) rowParticipantIds.set(item.rowIdx, finalParticipantId);

    routeDraft({ mergedDraft, finalParticipantId, existingIds, updateExisting, participants, updates });
  }

  return { participants, updates, mergeCount, rowParticipantIds };
}

function routeDraft({
  mergedDraft,
  finalParticipantId,
  existingIds,
  updateExisting,
  participants,
  updates,
}: {
  mergedDraft: any;
  finalParticipantId: string;
  existingIds: Set<string>;
  updateExisting: boolean;
  participants: any[];
  updates: any[];
}): void {
  if (existingIds.has(finalParticipantId)) {
    if (updateExisting) updates.push(tools.definedAttributes(mergedDraft));
    return;
  }
  participants.push(tools.definedAttributes(mergedDraft));
  existingIds.add(finalParticipantId);
}

/**
 * Resolves the duplicate-detection group key for a parsed draft.
 *
 * Returns a normalized (lowercased + trimmed) string for the chosen identifier
 * field, or a per-row unique sentinel when grouping is disabled (`dedupeKey: null`)
 * or the draft has no value for the chosen field. The sentinel ensures rows
 * without an identifier always end up in their own group instead of being merged
 * together under a shared empty key.
 */
function computeDedupeGroupKey(draft: any, dedupeKey: DedupeKey | null, rowIdx: number): string {
  if (dedupeKey == null) return `__no_merge_${rowIdx}__`;
  const raw = readDedupeValue(draft, dedupeKey);
  if (!raw) return `__no_${dedupeKey}_${rowIdx}__`;
  return String(raw).trim().toLowerCase();
}

function readDedupeValue(draft: any, dedupeKey: DedupeKey): string | undefined {
  switch (dedupeKey) {
    case 'email':
      return draft.person?.contacts?.[0]?.emailAddress;
    case 'phone':
      return draft.person?.contacts?.[0]?.telephone;
    case 'mobilePhone':
      return draft.person?.contacts?.[0]?.mobileTelephone;
    case 'tennisId':
      return draft.person?.tennisId;
    case 'ustaId':
      return findOtherId(draft, 'USTA');
    case 'itfId':
      return findOtherId(draft, 'ITF');
    case 'participantId':
      return draft.participantId;
    default:
      return undefined;
  }
}

function findOtherId(draft: any, organisationName: string): string | undefined {
  const ids = draft.person?.personOtherIds;
  if (!Array.isArray(ids)) return undefined;
  const match = ids.find((id: any) => id?.uniqueOrganisationName === organisationName);
  return match?.personId;
}

type ParsedRow = {
  collected: Partial<Record<TargetFieldKind, string>>;
  ratingItems: Array<{ scaleName: string; value: number }>;
};

function buildParticipantFromRow(
  row: string[],
  mapping: Record<number, TargetField>,
  validNationalityCodes: Set<string>,
  rowIndex: number,
  warnings: ImportRowWarning[],
): any | undefined {
  const { collected, ratingItems } = parseRowCells(row, mapping, rowIndex, warnings);

  const participant: any = {
    participantType: 'INDIVIDUAL',
    participantRole: 'COMPETITOR',
    person: {},
  };

  if (!applyNames(participant, collected)) return undefined;

  applyDemographics(participant, collected, validNationalityCodes, rowIndex, warnings);
  applyAddress(participant, collected, validNationalityCodes, rowIndex, warnings);
  applyContact(participant, collected);
  applyIdentifiers(participant, collected);
  applyMisc(participant, collected, validNationalityCodes, rowIndex, warnings);
  applyRatings(participant, ratingItems);

  // ParticipantId source: when a column is mapped to `participantId`, hash that
  // column's value (so e.g. "Submission ID" or any unique-per-row column gives
  // each row a distinct, deterministic ID). Otherwise fall back to hashing the
  // participant's display name. The post-merge step in commitParticipantImport
  // recomputes the ID from the merged identity, so this per-row ID is provisional.
  const idSource = collected.participantId || participant.participantName;
  participant.participantId = `XXX-${hashCode(idSource)}`;

  return participant;
}

function parseRowCells(
  row: string[],
  mapping: Record<number, TargetField>,
  rowIndex: number,
  warnings: ImportRowWarning[],
): ParsedRow {
  const collected: Partial<Record<TargetFieldKind, string>> = {};
  const ratingItems: Array<{ scaleName: string; value: number }> = [];

  for (const [key, field] of Object.entries(mapping)) {
    if (!field || field.kind === 'ignore' || field.kind === 'eventEntry') continue;
    const cell = row[Number(key)];
    if (cell == null) continue;
    const raw = String(cell).trim();
    if (!raw) continue;

    if (field.kind === 'rating') {
      const parsed = parseRatingCell(raw, { defaultScaleName: field.ratingScaleName });
      if (parsed) ratingItems.push(parsed);
      else warnings.push({ rowIndex, field: 'rating', originalValue: raw, reason: 'unrecognized rating format' });
      continue;
    }

    if (field.kind === 'split') {
      applySplit(collected, field, raw);
      continue;
    }

    collected[field.kind] = raw;
  }

  return { collected, ratingItems };
}

function applyNames(participant: any, collected: Partial<Record<TargetFieldKind, string>>): boolean {
  const { firstName, lastName, fullName, otherName } = collected;
  const hasFullName = !!(firstName && lastName);
  if (!hasFullName && !fullName && !otherName) return false;

  if (firstName) participant.person.standardGivenName = firstName;
  if (lastName) participant.person.standardFamilyName = lastName;
  if (otherName) participant.participantOtherName = otherName;
  participant.participantName = hasFullName ? `${firstName} ${lastName}` : (fullName || otherName);
  return true;
}

function applyDemographics(
  participant: any,
  collected: Partial<Record<TargetFieldKind, string>>,
  validNationalityCodes: Set<string>,
  rowIndex: number,
  warnings: ImportRowWarning[],
): void {
  if (collected.sex) {
    const normalized = normalizeSex(collected.sex);
    if (normalized) participant.person.sex = normalized;
    else warnings.push({ rowIndex, field: 'sex', originalValue: collected.sex, reason: 'unrecognized value' });
  }

  if (collected.birthDate) {
    if (tools.dateTime.dateValidation.test(collected.birthDate)) {
      const date = tools.dateTime.extractDate(collected.birthDate);
      if (date) participant.person.birthDate = date;
      else
        warnings.push({
          rowIndex,
          field: 'birthDate',
          originalValue: collected.birthDate,
          reason: 'unparseable date',
        });
    } else {
      warnings.push({
        rowIndex,
        field: 'birthDate',
        originalValue: collected.birthDate,
        reason: 'invalid date format',
      });
    }
  }

  if (collected.nationalityCode) {
    const normalized = collected.nationalityCode.toUpperCase();
    if (validNationalityCodes.has(normalized)) {
      participant.person.nationalityCode = normalized;
    } else {
      warnings.push({
        rowIndex,
        field: 'nationalityCode',
        originalValue: collected.nationalityCode,
        reason: REASON_UNKNOWN_COUNTRY,
      });
    }
  }
}

function applyAddress(
  participant: any,
  collected: Partial<Record<TargetFieldKind, string>>,
  validNationalityCodes: Set<string>,
  rowIndex: number,
  warnings: ImportRowWarning[],
): void {
  const address: any = {};
  if (collected.city) address.city = collected.city;
  if (collected.state) address.state = collected.state;
  if (collected.postalCode) address.postalCode = collected.postalCode;
  if (collected.addressLine1) address.addressLine1 = collected.addressLine1;
  if (collected.countryCode) {
    const normalized = collected.countryCode.toUpperCase();
    if (validNationalityCodes.has(normalized)) {
      address.countryCode = normalized;
    } else {
      warnings.push({
        rowIndex,
        field: 'countryCode',
        originalValue: collected.countryCode,
        reason: REASON_UNKNOWN_COUNTRY,
      });
    }
  }
  if (Object.keys(address).length) participant.person.addresses = [address];
}

function applyContact(participant: any, collected: Partial<Record<TargetFieldKind, string>>): void {
  const contact: any = {};
  if (collected.email) contact.emailAddress = collected.email;
  if (collected.phone) contact.telephone = collected.phone;
  if (collected.mobilePhone) contact.mobileTelephone = collected.mobilePhone;
  if (Object.keys(contact).length) participant.person.contacts = [contact];
}

function applyIdentifiers(participant: any, collected: Partial<Record<TargetFieldKind, string>>): void {
  if (collected.tennisId) participant.person.tennisId = collected.tennisId;
  if (collected.ustaId) {
    if (!participant.person.personOtherIds) participant.person.personOtherIds = [];
    participant.person.personOtherIds.push({ uniqueOrganisationName: 'USTA', personId: collected.ustaId });
  }
  if (collected.itfId) {
    if (!participant.person.personOtherIds) participant.person.personOtherIds = [];
    participant.person.personOtherIds.push({ uniqueOrganisationName: 'ITF', personId: collected.itfId });
  }
  if (collected.utrProfile) applyUtrProfile(participant, collected.utrProfile);
}

function applyMisc(
  participant: any,
  collected: Partial<Record<TargetFieldKind, string>>,
  validNationalityCodes: Set<string>,
  rowIndex: number,
  warnings: ImportRowWarning[],
): void {
  if (collected.wheelchair && TRUTHY_WHEELCHAIR_VALUES.has(collected.wheelchair.toLowerCase())) {
    participant.person.wheelchair = true;
  }
  if (collected.notes) participant.notes = collected.notes;
  if (collected.representing) {
    const normalized = collected.representing.toUpperCase();
    if (validNationalityCodes.has(normalized)) {
      participant.representing = normalized;
    } else {
      warnings.push({
        rowIndex,
        field: 'representing',
        originalValue: collected.representing,
        reason: REASON_UNKNOWN_COUNTRY,
      });
    }
  }
}

function applyRatings(participant: any, ratingItems: Array<{ scaleName: string; value: number }>): void {
  if (!ratingItems.length) return;
  participant.timeItems = ratingItems.map(({ scaleName, value }) => ({
    itemType: `SCALE.RATING.SINGLES.${scaleName}`,
    itemValue: { [`${scaleName.toLowerCase()}Rating`]: value },
  }));
}

function applySplit(collected: Partial<Record<TargetFieldKind, string>>, field: TargetField, raw: string): void {
  if (!field.split) return;
  const pieces = raw.split(field.split.delimiter);
  field.split.pieces.forEach((pieceField, i) => {
    if (!pieceField || pieceField.kind === 'ignore' || pieceField.kind === 'split') return;
    const value = (pieces[i] ?? '').trim();
    if (value) collected[pieceField.kind] = value;
  });
}

function normalizeSex(sex: string): string | undefined {
  const upper = sex.toUpperCase();
  if (VALID_SEX_VALUES.has(upper)) return upper;
  if (FEMALE_PREFIXES.has(sex[0]?.toUpperCase())) return 'FEMALE';
  if (MALE_PREFIXES.has(sex[0]?.toUpperCase())) return 'MALE';
  return undefined;
}

function applyUtrProfile(participant: any, utrProfile: string): void {
  if (!participant.onlineResources) participant.onlineResources = [];
  const identifier = utrProfile.split('profiles/').at(-1);
  if (!identifier) return;

  if (!participant.person.personOtherIds) participant.person.personOtherIds = [];
  participant.person.personOtherIds.push({ uniqueOrganisationName: 'UTR', personId: identifier });
  if (utrProfile.startsWith('http')) {
    participant.onlineResources.push({
      resourceSubType: 'PROFILE',
      identifier: utrProfile,
      name: 'UTR Profile',
      resource: 'URL',
    });
  }
}
