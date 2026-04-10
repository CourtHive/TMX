/**
 * Row-level dedupe for the participant import pipeline.
 *
 * Groups input rows by the value of the email column (case-insensitive, trimmed)
 * and merges each group into a single row using a "last non-empty value wins"
 * rule per column. This preserves information across multiple form submissions
 * by the same person — the most recent non-blank cell for each field wins, while
 * a later blank submission does not erase data carried in earlier rows.
 *
 * Rows whose email cell is blank are kept as-is (each treated as its own group).
 *
 * Returns the merged rows in the order their first occurrence appeared in the
 * input, plus a `mergeCount` indicating how many rows were collapsed (so the
 * caller can surface a "merged N duplicate rows" notice in the import summary).
 */

export type DedupeResult = {
  mergedRows: string[][];
  mergeCount: number;
};

export function dedupeByEmail(rows: string[][], emailColumnIndex: number | undefined): DedupeResult {
  if (emailColumnIndex == null) {
    return { mergedRows: rows, mergeCount: 0 };
  }

  const groups = new Map<string, string[][]>();
  const order: string[] = [];

  for (const row of rows) {
    const cell = row[emailColumnIndex];
    const email = cell == null ? '' : String(cell).trim().toLowerCase();
    // Blank emails get a unique key so each remains its own row.
    const key = email || `__no_email_${order.length}__`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }

  let mergeCount = 0;
  const mergedRows = order.map((key) => {
    const group = groups.get(key)!;
    if (group.length === 1) return group[0];
    mergeCount += group.length - 1;
    return mergeRowGroup(group);
  });

  return { mergedRows, mergeCount };
}

function mergeRowGroup(group: string[][]): string[] {
  const width = Math.max(...group.map((row) => row.length));
  const merged: string[] = new Array(width).fill('');
  for (const row of group) {
    for (let c = 0; c < width; c++) {
      const cell = row[c];
      if (cell == null) continue;
      const value = String(cell);
      if (value.trim()) merged[c] = value;
    }
  }
  return merged;
}
