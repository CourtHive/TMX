import { mutationRequest } from 'services/mutation/mutationRequest';
import { buildApplyMethods, DrawSpec, UnsupportedFlight } from './buildApplyMethods';

// constants and types
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
  // The structure recommendation per event, kept for future "draw
  // drawer pre-fill" work — applyFormatPlan does not generate draws
  // itself because TMX's convention is that draws are created
  // per-flight when the TD navigates to the event tab.
  drawSpecs: DrawSpec[];
  unsupported: UnsupportedFlight[];
  error?: any;
}

// Materializes a ranked plan as events + entries. One ADD_EVENT +
// ADD_EVENT_ENTRIES pair per flight. Draw generation is **not**
// performed here — the TMX flow has the TD navigate into each
// event/flight tab to generate the draw. The structure
// recommendation per flight is returned via `drawSpecs` so a
// future drawer pre-fill can use it.
export function applyFormatPlan({ plan, scaleName, eventNamePrefix, callback }: ApplyFormatPlanArgs): void {
  const { eventMethods, drawSpecs, unsupported } = buildApplyMethods({ plan, scaleName, eventNamePrefix });

  if (eventMethods.length === 0) {
    callback?.({
      success: false,
      eventIds: [],
      drawSpecs: [],
      unsupported,
      error: { message: 'NOTHING_TO_APPLY' },
    });
    return;
  }

  mutationRequest({
    methods: eventMethods,
    callback: (result: any) => {
      callback?.({
        success: !!result?.success,
        eventIds: drawSpecs.map((d) => d.eventId),
        drawSpecs,
        unsupported,
        error: result?.error,
      });
    },
  });
}
