/**
 * The composition a structure is drawn with when nothing chose one: neither the draw, its event, nor a configured
 * default (CA 2026-11-08). One answer for the draw view and the Display settings modal, which used to differ —
 * the view drew National while the modal opened on Australian.
 *
 *   configured default (`displayConfig`)  wins, unchanged
 *   TEAM                                  Basic, as before
 *   anything else                         Scoreboard: schedule and connectors on; flags on only when a participant
 *                                         in the draw has a country code, since a flag column with no flags is noise;
 *                                         and the LIVE pill, which the preset leaves off
 */
import { copyComposition } from 'services/compositions/resolveCompositionByName';
import { tournamentEngine } from 'services/factory/engine';
import { eventConstants } from 'tods-competition-factory';
import { displayConfig } from 'config/displayConfig';
import { compositions } from 'courthive-components';

const { TEAM } = eventConstants;

export const DEFAULT_DRAW_COMPOSITION = 'Scoreboard';

type Participant = {
  person?: { nationalityCode?: string; iso2NationalityCode?: string };
  individualParticipants?: Participant[];
};

// the flag is drawn from `iso2NationalityCode`, which the factory derives from `nationalityCode`
const hasCountryCode = (participant: Participant) =>
  !!(participant.person?.nationalityCode || participant.person?.iso2NationalityCode);

/** Whether any participant, or any member of a pair or team, has a country code to draw a flag from. */
export function participantsHaveCountryCodes(participants: Participant[]): boolean {
  return participants.some(
    (participant) => hasCountryCode(participant) || !!participant.individualParticipants?.some(hasCountryCode),
  );
}

function drawHasCountryCodes({ drawId, eventId }: { drawId?: string; eventId?: string }): boolean {
  const { event, drawDefinition } = tournamentEngine.getEvent({ drawId, eventId }) ?? {};
  const entries = drawDefinition?.entries ?? event?.entries ?? [];
  const participantIds = entries.map((entry: any) => entry.participantId).filter(Boolean);
  if (!participantIds.length) return false;
  const { participants = [] } = tournamentEngine.getParticipants({
    participantFilters: { participantIds },
    withIndividualParticipants: true,
  });
  return participantsHaveCountryCodes(participants);
}

/** A fresh copy every call: callers change its configuration in place. */
export function defaultDrawComposition({
  eventType,
  drawId,
  eventId,
}: {
  eventType?: string;
  drawId?: string;
  eventId?: string;
}): { compositionName: string; composition: any } {
  const configured = displayConfig.get().composition;
  if (configured) return { compositionName: configured.compositionName, composition: copyComposition(configured) };

  if (eventType === TEAM) return { compositionName: 'Basic', composition: copyComposition(compositions.Basic) };

  const composition = copyComposition(compositions[DEFAULT_DRAW_COMPOSITION]);
  composition.configuration = {
    ...composition.configuration,
    flags: drawHasCountryCodes({ drawId, eventId }),
    // Scoreboard leaves the pill off; a director's draw keeps it, so a match in play reads LIVE (journeys 180, 181)
    liveStatusPill: true,
  };
  return { compositionName: DEFAULT_DRAW_COMPOSITION, composition };
}
