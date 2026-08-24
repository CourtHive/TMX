import { nextCheckInPromptMode, checkInModeGlyph } from './checkInModeToggle';
import { describe, expect, it } from 'vitest';

describe('nextCheckInPromptMode', () => {
  it('cycles off to on to auto and back', () => {
    // The two definite answers come first; auto is the clever one you arrive at last.
    expect(nextCheckInPromptMode('off')).toBe('on');
    expect(nextCheckInPromptMode('on')).toBe('auto');
    expect(nextCheckInPromptMode('auto')).toBe('off');
  });

  it('returns every mode exactly once before repeating', () => {
    // Guards the modulo: an off-by-one would strand a mode as unreachable from the button.
    const seen = new Set();
    let mode = 'off' as ReturnType<typeof nextCheckInPromptMode>;
    for (let i = 0; i < 3; i++) {
      seen.add(mode);
      mode = nextCheckInPromptMode(mode);
    }
    expect([...seen].sort()).toEqual(['auto', 'off', 'on']);
    expect(mode).toBe('off');
  });
});

describe('checkInModeGlyph', () => {
  it('gives each mode a distinct glyph', () => {
    const glyphs = ['off', 'on', 'auto'].map((m) => checkInModeGlyph(m as any));
    expect(new Set(glyphs).size).toBe(3);
  });
});
