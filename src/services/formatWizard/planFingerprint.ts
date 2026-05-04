// constants and types
import { RankedPlan } from 'tods-competition-factory';

// Deterministic identity for a ranked plan — used to pin a plan
// into the consideration lane and to detect when a previously
// considered plan no longer appears in the current results.
//
// Shape: `<strategy>:<variant>:<kind>:<variantId>:<vc>:<sizes>`
// where `sizes` is a `,`-joined list of flight participant counts
// sorted descending so equivalent plans hash identically across
// runs (the engine doesn't guarantee flight order on every call).
export function planFingerprint(plan: RankedPlan): string {
  const first = plan.flightStructures[0]?.structure;
  const sizes = plan.flightStructures
    .map((fs) => fs.flight.participantIds.length)
    .sort((a, b) => b - a)
    .join(',');
  return [
    plan.strategy,
    plan.variant ?? '',
    first?.kind ?? '',
    first?.variantId ?? '',
    first?.voluntaryConsolation ? 'vc' : '',
    sizes,
  ].join(':');
}
