/**
 * Backwards-compatible wrapper around the import pipeline for the legacy
 * Google Sheet flow.
 *
 * The Google Sheet path delivers an array of `{ headerName: cellValue }` row
 * objects (built by `mapHeaderIntoRows` in `services/sheets/fetchGoogleSheet`).
 * This wrapper:
 *
 *   1. Reconstructs positional `headers` and `rows` from those keyed objects
 *      (using the union of keys across all rows so ragged rows don't lose data).
 *   2. Auto-maps the headers via `autoMapColumns`.
 *   3. Hands everything to `commitParticipantImport`, including a chained
 *      `ADD_TOURNAMENT_EXTENSION` write so the sheet ID is persisted alongside
 *      the participant insert in a single mutation request.
 *
 * Milestone 3 will replace this wrapper by routing the Google Sheet flow
 * directly through the new mapping view; for Milestone 1 it preserves existing
 * behavior end-to-end so nothing user-visible changes.
 */

import { commitParticipantImport } from 'services/import/commitParticipantImport';
import { autoMapColumns } from 'services/import/autoMapColumns';

// constants and types
import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';
import { REGISTRATION } from 'constants/tmxConstants';

export function incomingParticipants({
  data,
  sheetId,
  callback,
}: {
  data: any[];
  sheetId: string;
  callback?: () => void;
}): void {
  const safeData = Array.isArray(data) ? data : [];

  // Union of keys across all rows preserves headers from any row that has them,
  // because the Google Sheet parser may omit blank cells per row.
  const headerSet = new Set<string>();
  for (const row of safeData) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) headerSet.add(key);
    }
  }
  const headers = Array.from(headerSet);

  const rows: string[][] = safeData.map((row) =>
    headers.map((header) => {
      const value = row?.[header];
      return value == null ? '' : String(value);
    }),
  );

  const mapping = autoMapColumns(headers);

  const additionalMethods = sheetId
    ? [
        {
          method: ADD_TOURNAMENT_EXTENSION,
          params: { extension: { name: REGISTRATION, value: sheetId } },
        },
      ]
    : [];

  commitParticipantImport({
    headers,
    rows,
    mapping,
    additionalMethods,
    callback: callback ? () => callback() : undefined,
  });
}
