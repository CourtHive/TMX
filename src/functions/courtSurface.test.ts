import { courtSurfaceCategory, isSurfaceCategory, surfaceModifications } from './courtSurface';
import { describe, expect, it } from 'vitest';

describe('courtSurface', () => {
  it('knows the CODES surface classes and nothing else', () => {
    expect(isSurfaceCategory('CLAY')).toBe(true);
    expect(isSurfaceCategory('Plexicushion')).toBe(false);
    expect(isSurfaceCategory(undefined)).toBe(false);
  });

  it('reads surfaceCategory first, then a class left in surfaceType, never free text', () => {
    expect(courtSurfaceCategory({ surfaceCategory: 'CLAY', surfaceType: 'GRASS' })).toBe('CLAY');
    expect(courtSurfaceCategory({ surfaceType: 'GRASS' })).toBe('GRASS');
    expect(courtSurfaceCategory({ surfaceType: 'Plexicushion' })).toBeUndefined();
    expect(courtSurfaceCategory(undefined)).toBeUndefined();
  });

  it('writes the chosen class to surfaceCategory', () => {
    expect(surfaceModifications('HARD', { surfaceCategory: 'CLAY' })).toEqual({ surfaceCategory: 'HARD' });
  });

  it('clears surfaceCategory when the surface is cleared', () => {
    expect(surfaceModifications('', { surfaceCategory: 'CLAY' })).toEqual({ surfaceCategory: undefined });
  });

  it('moves a class an earlier TMX left in surfaceType out of it', () => {
    expect(surfaceModifications('GRASS', { surfaceType: 'GRASS' })).toEqual({
      surfaceCategory: 'GRASS',
      surfaceType: undefined,
    });
  });

  it("keeps the operator's free-text surfaceType", () => {
    expect(surfaceModifications('HARD', { surfaceType: 'Plexicushion' })).toEqual({ surfaceCategory: 'HARD' });
  });
});
