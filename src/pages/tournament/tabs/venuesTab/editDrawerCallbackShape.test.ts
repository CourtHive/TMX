/**
 * Guard: each venue edit drawer hands its callback exactly ONE shape.
 *
 * `editVenue` and `editCourt` used to build the callback payload twice — a success branch carrying
 * the edit's details (`venueUpdates`/`courtsUpdated`, `courtUpdates`) and an error branch handing
 * back a bare `result` without them. Consumers destructure those details, so on the error path they
 * read `undefined`. Nothing depended on them there, which is precisely what made it a trap rather
 * than a bug — it was one unguarded read away from a live defect, on whichever route happened to
 * fail.
 *
 * This is the same defect class as the venues-table refresh (TMX #1306): two paths passing
 * different shapes to a single callback, where the divergence stays invisible until someone reads
 * the argument. The fix there was to make the shape identical by construction rather than by
 * discipline, and the same applies here.
 *
 * A type alone does not hold the line — TypeScript will happily accept a second `callback(result)`
 * whose spread satisfies the type at the widened `any` the mutation result carries. The invariant
 * that actually prevents divergence is structural: **one construction, one call site**. So that is
 * what this asserts. Re-split either branch and this reddens.
 *
 * Source-level assertion is deliberate. The behaviour it protects has no user-visible symptom
 * today, so a DOM or e2e test would pass with the defect present and prove nothing — the failure
 * mode this guards is a future consumer, not a current render.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DRAWERS = [
  { name: 'editVenue', path: new URL('./editVenue.ts', import.meta.url) },
  { name: 'editCourt', path: new URL('./editCourt.ts', import.meta.url) },
];

/** Invocations of the callback — `callback(` — not `isFunction(callback)` or the `callback?:` type. */
const invocations = (source: string) => source.match(/\bcallback\(/g) ?? [];

describe('venue edit drawers hand back one callback shape', () => {
  for (const drawer of DRAWERS) {
    const source = readFileSync(drawer.path, 'utf8');

    it(`${drawer.name} invokes its callback from exactly one site`, () => {
      expect(invocations(source)).toHaveLength(1);
    });

    it(`${drawer.name} does not hand back a bare mutation result`, () => {
      // The pre-fix error branch was literally `callback(result)`. Spreading it into the details
      // object is the shape we want; passing it through untouched is the one we do not.
      expect(source).not.toMatch(/\bcallback\(result\)/);
    });
  }

  it('the detector can report dirty', () => {
    // Falsifies the check above: the pre-fix shape, verbatim, must fail both assertions.
    const preFix = `
      const postMutation = (result: any) => {
        if (result.success) {
          if (isFunction(callback)) callback({ ...result, courtUpdates });
        } else if (result.error) {
          if (isFunction(callback)) callback(result);
        }
      };
    `;
    expect(invocations(preFix)).toHaveLength(2);
    expect(preFix).toMatch(/\bcallback\(result\)/);
  });
});
