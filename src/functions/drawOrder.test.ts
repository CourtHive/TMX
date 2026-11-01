import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  buildDrawOrderMethod,
  canReorderDraws,
  moveDrawId,
  orderedDrawDefinitions,
  orderedEventDrawIds,
  sortByDrawOrder,
} from './drawOrder';

// constants
import {
  ADD_DRAW_DEFINITION,
  ADD_FLIGHT,
  DELETE_DRAW_DEFINITIONS,
  DELETE_FLIGHT_AND_DRAW,
  UPDATE_DRAW_IDS_ORDER,
} from 'constants/mutationConstants';

const engine: any = tournamentEngine;

function setupEvent(drawNames = ['A', 'B', 'C']) {
  const {
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: [{ drawProfiles: drawNames.map((drawName) => ({ drawSize: 4, drawName })) }],
    setState: true,
  });
  return eventId;
}

function readEvent(eventId: string) {
  const { event } = engine.getEvent({ eventId });
  const { flightProfile } = engine.getFlightProfile({ eventId });
  return { event, flightProfile };
}

const drawNamesInOrder = (eventId: string) =>
  orderedDrawDefinitions(readEvent(eventId).event).map(({ drawName }: any) => drawName);

const displayedIds = (eventId: string) => orderedEventDrawIds(readEvent(eventId));

function writeOrder(eventId: string, drawIds: string[]) {
  let result: any = engine.executionQueue([buildDrawOrderMethod({ eventId, drawIds })]);
  expect(result.success).toBe(true);
  return result;
}

const drawIdByName = (eventId: string, drawName: string) =>
  readEvent(eventId).event.drawDefinitions.find((dd: any) => dd.drawName === drawName).drawId;

function addDraw(eventId: string, drawName: string, drawId?: string) {
  const { event } = readEvent(eventId);
  const participantIds = event.entries.slice(0, 4).map(({ participantId }: any) => participantId);
  const { drawDefinition } = engine.generateDrawDefinition({ eventId, drawId, drawName, drawSize: 4, participantIds });
  let result: any = engine.executionQueue([
    { method: ADD_DRAW_DEFINITION, params: { eventId, drawDefinition, allowReplacement: true } },
  ]);
  expect(result.success).toBe(true);
  return drawDefinition.drawId;
}

