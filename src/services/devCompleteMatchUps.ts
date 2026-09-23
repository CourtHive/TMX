/**
 * Dev utility to complete all matchUps in the currently viewed structure.
 * Auto-detects drawId/structureId from the URL hash.
 * Uses mutationRequest so it works in client/server environments.
 * Stops at lucky draw boundaries (does not auto-resolve lucky loser selections).
 *
 * ## This used to be a hand-rolled loop, and the loop had a defect
 *
 * It selected work with `readyToScore && !winningSide && matchUpStatus !== 'BYE'`. A
 * `DOUBLE_WALKOVER` has **no winningSide** — both sides exited — so a director's deliberate entry
 * passed that filter and was OVERWRITTEN with a generated result, with `allowChangePropagation:
 * true` to let it override. Found by CA 2026-09-23 while investigating exit propagation, where the
 * button was quietly replacing the very statuses under investigation.
 *
 * The factory's `completeDrawMatchUps` has always refused that (it skips `DOUBLE_WALKOVER` and
 * `DOUBLE_DEFAULT` explicitly). The only reason this file existed was that the factory method
 * filtered by stage and round but never by STRUCTURE, and this control is scoped to the structure a
 * director is looking at. `structureIds` was added there instead — competition-factory#4971 — so the
 * duplicate could go away rather than be repaired.
 *
 * Also gone with it: the multi-pass loop (the factory method has its own), and the CONTAINER →
 * children expansion for round robin. The factory accepts either the container id or a child id;
 * passing children to a version that only matched top-level ids completed NOTHING and said nothing,
 * which is why that behaviour is pinned by a test there.
 */
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { logMutationError } from 'functions/logMutationError';
import * as factory from 'tods-competition-factory';

// constants
import { COMPLETE_DRAW_MATCHUPS } from 'constants/mutationConstants';

function getHashSegment(name: string): string | undefined {
  const hash = globalThis.location.hash.replace('#/', '').split('/');
  const idx = hash.indexOf(name);
  return idx >= 0 ? hash[idx + 1] : undefined;
}

export function completeMatchUps({ drawId, structureId }: { drawId?: string; structureId?: string } = {}): void {
  const te = factory.tournamentEngine;

  // Auto-detect from current route: .../draw/:drawId/structure/:structureId
  if (!drawId) drawId = getHashSegment('draw');
  if (!structureId) structureId = getHashSegment('structure');

  if (!drawId) return console.log('No drawId — navigate to a draw view first');

  /**
   * Lucky draws stop before the decisions they would otherwise force.
   *
   * `completeDrawMatchUps` knows nothing about lucky draws (verified: zero references), and left to
   * itself it runs up to ten passes. Capping `completionGoal` at the number of matchUps that are
   * ready RIGHT NOW reproduces the single pass the previous loop performed before stopping — the
   * factory breaks out as soon as the goal is reached.
   */
  const isLucky = te.getLuckyDrawRoundStatus({ drawId, structureId })?.isLuckyDraw;
  const readyNow = isLucky
    ? (te.allDrawMatchUps({ drawId, inContext: true })?.matchUps ?? []).filter(
        (matchUp: any) =>
          !matchUp.isCollectionMatchUp &&
          matchUp.readyToScore &&
          !matchUp.winningSide &&
          (!structureId || matchUp.structureId === structureId),
      ).length
    : undefined;

  const params: any = { drawId };
  // omitted, the factory completes every structure in the draw — which is what the dev console
  // wants when it is invoked from outside a structure view
  if (structureId) params.structureIds = [structureId];
  if (readyNow !== undefined) params.completionGoal = readyNow;

  mutationRequest({
    methods: [{ method: COMPLETE_DRAW_MATCHUPS, params }],
    callback: (result: any) => {
      if (!result?.success) {
        logMutationError('devCompleteMatchUps', result);
        return;
      }
      if (isLucky) console.log('Lucky draw — stopping before lucky loser selection');
      reRenderCurrentView(drawId, structureId);
    },
  });
}

function reRenderCurrentView(drawId?: string, structureId?: string) {
  const eventId = getHashSegment('event');
  const view = getHashSegment('view');
  // Navigo won't re-trigger if the hash is unchanged, so force by
  // navigating away momentarily then back to the draw view.
  // The setTimeout ensures the first navigation's route handler completes
  // before the second fires — without it, Navigo may skip the re-resolve.
  navigateToEvent({ eventId });
  setTimeout(() => navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view }), 0);
}
