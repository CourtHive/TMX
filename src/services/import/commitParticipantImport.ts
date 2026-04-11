/**
 * Mapping-driven committer for the participant import pipeline.
 *
 * Consumes the canonical `{ headers, rows }` shape produced by `parseDelimited`
 * (or by the Google Sheet normalizer) plus an explicit column-index → `TargetField`
 * mapping, builds TODS-shaped INDIVIDUAL participants, and dispatches them via
 * `mutationRequest`.
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
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { parseRatingCell } from './parseRatingCell';
import { dedupeByEmail } from './dedupeByEmail';
import { isFunction } from 'functions/typeOf';
import { hashCode } from 'functions/hashCode';
import { t } from 'i18n';

// constants and types
import { TargetField, TargetFieldKind } from './participantFieldModel';
import { ADD_EVENT_ENTRIES, ADD_PARTICIPANTS } from 'constants/mutationConstants';

export type ImportRowWarning = {
  rowIndex: number;
  field: TargetFieldKind;
  originalValue: string;
  reason: string;
};

export type CommitImportArgs = {
  headers: string[];
  rows: string[][];
  mapping: Record<number, TargetField>;
  additionalMethods?: any[];
  /** Default `entryStatus` applied to every event-entry column in this import. */
  entryStatus?: string;
  /** Default `entryStage` applied to every event-entry column in this import. */
  entryStage?: string;
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
  callback,
}: CommitImportArgs): void {
  void headers; // headers are reserved for future preview / debug surfaces

  const emailColumnIndex = findColumnByKind(mapping, 'email');
  const { mergedRows, mergeCount } = dedupeByEmail(rows, emailColumnIndex);

  const validNationalityCodes = new Set<string>(
    fixtures.countries.flatMap((f: any) => [f.ioc, f.iso]).filter(Boolean),
  );

  const existingParticipants = tournamentEngine.getParticipants().participants ?? [];
  const existingIds = new Set(existingParticipants.map(({ participantId }: any) => participantId));

  const warnings: ImportRowWarning[] = [];
  const participants: any[] = [];
  // rowIdx → participantId — populated for every row that yielded a valid
  // participant draft, including rows whose participantId already exists in
  // the tournament (so subsequent re-imports can add them to new events).
  const rowParticipantIds = new Map<number, string>();

  for (let r = 0; r < mergedRows.length; r++) {
    const built = buildParticipantFromRow(mergedRows[r], mapping, validNationalityCodes, r, warnings);
    if (!built) continue;
    rowParticipantIds.set(r, built.participantId);
    if (!existingIds.has(built.participantId)) {
      participants.push(tools.definedAttributes(built));
      existingIds.add(built.participantId);
    }
  }

  const eventEntries = buildEventEntryDispatch(mergedRows, mapping, rowParticipantIds);

  if (!participants.length && !eventEntries.length) {
    tmxToast({ message: t('toasts.noNewParticipants'), intent: 'is-primary' });
    if (isFunction(callback)) {
      callback({ success: false, addedCount: 0, warnings, mergeCount, eventEntries: [] });
    }
    return;
  }

  const methods: any[] = [];
  if (participants.length) methods.push({ method: ADD_PARTICIPANTS, params: { participants } });
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
      if (result?.success) {
        const message = buildSuccessMessage(addedCount, eventEntries);
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

function buildSuccessMessage(addedCount: number, eventEntries: EventEntryDispatch[]): string {
  const participantsMsg = t('toasts.addedParticipants', { count: addedCount });
  if (!eventEntries.length) return participantsMsg;
  const entriesTotal = eventEntries.reduce((sum, e) => sum + e.participantIds.length, 0);
  const eventsCount = eventEntries.length;
  const entriesMsg = t('toasts.addedEventEntries', { entries: entriesTotal, events: eventsCount });
  return `${participantsMsg}. ${entriesMsg}`;
}

function findColumnByKind(mapping: Record<number, TargetField>, kind: TargetFieldKind): number | undefined {
  for (const [key, field] of Object.entries(mapping)) {
    if (field?.kind === kind) return Number(key);
  }
  return undefined;
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

  participant.participantId =
    collected.participantId || `XXX-${hashCode(participant.participantName)}`;

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
