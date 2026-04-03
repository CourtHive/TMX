/**
 * Processes incoming participant data from external sources.
 * Maps participant attributes and adds them to the tournament.
 */
import { tournamentEngine, tools, fixtures } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { hashCode } from 'functions/hashCode';
import { t } from 'i18n';

import { ADD_PARTICIPANTS, ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';
import { REGISTRATION } from 'constants/tmxConstants';

const modelParticipant = {
  participantName: ['full name', 'name'],
  participantId: ['id', 'participantid'],
  person: {
    standardFamilyName: ['last', 'last name', 'last_name'],
    standardGivenName: ['first', 'First Name', 'first_name'],
    nationalityCode: ['ioc', 'country', 'nationality'],
    address: { city: ['city'], state: ['state'] },
    birthDate: ['*birth'],
    sex: ['gender', 'sex'],
  },
};

const FEMALE_PREFIXES = new Set(['F', 'W', 'G']);
const MALE_PREFIXES = new Set(['M', 'B']);
const VALID_SEX_VALUES = new Set(['MALE', 'FEMALE']);

function normalizeSex(sex: string): string | undefined {
  const upperSex = sex.toUpperCase();
  if (VALID_SEX_VALUES.has(upperSex)) return upperSex;
  if (FEMALE_PREFIXES.has(sex[0])) return 'FEMALE';
  if (MALE_PREFIXES.has(sex[0])) return 'MALE';
  return undefined;
}

function applyUtrProfile(participant: any, utrProfile: string): void {
  if (!participant.onlineResources) participant.onlineResources = [];
  const identifier = utrProfile.split('profiles/')?.reverse()[0];
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

function applyScaleTimeItem(
  participant: any,
  rowParser: (attrs: string[]) => any,
  field: string,
  itemType: string,
  accessor: string,
): void {
  const value = rowParser([field]);
  if (!value) return;
  if (!participant.timeItems) participant.timeItems = [];
  participant.timeItems.push({
    itemType,
    itemValue: { [accessor]: value },
  });
}

function parseParticipantRow(
  row: any,
  findAttr: (row: any) => (attrs?: string[]) => any,
  validNationalityCodes: Set<string>,
): any | undefined {
  const loweredRow = Object.assign({}, ...Object.keys(row).map((key) => ({ [key.toLowerCase()]: row[key] })));
  const rowParser = findAttr(loweredRow);

  const participant: any = { participantType: 'INDIVIDUAL', participantRole: 'COMPETITOR', person: {} };
  const rawParticipantName = rowParser(modelParticipant.participantName);
  participant.participantName =
    typeof rawParticipantName === 'string' ? rawParticipantName.trim() : rawParticipantName;

  const tennisId = rowParser(['tennis id', 'tennisid']);
  if (tennisId) participant.person.tennisId = tennisId;

  const rawFamilyName = rowParser(modelParticipant.person.standardFamilyName);
  const rawGivenName = rowParser(modelParticipant.person.standardGivenName);
  const standardFamilyName = typeof rawFamilyName === 'string' ? rawFamilyName.trim() : rawFamilyName;
  const standardGivenName = typeof rawGivenName === 'string' ? rawGivenName.trim() : rawGivenName;
  if (!standardFamilyName || !standardGivenName) return undefined;

  participant.person.standardFamilyName = standardFamilyName;
  participant.person.standardGivenName = standardGivenName;
  participant.participantName = `${standardGivenName} ${standardFamilyName}`;

  const state = rowParser(modelParticipant.person.address.state);
  const city = rowParser(modelParticipant.person.address.city);
  if (city || state) participant.person.addresses = [{ city, state }];

  const nationalityCode = rowParser(modelParticipant.person.nationalityCode);
  if (nationalityCode && validNationalityCodes.has(nationalityCode.toUpperCase())) {
    participant.person.nationalityCode = nationalityCode;
  }

  const birthDate = rowParser(modelParticipant.person.birthDate);
  if (tools.dateTime.dateValidation.test(birthDate)) {
    const date = tools.dateTime.extractDate(birthDate);
    if (date) participant.person.birthDate = date;
  }

  const sex = rowParser(modelParticipant.person.sex);
  if (sex) {
    const normalizedSex = normalizeSex(sex);
    if (normalizedSex) participant.person.sex = normalizedSex;
  }

  const utrProfile = rowParser(['utr profile']);
  if (utrProfile) {
    applyUtrProfile(participant, utrProfile);
  }

  applyScaleTimeItem(participant, rowParser, 'utr', 'SCALE.RATING.SINGLES.UTR', 'utrRating');
  applyScaleTimeItem(participant, rowParser, 'wtn', 'SCALE.RATING.SINGLES.WTN', 'wtnRating');

  participant.participantId =
    rowParser(modelParticipant.participantId) || `XXX-${hashCode(participant.participantName)}`;

  return participant;
}

export function incomingParticipants({
  data,
  sheetId,
  callback,
}: {
  data: any[];
  sheetId: string;
  callback?: () => void;
}): void {
  const existingParticipants = tournamentEngine.getParticipants().participants;
  const participantIds = new Set(existingParticipants.map(({ participantId }: any) => participantId));

  const validNationalityCodes = new Set(fixtures.countries.flatMap((f: any) => [f.ioc, f.iso]).filter(Boolean));

  const participants: any[] = [];

  const getAttributes = (attrs: string[]) =>
    attrs.flatMap((attr) => [attr.toLowerCase(), attr.toLowerCase().split(' ').join('')]);
  const findAttr =
    (row: any) =>
    (attrs: string[] = []) => {
      const keys = Object.keys(row);
      const attributes = getAttributes(attrs);
      const match = attributes.reduce((p, c) => row[c] || p, undefined);
      const partial =
        !match &&
        keys.filter((key) => attributes.find((a) => a.startsWith('*') && key.toLowerCase().includes(a.slice(1))));
      return match ?? row[partial[0]];
    };

  for (const row of data || []) {
    const parsed = parseParticipantRow(row, findAttr, validNationalityCodes);
    if (!parsed) continue;
    if (!participantIds.has(parsed.participantId)) {
      participants.push(tools.definedAttributes(parsed));
    }
  }

  if (participants.length) {
    const methods = [
      {
        method: ADD_PARTICIPANTS,
        params: { participants },
      },
      {
        method: ADD_TOURNAMENT_EXTENSION,
        params: {
          extension: { name: REGISTRATION, value: sheetId },
        },
      },
    ];

    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({
          message: t('toasts.addedParticipants', { count: result.results[0].addedCount }),
          intent: 'is-success',
        });
        isFunction(callback) && callback();
      } else {
        console.log(result);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  } else {
    tmxToast({ message: t('toasts.noNewParticipants'), intent: 'is-primary' });
  }

  isFunction(callback) && callback();
}
