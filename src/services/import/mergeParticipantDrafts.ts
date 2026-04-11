/**
 * Per-field merge for grouped participant drafts.
 *
 * The participant import pipeline groups parsed participant drafts by email
 * and feeds each group through this helper to produce a single canonical
 * draft. Merging happens AFTER parsing — never on raw cell strings — so a
 * later submission that has placeholder text in one column (e.g. "TBD" in a
 * combined "City / State" column) cannot erase the city/state values that
 * an earlier submission successfully parsed. Each field stands on its own.
 *
 * Semantics:
 *   - Primitives: last truthy value across drafts wins
 *   - Plain objects (e.g. `person`): recursively merged the same way
 *   - `addresses[]` and `contacts[]`: special-cased as single-element arrays
 *     and merged field-wise into `[0]`, so a partial later submission never
 *     drops earlier-set fields
 *   - Other arrays (`timeItems`, `personOtherIds`, `onlineResources`): the
 *     latest non-empty array wins wholesale. Good enough for v1; ratings
 *     and identifiers from the most-recent submission are typically what
 *     the user wants
 *
 * The merged draft does NOT carry a participantId — the caller is expected
 * to recompute it from `merged.participantName` after the merge so the ID
 * tracks the merged name, not whichever draft happened to be processed first.
 */

const SINGLE_ELEMENT_ARRAY_KEYS = new Set(['addresses', 'contacts']);

export function mergeParticipantDrafts(drafts: any[]): any {
  if (drafts.length === 0) return undefined;
  if (drafts.length === 1) return drafts[0];

  const merged: any = {
    participantType: 'INDIVIDUAL',
    participantRole: 'COMPETITOR',
    person: {},
  };

  for (const draft of drafts) deepMergeInto(merged, draft);

  // Drop the participantId carried over from the last draft so the caller is
  // forced to recompute it from the merged participantName. Avoids subtle
  // mismatches when the merged name differs from any individual draft's name.
  delete merged.participantId;
  return merged;
}

function deepMergeInto(target: any, source: any): void {
  if (!source || typeof source !== 'object') return;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') continue;

    if (SINGLE_ELEMENT_ARRAY_KEYS.has(key) && Array.isArray(value) && value[0]) {
      if (!Array.isArray(target[key]) || !target[key][0]) target[key] = [{}];
      deepMergeInto(target[key][0], value[0]);
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) target[key] = value;
      continue;
    }

    if (typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMergeInto(target[key], value);
      continue;
    }

    target[key] = value;
  }
}
