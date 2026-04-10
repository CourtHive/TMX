/**
 * Pure auto-mapper for the participant import pipeline.
 *
 * Given an array of source headers (in column order), returns a column-index →
 * `TargetField` mapping pre-populated from the synonym tables in `participantFieldModel`.
 *
 * Resolution order per column:
 *   1. Rating scale match (e.g. "UTR" → `{ kind: 'rating', ratingScaleName: 'UTR' }`).
 *      Multiple rating columns are allowed since each can use a different scale.
 *   2. Exact synonym match against `SYNONYM_RULES`.
 *   3. Partial (`*`-prefixed) synonym match against `SYNONYM_RULES`.
 *   4. Fallback to `{ kind: 'ignore' }`.
 *
 * Duplicate-header handling: when the same `TargetFieldKind` would be assigned to
 * more than one column (e.g. `Partner Email` appearing twice), only the first
 * occurrence is mapped — subsequent duplicates fall back to `ignore`. The user can
 * override in the mapping UI.
 */

import { normalizeHeader } from './participantFieldModel';

// constants and types
import { RATING_SYNONYMS, SYNONYM_RULES, TargetField, TargetFieldKind } from './participantFieldModel';

export type ColumnMapping = Record<number, TargetField>;

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedKinds = new Set<TargetFieldKind>();

  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]);
    if (!normalized) {
      mapping[i] = { kind: 'ignore' };
      continue;
    }

    const ratingScale = matchRatingScale(normalized);
    if (ratingScale) {
      mapping[i] = { kind: 'rating', ratingScaleName: ratingScale };
      continue;
    }

    const kind = matchSynonym(normalized);
    if (kind && !usedKinds.has(kind)) {
      mapping[i] = { kind };
      usedKinds.add(kind);
      continue;
    }

    mapping[i] = { kind: 'ignore' };
  }

  return mapping;
}

function matchRatingScale(normalizedHeader: string): string | null {
  for (const { scaleName, synonyms } of RATING_SYNONYMS) {
    for (const synonym of synonyms) {
      if (normalizeHeader(synonym) === normalizedHeader) return scaleName;
    }
  }
  return null;
}

function matchSynonym(normalizedHeader: string): TargetFieldKind | null {
  // Pass 1 — exact matches.
  for (const rule of SYNONYM_RULES) {
    for (const synonym of rule.synonyms) {
      if (synonym.startsWith('*')) continue;
      if (normalizeHeader(synonym) === normalizedHeader) return rule.kind;
    }
  }
  // Pass 2 — partial matches.
  for (const rule of SYNONYM_RULES) {
    for (const synonym of rule.synonyms) {
      if (!synonym.startsWith('*')) continue;
      const needle = normalizeHeader(synonym.slice(1));
      if (needle && normalizedHeader.includes(needle)) return rule.kind;
    }
  }
  return null;
}
