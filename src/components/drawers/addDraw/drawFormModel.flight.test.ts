import { drawFormModel, resolveDrawFormMode } from './drawFormModel';
import { describe, expect, it } from 'vitest';

/**
 * A flight with no draw yet is a reserved drawId with its own entries (CA 2026-11-17). Its new draw opened sized for
 * the whole event: a flight of 16 from an event of 32 was offered a 32, with 16 BYEs, until a field was touched.
 */
const DA = 'DIRECT_ACCEPTANCE';
const entries = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ participantId: `p${from + i}`, entryStage: 'MAIN', entryStatus: DA }));
const event = {
  eventId: 'E1',
  entries: entries(0, 32),
  flightProfile: {
    flights: [
      { drawId: 'F1', drawName: 'Flight 1', flightNumber: 1, drawEntries: entries(0, 16) },
      { drawId: 'F2', drawName: 'Flight 2', flightNumber: 2, drawEntries: entries(16, 16) },
    ],
  },
};

describe('resolveDrawFormMode — a flight', () => {
  it("sizes a flight's new draw from the flight's entries", () => {
    const mode = resolveDrawFormMode({ event, drawId: 'F1' });
    expect(mode.kind).toBe('NEW_MAIN');
    expect(mode.event.entries).toHaveLength(16);
    expect(drawFormModel(mode, {}).derivedValues.drawSize).toBe(16);
  });

  it('a new draw for the event is sized from all of its entries', () => {
    expect(drawFormModel(resolveDrawFormMode({ event }), {}).derivedValues.drawSize).toBe(32);
  });

  it('a drawId that is no flight leaves the event as it is', () => {
    expect(resolveDrawFormMode({ event, drawId: 'unknown' }).event).toBe(event);
  });
});
