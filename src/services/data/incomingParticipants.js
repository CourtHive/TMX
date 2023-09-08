import { tournamentEngine, utilities, fixtures } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { hashCode } from 'functions/hashCode';

import { ADD_PARTICIPANTS, ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';
import { REGISTRATION } from 'constants/tmxConstants';

const modelParticipant = {
  participantName: ['full name', 'name'],
  participantId: ['id', 'participantid'],
  person: {
    address: { city: ['city'], state: ['state'] },
    standardFamilyName: ['last', 'last name', 'last_name'],
    standardGivenName: ['first', 'First Name', 'first_name'],
    nationalityCode: ['ioc', 'country', 'nationality'],
    birthDate: ['*birth'],
    sex: ['gender', 'sex']
  }
};

export function incomingParticipants({ data, sheetId, callback }) {
  const existingParticipants = tournamentEngine.getParticipants().participants;
  const participantIds = existingParticipants.map(({ participantId }) => participantId);

  const validNationalityCodes = fixtures.countries
    .map((f) => [f.ioc, f.iso])
    .flat()
    .filter(Boolean);

  const participants = [];

  const getAttributes = (attrs) =>
    attrs.map((attr) => [attr.toLowerCase(), attr.toLowerCase().split(' ').join('')]).flat();
  const findAttr =
    (row) =>
    (attrs = []) => {
      const keys = Object.keys(row);
      const attributes = getAttributes(attrs);
      const match = attributes.reduce((p, c) => row[c] || p, undefined);
      const partial =
        !match &&
        keys.filter((key) => attributes.find((a) => a.startsWith('*') && key.toLowerCase().includes(a.slice(1))));
      return match || row[partial];
    };

  for (const row of data || []) {
    const loweredRow = Object.assign({}, ...Object.keys(row).map((key) => ({ [key.toLowerCase()]: row[key] })));
    const rowParser = findAttr(loweredRow);

    // TODO: allow for specifying participantType
    const participant = { participantType: 'INDIVIDUAL', participantRole: 'COMPETITOR', person: {} };
    participant.participantName = rowParser(modelParticipant.participantName);

    const standardFamilyName = rowParser(modelParticipant.person.standardFamilyName);
    const standardGivenName = rowParser(modelParticipant.person.standardGivenName);
    if (standardFamilyName && standardGivenName) {
      participant.person.standardFamilyName = standardFamilyName;
      participant.person.standardGivenName = standardGivenName;
      participant.participantName = `${standardGivenName} ${standardFamilyName}`;
    } else {
      continue;
    }

    const state = rowParser(modelParticipant.person.address.state);
    const city = rowParser(modelParticipant.person.address.city);
    if (city || state) participant.person.addresses = [{ city, state }];

    const nationalityCode = rowParser(modelParticipant.person.nationalityCode);
    if (nationalityCode && validNationalityCodes.includes(nationalityCode.toUpperCase())) {
      participant.person.nationalityCode = nationalityCode;
    }

    const birthDate = rowParser(modelParticipant.person.birthDate);
    if (birthDate?.startsWith('Date')) {
      const dateExtractor = new RegExp(/Date\((\d+),(\d+),(\d+)\)/);
      const match = birthDate.match(dateExtractor);
      if (match) {
        const [year, mo, day] = match.slice(1, 4);
        participant.person.birthDate = `${year}-${mo + 1}-${day}`;
      }
    }

    const sex = rowParser(modelParticipant.person.sex);
    if (sex) {
      const upperSex = sex.toUpperCase();
      if (['MALE', 'FEMALE'].includes(upperSex)) {
        participant.person.sex = upperSex;
      } else if (['F', 'W', 'G'].includes(sex[0])) {
        participant.person.sex = 'FEMALE';
      } else if (['M', 'B'].includes(sex[0])) {
        participant.person.sex = 'MALE';
      }
    }

    const utr = rowParser(['utr']);
    if (utr) {
      if (!participant.timeItems) participant.timeItems = [];
      const timeItem = {
        itemType: 'SCALE.RATING.SINGLES.UTR',
        itemValue: { utrRating: utr }
      };
      participant.timeItems.push(timeItem);
    }
    const wtn = rowParser(['wtn']);
    if (wtn) {
      if (!participant.timeItems) participant.timeItems = [];
      const timeItem = {
        itemType: 'SCALE.RATING.SINGLES.WTN',
        itemValue: { wtnRating: wtn }
      };
      participant.timeItems.push(timeItem);
    }

    participant.participantId =
      rowParser(modelParticipant.participantId) || `XXX-${hashCode(participant.participantName)}`;

    const participantExists = participantIds.includes(participant.participantId);
    if (!participantExists) {
      participants.push(utilities.definedAttributes(participant));
    }

    /*
    const phone = findAttr(row, ['phone', 'Phone Number', "Player's Phone Number", 'Handphone Number']);
    const containsPhone = attrContains(row, ['phone', 'Phone Number', "Player's Phone Number", 'Handphone Number']);
    const phoneNumber = phone || containsPhone;
    if (phoneNumber) console.log({ phoneNumber });
    */
  }

  if (participants.length) {
    const methods = [
      {
        method: ADD_PARTICIPANTS,
        params: { participants }
      },
      {
        method: ADD_TOURNAMENT_EXTENSION,
        params: {
          extension: { name: REGISTRATION, value: sheetId }
        }
      }
    ];

    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: `Added ${result.results[0].addedCount} participant(s)`, intent: 'is-success' });
        isFunction(callback) && callback();
      } else {
        console.log(result);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  } else {
    tmxToast({ message: 'No new participants found', intent: 'is-primary' });
  }

  isFunction(callback) && callback();
}
