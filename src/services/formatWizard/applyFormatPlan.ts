import { tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { buildApplyMethods, DrawSpec, UnsupportedFlight } from './buildApplyMethods';

// constants and types
import { ADD_DRAW_DEFINITION } from 'constants/mutationConstants';
import { RankedPlan } from 'tods-competition-factory';

export interface ApplyFormatPlanArgs {
  plan: RankedPlan;
  scaleName?: string;
  eventNamePrefix?: string;
  callback?: (result: ApplyFormatPlanResult) => void;
}

export interface ApplyFormatPlanResult {
  success: boolean;
  eventIds: string[];
  drawIds: string[];
  unsupported: UnsupportedFlight[];
  error?: any;
  stage?: 'EVENTS' | 'DRAWS';
}

function generateDrawMethods(drawSpecs: DrawSpec[]): { drawMethods: any[]; failures: DrawSpec[] } {
  const drawMethods: any[] = [];
  const failures: DrawSpec[] = [];

  for (const spec of drawSpecs) {
    const result: any = tournamentEngine.generateDrawDefinition?.({
      eventId: spec.eventId,
      drawType: spec.drawType,
      drawSize: spec.drawSize,
      drawId: spec.drawId,
      automated: true,
      ignoreStageSpace: true,
      ...spec.extras,
    });

    if (!result?.success || !result.drawDefinition) {
      failures.push(spec);
      continue;
    }

    drawMethods.push({
      method: ADD_DRAW_DEFINITION,
      params: { eventId: spec.eventId, drawDefinition: result.drawDefinition, allowReplacement: true },
    });
  }

  return { drawMethods, failures };
}

// Two-stage materialization of a ranked plan into a real tournament
// shape. Stage 1 creates events + entries (one event per flight). On
// Stage 1 success, we generate each flight's draw locally against the
// fresh factory state and submit a single ADD_DRAW_DEFINITION batch.
//
// Errors at either stage abort with `success: false` and a `stage`
// marker so the caller can distinguish "no events created" from
// "events created but draws failed."
export function applyFormatPlan({ plan, scaleName, eventNamePrefix, callback }: ApplyFormatPlanArgs): void {
  const { eventMethods, drawSpecs, unsupported } = buildApplyMethods({ plan, scaleName, eventNamePrefix });

  if (eventMethods.length === 0) {
    callback?.({
      success: false,
      eventIds: [],
      drawIds: [],
      unsupported,
      error: { message: 'NOTHING_TO_APPLY' },
      stage: 'EVENTS',
    });
    return;
  }

  mutationRequest({
    methods: eventMethods,
    callback: (eventResult: any) => {
      if (!eventResult?.success) {
        callback?.({
          success: false,
          eventIds: [],
          drawIds: [],
          unsupported,
          error: eventResult?.error ?? { message: 'EVENTS_STAGE_FAILED' },
          stage: 'EVENTS',
        });
        return;
      }

      const { drawMethods, failures } = generateDrawMethods(drawSpecs);
      if (drawMethods.length === 0) {
        callback?.({
          success: false,
          eventIds: drawSpecs.map((d) => d.eventId),
          drawIds: [],
          unsupported,
          error: { message: 'NO_DRAWS_GENERATED', failures },
          stage: 'DRAWS',
        });
        return;
      }

      mutationRequest({
        methods: drawMethods,
        callback: (drawResult: any) => {
          callback?.({
            success: !!drawResult?.success && failures.length === 0,
            eventIds: drawSpecs.map((d) => d.eventId),
            drawIds: drawSpecs.map((d) => d.drawId),
            unsupported,
            error: drawResult?.success
              ? failures.length === 0
                ? undefined
                : { message: 'PARTIAL_DRAW_GENERATION', failures }
              : drawResult?.error,
            stage: drawResult?.success ? undefined : 'DRAWS',
          });
        },
      });
    },
  });
}
