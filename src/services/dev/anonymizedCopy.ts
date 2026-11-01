/**
 * An anonymized deep copy of a tournament record, for sharing a record for support without personal data.
 *
 * The factory's `anonymizeTournamentRecord` rewrites the record it is given IN PLACE. It is therefore only
 * ever run here on a structured clone, and never through the engine or `mutationRequest`: the server loads
 * mocksGovernor too, so a mutation would rewrite the live record for everybody.
 *
 * The factory replaces persons, participant/event/draw/structure ids, venue names and addresses, team and
 * group names, presence attesters and non-internal extensions. It does not touch the fields listed below,
 * which are cleared on the copy because they name, locate or contact somebody, or link the copy back to
 * the original in another system.
 */
import { mocksGovernor } from 'tods-competition-factory';

const TOURNAMENT_FIELDS = [
  'linkedTournamentIds',
  'parentOrganisationId',
  'tournamentOtherIds',
  'tournamentSeriesId',
  'registrationProfile',
  'cancellationReason',
  'promotionalName',
  'onlineResources',
  'formalName',
  'notes',
];
const PARTICIPANT_FIELDS = ['participantOtherIds', 'participantOtherName', 'contacts', 'notes'];
const VENUE_FIELDS = ['parentOrganisationId', 'venueOtherIds', 'facilityId', 'contacts', 'notes'];
const EVENT_FIELDS = ['cancellationReason', 'tennisOfficialIds', 'eventOtherIds', 'notes'];
const COURT_FIELDS = ['onlineResources', 'longitude', 'latitude', 'notes'];
const MATCHUP_FIELDS = ['onlineResources', 'notes'];

export type AnonymizedCopyResult = { tournamentRecord?: any; error?: any };

export function anonymizedCopy(tournamentRecord: any): AnonymizedCopyResult {
  if (!tournamentRecord?.tournamentId) return { error: 'Missing tournamentRecord' };

  const copy = structuredClone(tournamentRecord);
  // The factory's signature types its optional params as required; undefined takes its defaults (a fresh
  // tournamentId, an "Anonymized: <date>" name, and parentOrganisation dropped).
  const result: any = mocksGovernor.anonymizeTournamentRecord({
    parentOrganisation: undefined,
    tournamentRecord: copy,
    tournamentName: undefined,
    tournamentId: undefined,
  });
  if (result?.error) return { error: result.error };

  stripIdentifyingFields(copy);
  return { tournamentRecord: copy };
}

function omit(element: any, fields: string[]): void {
  if (!element || typeof element !== 'object') return;
  for (const field of fields) Reflect.deleteProperty(element, field);
}

function stripIdentifyingFields(record: any): void {
  omit(record, TOURNAMENT_FIELDS);

  for (const participant of record.participants ?? []) {
    omit(participant, PARTICIPANT_FIELDS);
    // The factory replaces the person but leaves the participant-level pointer at the original personId.
    if (participant.person?.personId) {
      participant.personId = participant.person.personId;
    } else {
      Reflect.deleteProperty(participant, 'personId');
    }
  }

  stripVenues(record.venues);

  for (const event of record.events ?? []) {
    omit(event, EVENT_FIELDS);
    for (const drawDefinition of event.drawDefinitions ?? []) {
      omit(drawDefinition, ['notes']);
      for (const structure of drawDefinition.structures ?? []) {
        stripMatchUps(structure.matchUps);
        for (const child of structure.structures ?? []) stripMatchUps(child.matchUps);
      }
    }
  }

  stripMatchUps(record.matchUps);
}

function stripVenues(venues: any[] | undefined): void {
  for (const venue of venues ?? []) {
    omit(venue, VENUE_FIELDS);
    for (const court of venue.courts ?? []) omit(court, COURT_FIELDS);
    stripVenues(venue.subVenues);
  }
}

function stripMatchUps(matchUps: any[] | undefined): void {
  for (const matchUp of matchUps ?? []) {
    omit(matchUp, MATCHUP_FIELDS);
    stripMatchUps(matchUp.tieMatchUps);
  }
}
