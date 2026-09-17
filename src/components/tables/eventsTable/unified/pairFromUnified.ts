/**
 * Create a pair from two selected ungrouped participants in the unified table.
 * Standalone version that doesn't depend on context.tables[UNGROUPED].
 *
 * `drawId` is load-bearing. Without it the factory's paramsMiddleware never resolves a
 * `drawDefinition`, so `addEventEntries` skips `addDrawEntries` and the new PAIR lands only in
 * `event.entries` — while the same call's `removeUngroupedParticipantIdsHelper` evicts the two
 * individuals from *every* drawDefinition. Pairing two individuals who were draw entries therefore
 * used to shrink the draw field by two with nothing replacing them. Passing `drawId` puts the PAIR
 * where the individuals were.
 *
 * `segment` is TMX's Accepted/Qualifying/Alternate vocabulary, not a raw entryStatus — it resolves
 * to an (entryStatus, entryStage) pair through the same mapping `modifyEntriesStatus` uses.
 */
import { entryStatusConstants, tools } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { buildPairMethods } from './rotatingPartners';
import { segmentToEntry } from './pairSegment';

const { ALTERNATE } = entryStatusConstants;

type PairFromUnifiedParams = {
  event: any;
  participantIds: [string, string];
  callback: (result: any) => void;
  segment?: string;
  drawId?: string;
  entryStage?: string;
  /** a member is already in another entered PAIR — see `buildPairMethods` */
  overlaps?: boolean;
};

export function pairFromUnified({
  event,
  participantIds,
  callback,
  segment = ALTERNATE,
  entryStage,
  overlaps = false,
  drawId,
}: PairFromUnifiedParams): void {
  const { eventId, gender } = event;
  const participantId = tools.UUID();

  const resolved = segmentToEntry(segment);

  const methods = buildPairMethods({
    entryStatus: resolved.entryStatus,
    // An explicit entryStage wins: when replacing individuals already in a draw, the pair must
    // inherit the stage they occupied rather than be forced back to MAIN.
    entryStage: entryStage ?? resolved.entryStage,
    pairParticipantId: participantId,
    participantIds,
    overlaps,
    eventId,
    drawId,
  });

  const postMutation = (result: any) => {
    if (result.success) {
      callback(result);
    } else if (result.error?.code === 'ERR_INVALID_PARTICIPANT_IDS') {
      const message = gender === 'MIXED' ? 'Genders must be mixed' : 'Invalid pairing';
      tmxToast({ intent: 'is-danger', message });
    } else {
      tmxToast({ intent: 'is-danger', message: result.error?.message ?? 'Error creating pair' });
      console.log({ methods, result });
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
