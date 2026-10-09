/**
 * Writes one draw's `structureDetails` through PUBLISH_EVENT.
 *
 * Every structure-level change (publish, embargo, roundLimit, scheduledRounds) goes through here so the
 * full map is always sent and the draw's own publishingDetail (including its embargo) is carried along.
 * `publishEvent` replaces the stored structureDetails with what it is given and resets publishingDetail
 * when none is passed, so a partial write hides every structure it omits and drops the draw embargo.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { publishingGovernor } from 'tods-competition-factory';
import { renderPublishingTab } from './renderPublishingTab';
import { tournamentEngine } from 'services/factory/engine';
import { mergeStructureDetails } from './publishingData';

// constants
import { PUBLISH_EVENT } from 'constants/mutationConstants';

export const PUBLISH_EVENT_DATA_PARAMS = {
  participantsProfile: { withScaleValues: true },
  pressureRating: true,
  refreshResults: true,
};

type UpdateStructure = (structureId: string, detail: Record<string, any>) => Record<string, any>;

export function getStructurePublishContext(drawId: string) {
  const { event } = tournamentEngine.getEvent({ drawId });
  if (!event) return undefined;
  const pubState = publishingGovernor.getPublishState({ event })?.publishState;
  const drawDetail = pubState?.status?.drawDetails?.[drawId] || {};
  const drawDef = event.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  const structureIds: string[] = (drawDef?.structures || []).map((s: any) => s.structureId);
  return { event, drawDetail, drawDef, structureIds };
}

export function publishStructureDetails({
  callback = renderPublishingTab,
  eventId,
  drawId,
  update,
}: {
  callback?: () => void;
  eventId: string;
  drawId: string;
  update: UpdateStructure;
}): void {
  const ctx = getStructurePublishContext(drawId);
  if (!ctx) return undefined;
  const { drawDetail, structureIds } = ctx;

  const structureDetails = mergeStructureDetails({
    structureDetails: drawDetail.structureDetails,
    structureIds,
    update,
  });

  mutationRequest({
    methods: [
      {
        method: PUBLISH_EVENT,
        params: {
          removePriorValues: true,
          drawDetails: {
            [drawId]: {
              ...drawDetail,
              // publishEvent marks the draw published on any drawDetails write; carry the embargo with it.
              publishingDetail: { ...drawDetail.publishingDetail, published: true },
              structureDetails,
            },
          },
          eventDataParams: PUBLISH_EVENT_DATA_PARAMS,
          eventId,
        },
      },
    ],
    callback: () => callback(),
  });
}

type StructureTarget = { eventId: string; drawId: string; structureId: string; callback?: () => void };

/**
 * Hide the rounds of one structure beyond `roundLimit` (AD_HOC); `undefined` shows every round.
 * The structure's own visibility is left as it is: a round limit is not a decision to publish it.
 */
export function setStructureRoundLimit({
  roundLimit,
  structureId,
  ...target
}: StructureTarget & { roundLimit?: number }): void {
  publishStructureDetails({
    ...target,
    update: (id, detail) => {
      if (id !== structureId) return detail;
      const { roundLimit: _prior, ...rest } = detail;
      return roundLimit === undefined ? rest : { ...rest, roundLimit };
    },
  });
}

/** Set (or, with no `embargo`, clear) the schedule embargo of one round of one structure. */
export function setRoundScheduleEmbargo({
  roundNumber,
  structureId,
  embargo,
  ...target
}: StructureTarget & { roundNumber: number; embargo?: string }): void {
  publishStructureDetails({
    ...target,
    update: (id, detail) => {
      if (id !== structureId) return detail;
      const roundDetail = embargo ? { published: true, embargo } : { published: true };
      return { ...detail, scheduledRounds: { ...detail.scheduledRounds, [roundNumber]: roundDetail } };
    },
  });
}

/**
 * Toggle one structure's visibility.
 *
 * When the draw is not published, turning a structure on publishes the draw with ONLY that structure —
 * the qualifying-first case: qualifying goes live while main and consolation stay withheld.
 */
export function toggleStructurePublished({
  eventId,
  drawId,
  structureId,
  drawPublished,
  structurePublished,
}: {
  eventId: string;
  drawId: string;
  structureId: string;
  drawPublished: boolean;
  structurePublished: boolean;
}): void {
  publishStructureDetails({
    eventId,
    drawId,
    update: (id, detail) => {
      if (id === structureId) return { ...detail, published: !structurePublished };
      return drawPublished ? detail : { ...detail, published: false };
    },
  });
}