describe('draw order', () => {
  it('builds one method that writes every draw a place counted from 1', () => {
    expect(buildDrawOrderMethod({ eventId: 'e', drawIds: ['x', 'y', 'z'] })).toEqual({
      method: UPDATE_DRAW_IDS_ORDER,
      params: { eventId: 'e', orderedDrawIdsMap: { x: 1, y: 2, z: 3 } },
    });
  });

  it('offers reordering only with two or more draws', () => {
    expect(canReorderDraws([])).toBe(false);
    expect(canReorderDraws(['a'])).toBe(false);
    expect(canReorderDraws(['a', 'b'])).toBe(true);
  });

  it('moves a draw one place, and not past either end', () => {
    const drawIds = ['a', 'b', 'c'];
    expect(moveDrawId({ drawIds, drawId: 'b', direction: 'up' })).toEqual(['b', 'a', 'c']);
    expect(moveDrawId({ drawIds, drawId: 'b', direction: 'down' })).toEqual(['a', 'c', 'b']);
    expect(moveDrawId({ drawIds, drawId: 'a', direction: 'up' })).toBeUndefined();
    expect(moveDrawId({ drawIds, drawId: 'c', direction: 'down' })).toBeUndefined();
    expect(moveDrawId({ drawIds, drawId: 'missing', direction: 'up' })).toBeUndefined();
    expect(drawIds).toEqual(['a', 'b', 'c']);
  });

  it('keeps items without an order after the ordered ones, in their existing order', () => {
    const event = { drawDefinitions: [{ drawId: 'b', drawOrder: 2 }, { drawId: 'a', drawOrder: 1 }, { drawId: 'n' }] };
    const items = [{ drawId: 'x' }, { drawId: 'b' }, { drawId: 'n' }, { drawId: 'a' }, { drawId: 'y' }];
    const sorted = sortByDrawOrder({ items, event }).map(({ drawId }) => drawId);
    expect(sorted).toEqual(['a', 'b', 'x', 'n', 'y']);
    expect(items.map(({ drawId }) => drawId)).toEqual(['x', 'b', 'n', 'a', 'y']);
  });

  it('lists draws in the order they were added until they are reordered', () => {
    const eventId = setupEvent();
    expect(drawNamesInOrder(eventId)).toEqual(['A', 'B', 'C']);
    const drawOrders = readEvent(eventId).event.drawDefinitions.map(({ drawOrder }: any) => drawOrder);
    expect(drawOrders).toEqual([1, 2, 3]);
  });

  it('writes a dragged order through the engine without moving the draws in the record', () => {
    const eventId = setupEvent();
    const [a, b, c] = displayedIds(eventId);
    writeOrder(eventId, [c, a, b]);

    expect(drawNamesInOrder(eventId)).toEqual(['C', 'A', 'B']);
    expect(displayedIds(eventId)).toEqual([c, a, b]);
    const { event } = readEvent(eventId);
    expect(event.drawDefinitions.map(({ drawName }: any) => drawName)).toEqual(['A', 'B', 'C']);
    expect(event.drawDefinitions.map(({ drawOrder }: any) => drawOrder)).toEqual([2, 3, 1]);
  });

  it('moves a draw up and down with the same method', () => {
    const eventId = setupEvent();
    const ids = displayedIds(eventId);
    writeOrder(eventId, moveDrawId({ drawIds: ids, drawId: ids[2], direction: 'up' })!);
    expect(drawNamesInOrder(eventId)).toEqual(['A', 'C', 'B']);

    const next = displayedIds(eventId);
    writeOrder(eventId, moveDrawId({ drawIds: next, drawId: next[0], direction: 'down' })!);
    expect(drawNamesInOrder(eventId)).toEqual(['C', 'A', 'B']);
  });

  it('is refused by the engine when a draw is left out of the order', () => {
    const eventId = setupEvent();
    const [a, b] = displayedIds(eventId);
    let result: any = engine.executionQueue([buildDrawOrderMethod({ eventId, drawIds: [b, a] })]);
    expect(result.error).toBeDefined();
    expect(drawNamesInOrder(eventId)).toEqual(['A', 'B', 'C']);
  });

  it('puts a draw added after a reorder last', () => {
    const eventId = setupEvent();
    const [a, b, c] = displayedIds(eventId);
    writeOrder(eventId, [c, b, a]);
    addDraw(eventId, 'D');

    expect(drawNamesInOrder(eventId)).toEqual(['C', 'B', 'A', 'D']);
    const added = readEvent(eventId).event.drawDefinitions.find(({ drawName }: any) => drawName === 'D');
    expect(added.drawOrder).toEqual(4);
  });

  it('keeps the order of the remaining draws when a draw is deleted and its flight kept, leaving a gap', () => {
    const eventId = setupEvent();
    const [a, b, c] = displayedIds(eventId);
    writeOrder(eventId, [c, b, a]);
    let result: any = engine.executionQueue([
      { method: DELETE_DRAW_DEFINITIONS, params: { eventId, drawIds: [b], force: true } },
    ]);
    expect(result.success).toBe(true);

    expect(drawNamesInOrder(eventId)).toEqual(['C', 'A']);
    const { event } = readEvent(eventId);
    expect(event.drawDefinitions.map(({ drawName, drawOrder }: any) => [drawName, drawOrder])).toEqual([
      ['A', 3],
      ['C', 1],
    ]);
    // the kept flight holds its place among the draws
    expect(displayedIds(eventId)).toEqual([c, b, a]);
  });

  it('renumbers the remaining draws when a flight and its draw are deleted', () => {
    const eventId = setupEvent();
    const [a, b, c] = displayedIds(eventId);
    writeOrder(eventId, [c, b, a]);
    let result: any = engine.executionQueue([
      { method: DELETE_FLIGHT_AND_DRAW, params: { eventId, drawId: b, force: true } },
    ]);
    expect(result.success).toBe(true);

    expect(drawNamesInOrder(eventId)).toEqual(['C', 'A']);
    const orders = readEvent(eventId).event.drawDefinitions.map(({ drawName, drawOrder }: any) => [
      drawName,
      drawOrder,
    ]);
    expect(Object.fromEntries(orders)).toEqual({ C: 1, A: 2 });
    expect(displayedIds(eventId)).toEqual([c, a]);
  });

  it('orders flights that have no draw yet, and a flight generated later takes its place', () => {
    const eventId = setupEvent(['A', 'B']);
    const flightDrawId = 'flight-draw-id';
    let result: any = engine.executionQueue([
      { method: ADD_FLIGHT, params: { eventId, drawId: flightDrawId, drawName: 'F' } },
    ]);
    expect(result.success).toBe(true);

    const [a, b, f] = displayedIds(eventId);
    expect(f).toEqual(flightDrawId);
    writeOrder(eventId, [f, a, b]);
    expect(displayedIds(eventId)).toEqual([f, a, b]);

    addDraw(eventId, 'F', flightDrawId);
    expect(drawNamesInOrder(eventId)).toEqual(['F', 'A', 'B']);
    expect(drawIdByName(eventId, 'F')).toEqual(flightDrawId);
  });
});
