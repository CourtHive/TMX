/**
 * Order of finish for a TEAM dual's lines: the order each line played to a result finished within its collection. The
 * StatCrew export reads it.
 *
 * The factory numbers the lines as they finish, on every write of a line's result: a line that finishes goes after the
 * others in its collection, a cleared line leaves the order and the later lines move up, a score edit keeps the
 * number. The scorecard only corrects the order, one collection at a time, in the collection card's entry mode.
 *
 * Lives in its own module so it can be tested without importing the overlay, which pulls courthive-components.
 */
import { SET_ORDER_OF_FINISH } from 'constants/mutationConstants';

export type FinishingOrderCollection = { collectionId: string; collectionName?: string };
export type FinishingOrderEntry = { matchUpId: string; orderOfFinish: number };

/** The dual's collections whose order can be corrected: two or more of their lines hold a finishing number. */
export function finishingOrderCollections(dual: any): FinishingOrderCollection[] {
  const numbered = (collectionId: string) =>
    (dual?.tieMatchUps ?? []).filter((line: any) => line.collectionId === collectionId && line.orderOfFinish).length;
  return (dual?.tieFormat?.collectionDefinitions ?? [])
    .filter(({ collectionId }: any) => numbered(collectionId) > 1)
    .map(({ collectionId, collectionName }: any) => ({ collectionId, collectionName }));
}

/** The collection's whole order as the card hands it back, for `setOrderOfFinish`. */
export function finishingOrderMethod({
  finishingOrder,
  drawId,
}: {
  finishingOrder: FinishingOrderEntry[];
  drawId: string;
}): any {
  return { method: SET_ORDER_OF_FINISH, params: { drawId, finishingOrder } };
}

type SaveFinishingOrderParams = {
  send: (params: { methods: any[]; callback: (result: any) => void }) => Promise<void> | void;
  notify: (success: boolean) => void;
  finishingOrder: FinishingOrderEntry[];
  onRefresh?: () => void;
  drawId: string;
};

/**
 * Save a collection's order and resolve to whether it was accepted. The collection card keeps the edits and offers
 * Save again when this resolves false, so a refusal refreshes nothing: the card stays as the director left it.
 */
export function saveFinishingOrder({
  finishingOrder,
  onRefresh,
  drawId,
  notify,
  send,
}: SaveFinishingOrderParams): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const settle = (success: boolean) => {
      notify(success);
      if (success) onRefresh?.();
      resolve(success);
    };
    try {
      // every path through the mutation calls back; a throw is settled here so the card never waits forever
      Promise.resolve(
        send({
          methods: [finishingOrderMethod({ drawId, finishingOrder })],
          callback: (result: any) => settle(!!result?.success),
        }),
      ).catch(() => settle(false));
    } catch {
      settle(false);
    }
  });
}
