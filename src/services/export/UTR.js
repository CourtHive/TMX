// import { normalizeName, normalizeDiacritics } from 'normalize-text';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { downloadText } from './download';

import { DRAW_NAME, DRAW_TYPE, UTR } from 'constants/tmxConstants';

/*
export const replaceDiacritics = (text) => normalizeDiacritics(text);

export const nameNormalization = (name) => {
  return normalizeName(name || '', ['de', 'la', 'da']);
};
*/
export function downloadUTRmatches() {
  const zeroPad = (number) => (number.toString()[1] ? number : '0' + number);
  const dateFormatUTR = (date) => {
    if (!date) return '';
    const utrDate = new Date(date);
    return [zeroPad(utrDate.getMonth() + 1), zeroPad(utrDate.getDate()), utrDate.getFullYear()].join('/');
  };

  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const { completedMatchUps } = tournamentEngine.tournamentMatchUps({
    context: {
      tournamentSanctionBody: tournamentInfo.parentOrganisation?.organisationName,
      tournamentStartDate: dateFormatUTR(tournamentInfo.startDate),
      tournamentEndDate: dateFormatUTR(tournamentInfo.endDate),
      tournamentEventSource: 'CourtHive',
      tournamentEventCategory: 'Junior',
      tournamentEventType: 'Tournament',
      ...tournamentInfo,
      idType: UTR,
    },
  });

  // modify matchUps to include winners and losers
  const matchUpsWinnersLosers = completedMatchUps.map((matchUp) => {
    const { winningSide, sides, score } = matchUp;
    const winners = sides.find(({ sideNumber }) => sideNumber === winningSide);
    const losers = sides.find(({ sideNumber }) => sideNumber !== winningSide);
    const winnerScore = score[`scoreStringSide${winningSide}`];

    return {
      winnerScore,
      ...matchUp,
      winners,
      losers,
    };
  });

  const genderInitial = (value) => value?.slice(0, 1);

  const config = {
    columnAccessors: [''],
    columnTransform: {
      Date: ['tournamentEndDate'],
      'Winner 1 Name': [
        'winners.participant.individualParticipants.0.participantName',
        'winners.participant.participantName',
      ],
      'Winner 1 Third Party ID': [
        'winners.participant.individualParticipants.0.participantId',
        'winners.participant.participantId',
      ],
      'Winner 1 UTR ID': ['winners.participant.individualParticipants.0.person.personOtherIds.0.idValue'],
      'Winner 1 Gender': ['winners.participant.individualParticipants.0.person.sex', 'winners.participant.person.sex'],
      'Winner 1 DOB': [
        'winners.participant.individualParticipants.0.person.birthDate',
        'winners.participant.person.birthDate',
      ],
      'Winner 1 City': [
        'winners.participant.individualParticipants.0.addresses.0.city',
        'winners.participant.addresses.0.city',
      ],
      'Winner 1 State': [
        'winners.participant.individualParticipants.0.addresses.0.state',
        'winners.participant.addresses.0.state',
      ],
      'Winner 1 Country': [
        'winners.participant.individualParticipants.0.addresses.0.nationalityCode',
        'winners.participant.addresses.0nationalityCode',
      ],
      'Winner 1 College': ['winners.participant.individualParticipants.0.college'],
      'Winner 2 Name': ['winner.participant.individualParticipants.1.participantName'],
      'Winner 2 Third Party ID': ['winners.participant.individualParticipants.1.participantId'],
      'Winner 2 UTR ID': ['winners.participant.individualParticipants.1.person.personOtherIds.0.idValue'],
      'Winner 2 Gender': ['winners.participant.individualParticipants.1.person.sex'],
      'Winner 2 DOB': ['winners.participant.individualParticipants.1.person.birthDate'],
      'Winner 2 City': ['winners.participant.individualParticipants.1.addresses.0.city'],
      'Winner 2 State': ['winners.participant.individualParticipants.1.addresses.0.state'],
      'Winner 2 Country': ['winners.participant.individualParticipants.1.addresses.0.nationalityCode'],
      'Winner 2 College': ['winners.participant.individualParticipants.1.college'],
      'Loser 1 Name': [
        'losers.participant.individualParticipants.0.participantName',
        'losers.participant.participantName',
      ],
      'Loser 1 Third Party ID': [
        'losers.participant.individualParticipants.0.participantId',
        'losers.participant.participantId',
      ],
      'Loser 1 UTR ID': ['losers.participant.individualParticipants.1.person.personOtherIds.0.idValue'],
      'Loser 1 Gender': ['losers.participant.individualParticipants.0.person.sex', 'winners.participant.person.sex'],
      'Loser 1 DOB': [
        'losers.participant.individualParticipants.0.person.birthDate',
        'losers.participant.person.birthDate',
      ],
      'Loser 1 City': [
        'losers.participant.individualParticipants.0.addresses.0.city',
        'losers.participant.addresses.0.city',
      ],
      'Loser 1 State': [
        'losers.participant.individualParticipants.0.addresses.0.state',
        'losers.participant.addresses.0.state',
      ],
      'Loser 1 Country': [
        'losers.participant.individualParticipants.0.addresses.0.nationalityCode',
        'losers.participant.addresses.0nationalityCode',
      ],
      'Loser 1 College': ['losers.participant.individualParticipants.0.college'],
      'Loser 2 Name': ['losers.participant.individualParticipants.1.participantName'],
      'Loser 2 Third Party ID': ['losers.participant.individualParticipants.1.participantId'],
      'Loser 2 UTR ID': ['losers.participant.individualParticipants.1.person.personOtherIds.1.idValue'],
      'Loser 2 Gender': ['losers.participant.individualParticipants.1.person.sex'],
      'Loser 2 DOB': ['losers.participant.individualParticipants.1.person.birthDate'],
      'Loser 2 City': ['losers.participant.individualParticipants.1.addresses.0.city'],
      'Loser 2 State': ['losers.participant.individualParticipants.1.addresses.0.state'],
      'Loser 2 Country': ['losers.participant.individualParticipants.1.addresses.0.nationalityCode'],
      'Loser 2 College': ['losers.participant.individualParticipants.1.college'],
      Score: ['winnerScore'],
      'Id Type': ['idType'],
      'Draw Name': [DRAW_NAME],
      'Draw Gender': ['gender'],
      'Draw Team Type': ['eventType'],
      'Draw Bracket Type': [''],
      'Draw Bracket Value': [''],
      'Draw Type': [DRAW_TYPE],
      'Tournament Name': ['tournamentName'],
      'Tournament URL': [''],
      'Tournament Start Date': ['tournamentStartDate'],
      'Tournament End Date': ['tournamentEndDate'],
      'Tournament City': [''],
      'Tournament State': [''],
      'Tournament Country': [''],
      'Tournament Country Code': [''],
      'Tournament Host': [''],
      'Tournament Location Type': [''],
      'Tournament Surface': [''],
      'Tournament Event Type': ['tournamentEventType'],
      'Tournament Event Category': ['tournamentEventCategory'],
      'Tournament Import Source': ['tournamentEventSource'],
      'Tournament Sanction Body': ['tournamentSanctionBody'],
      'Match ID': ['matchUpId'],
      'Tournament Event Grade': [''],
    },
    functionMap: {
      'Winner 1 Gender': genderInitial,
      'Winner 2 Gender': genderInitial,
      'Loser 1 Gender': genderInitial,
      'Loser 2 Gender': genderInitial,
    },
  };

  const csv = tools.JSON2CSV(matchUpsWinnersLosers, config);
  downloadText(`UTR-${tournamentInfo.tournamentId}.csv`, csv);
}
