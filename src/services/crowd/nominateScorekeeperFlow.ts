/**
 * nominateScorekeeperFlow — proactive scorer nomination (crowd-scoring Phase D).
 *
 * The TD nominates a HiveID-linked tournament participant as a matchUp's
 * scorekeeper AHEAD of any crowd session. When that person later crowd-scores,
 * `classifyScorer` resolves them to `scorekeeper` (via matchUp.schedule.scorekeeper)
 * and — if the session is email-verified — the crowd-trackers modal offers a
 * one-click Accept. Storage is the factory `assignMatchUpScorekeeper` mutation
 * through the normal mutationRequest path (a tournament-record mutation).
 */

import { selectParticipant } from 'components/modals/selectParticipant';
import { hiveIdLinkedParticipants, isApprovedScorekeeper } from 'services/crowd/classifyScorer';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { positionActionConstants, tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import { ASSIGN_MATCHUP_SCOREKEEPER, MODIFY_PARTICIPANT, REMOVE_MATCHUP_SCOREKEEPER } from 'constants/mutationConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;
const SCOREKEEPER_ROLE = 'SCOREKEEPER';

/** Open the HiveID-linked participant picker; on selection, nominate them as the
 *  matchUp's scorekeeper. */
export function openNominateScorekeeper(args: {
  matchUpId: string;
  drawId: string;
  callback?: (result: any) => void;
}): void {
  const { matchUpId, drawId, callback } = args;

  const { participants = [] } =
    tournamentEngine.getParticipants({ participantFilters: { participantTypes: ['INDIVIDUAL'] } }) ?? {};
  const candidates = hiveIdLinkedParticipants(participants);

  if (!candidates.length) {
    tmxToast({ intent: 'is-warning', message: t('crowd.toast.noScorekeeperCandidates') });
    return;
  }

  const onSelection = (result: any) => {
    const participantId = result?.participantId ?? result?.selected?.participantId;
    if (!participantId) return;
    mutationRequest({
      methods: [{ method: ASSIGN_MATCHUP_SCOREKEEPER, params: { matchUpId, drawId, participantId } }],
      callback,
    });
  };

  selectParticipant({
    selectionLimit: 1,
    selectOnEnter: true,
    onSelection,
    action: { type: ASSIGN_PARTICIPANT, participantsAvailable: candidates },
    title: t('crowd.nominateScorekeeper'),
  });
}

/** Clear a matchUp's nominated scorekeeper. */
export function removeScorekeeperNomination(args: {
  matchUpId: string;
  drawId: string;
  callback?: (result: any) => void;
}): void {
  const { matchUpId, drawId, callback } = args;
  mutationRequest({
    methods: [{ method: REMOVE_MATCHUP_SCOREKEEPER, params: { matchUpId, drawId } }],
    callback,
  });
}

/**
 * Toggle a participant's tournament-wide SCOREKEEPER role (approved to score any
 * matchUp) via its `participantRoleResponsibilities`. Additive — preserves other
 * responsibilities.
 */
export function toggleParticipantScorekeeper(args: { participant: any; callback?: (result: any) => void }): void {
  const { participant, callback } = args;
  if (!participant?.participantId) return;
  const current: string[] = participant?.participantRoleResponsibilities ?? [];
  const participantRoleResponsibilities = isApprovedScorekeeper(participant)
    ? current.filter((role) => role !== SCOREKEEPER_ROLE)
    : [...current, SCOREKEEPER_ROLE];
  mutationRequest({
    methods: [
      {
        method: MODIFY_PARTICIPANT,
        params: { participant: { participantId: participant.participantId, participantRoleResponsibilities } },
      },
    ],
    callback,
  });
}
