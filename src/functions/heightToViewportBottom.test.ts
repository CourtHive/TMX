import { heightToViewportBottom } from './heightToViewportBottom';
import { describe, expect, it } from 'vitest';

describe('heightToViewportBottom', () => {
  it('fills from the element down to the bottom of the window', () => {
    expect(heightToViewportBottom({ top: 180, viewportHeight: 1200 })).toBe(1020);
  });

  it('leaves the gap asked for', () => {
    expect(heightToViewportBottom({ top: 180, viewportHeight: 1200, gap: 12 })).toBe(1008);
  });

  it('never gives less than the floor, however little window is left', () => {
    expect(heightToViewportBottom({ top: 700, viewportHeight: 800 })).toBe(320);
    expect(heightToViewportBottom({ top: 700, viewportHeight: 800, min: 200 })).toBe(200);
  });

  it('whole pixels, so a fractional offset cannot overflow by a pixel', () => {
    expect(heightToViewportBottom({ top: 180.6, viewportHeight: 1200 })).toBe(1019);
  });
});
