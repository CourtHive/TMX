/**
 * The display order of an event's draws.
 *
 * A draw's place is its `drawOrder`, which the factory sets when a draw is added and which `updateDrawIdsOrder`
 * rewrites. A flight that has no draw yet takes its own `drawOrder` once the draws have been reordered. Anything
 * without an order keeps its existing position, after the ordered draws, so a list never reorders itself until an
 * order exists.
 *
 * Lives in its own module so it can be tested against the real engine without importing UI.
 */
import { UPDATE_DRAW_IDS_ORDER } from 'constants/mutationConstants';

export type MoveDirection = 'up' | 'down';

type DrawOrders = Map<string, number>;

const isOrder = (value: any): boolean => value !== undefined && value !== null && !Number.isNaN(Number(value));

/** drawId → display order, from the event's draws and then from flights that have no draw. */
export function getDrawOrders({ event, flightProfile }: { event?: any; flightProfile?: any }): DrawOrders {
  const orders: DrawOrders = new Map();
  for (const { drawId, drawOrder } of event?.drawDefinitions ?? []) {
    if (drawId && isOrder(drawOrder)) orders.set(drawId, Number(drawOrder));
  }
  const drawIds = new Set((event?.drawDefinitions ?? []).map(({ drawId }: any) => drawId));
  for (const { drawId, drawOrder } of flightProfile?.flights ?? []) {
    if (drawId && !drawIds.has(drawId) && isOrder(drawOrder)) orders.set(drawId, Number(drawOrder));
  }
  return orders;
}

/**
 * Returns a sorted copy of `items` by draw order. Items without an order follow the ordered ones, in their existing
 * order; ties keep their existing order too.
 */
export function sortByDrawOrder<T>({
  items,
  event,
  flightProfile,
  getDrawId = (item: any) => item?.drawId,
}: {
  items: T[];
  event?: any;
  flightProfile?: any;
  getDrawId?: (item: T) => string | undefined;
}): T[] {
  const orders = getDrawOrders({ event, flightProfile });
  const orderOf = (item: T) => {
    const drawId = getDrawId(item);
    return drawId === undefined ? undefined : orders.get(drawId);
  };
  return items
    .map((item, index) => ({ item, index, order: orderOf(item) }))
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined && a.order !== b.order) return a.order - b.order;
      if (a.order === undefined && b.order !== undefined) return 1;
      if (a.order !== undefined && b.order === undefined) return -1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/** The event's draws, sorted by draw order. */
export function orderedDrawDefinitions(event?: any): any[] {
  return sortByDrawOrder({ items: event?.drawDefinitions ?? [], event });
}

/** Every drawId the draws table lists, in display order: the event's draws and the flights that have no draw. */
export function orderedEventDrawIds({ event, flightProfile }: { event?: any; flightProfile?: any }): string[] {
  const drawIds: string[] = (event?.drawDefinitions ?? []).map(({ drawId }: any) => drawId).filter(Boolean);
  const generated = new Set(drawIds);
  const ungenerated = (flightProfile?.flights ?? [])
    .map(({ drawId }: any) => drawId)
    .filter((drawId: string) => drawId && !generated.has(drawId));
  return sortByDrawOrder({
    items: [...drawIds, ...ungenerated],
    getDrawId: (drawId) => drawId,
    flightProfile,
    event,
  });
}

/** Reordering is offered only when there are two or more draws to order. */
export function canReorderDraws(drawIds: string[]): boolean {
  return drawIds.length >= 2;
}

/** The order after moving one draw a place up or down, or undefined when it cannot move that way. */
export function moveDrawId({
  drawIds,
  drawId,
  direction,
}: {
  drawIds: string[];
  drawId: string;
  direction: MoveDirection;
}): string[] | undefined {
  const index = drawIds.indexOf(drawId);
  if (index < 0) return undefined;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= drawIds.length) return undefined;
  const moved = [...drawIds];
  [moved[index], moved[target]] = [moved[target], moved[index]];
  return moved;
}

/** The single method that writes a whole order: each drawId's place, counted from 1. */
export function buildDrawOrderMethod({ eventId, drawIds }: { eventId: string; drawIds: string[] }) {
  const orderedDrawIdsMap = Object.fromEntries(drawIds.map((drawId, i) => [drawId, i + 1]));
  return { method: UPDATE_DRAW_IDS_ORDER, params: { eventId, orderedDrawIdsMap } };
}
