/**
 * Parses a single cell value into a rating { scaleName, value }.
 *
 * Supports two modes:
 *
 *   1. Embedded type detection — the cell text contains a known scale prefix
 *      (e.g. "UTR 8.5", "WTN 12.0", "NTRP 4.5", "DUPR=4.123"). The prefix
 *      determines the scaleName regardless of any default.
 *
 *   2. Default scale — when `defaultScaleName` is supplied and the cell does
 *      not carry a recognizable prefix, the cell is parsed as a plain numeric
 *      value (with optional NTRP-style "+" suffix and parenthetical suffixes
 *      like "(Pro)") and assigned that scale.
 *
 * Returns null when no rating can be confidently extracted (the caller is
 * expected to surface this as a per-row warning or via the per-row override UI).
 */

// constants and types
import { ratingConstants } from 'tods-competition-factory';

const KNOWN_SCALES: string[] = Object.values(ratingConstants);

// Pre-compute prefix matchers — longest scale name first so "UTR_P" wins over "UTR".
const PREFIX_MATCHERS: Array<{ scaleName: string; pattern: RegExp }> = KNOWN_SCALES
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((scaleName) => ({
    scaleName,
    // Match "<SCALE>" optionally followed by ":" or "=" or whitespace, then a number.
    pattern: new RegExp(`^${escapeRegex(scaleName)}\\s*[:=]?\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i'),
  }));

const PLAIN_NUMERIC = /^([0-9]+(?:\.[0-9]+)?)\+?\s*(?:\([^)]*\))?\s*$/;

export type ParsedRating = {
  scaleName: string;
  value: number;
};

export type ParseRatingOptions = {
  defaultScaleName?: string;
};

export function parseRatingCell(
  raw: string | number | null | undefined,
  options: ParseRatingOptions = {},
): ParsedRating | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;

  for (const { scaleName, pattern } of PREFIX_MATCHERS) {
    const match = text.match(pattern);
    if (match) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) return { scaleName, value };
    }
  }

  if (options.defaultScaleName) {
    const numeric = text.match(PLAIN_NUMERIC);
    if (numeric) {
      const value = Number.parseFloat(numeric[1]);
      if (Number.isFinite(value)) return { scaleName: options.defaultScaleName, value };
    }
  }

  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
