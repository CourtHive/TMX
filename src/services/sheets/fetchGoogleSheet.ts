/**
 * Google Sheets fetcher for the participant import pipeline.
 *
 * Fetches a public sheet via the gviz/tq endpoint and returns the parsed
 * contents as positional `{ headers, rows }` so the import view can apply
 * its own auto-mapper / manual mapping (rather than collapsing duplicate
 * headers into a keyed object as the old `mapHeaderIntoRows` path did).
 *
 * Sheet sharing requirements (must be public):
 *   - In Google Sheets: Share → "Anyone with the link can view"
 *   - The sheet ID is the segment between `/d/` and `/edit` in the URL
 *
 * The previous implementation truncated multi-word column labels via
 * `label.split(' ')[0]` (which silently turned "First Name" into "First")
 * and rebuilt rows as keyed objects, which lost duplicate-header data.
 * Both bugs are fixed here — duplicates are preserved by index, and the
 * import view's auto-mapper sees the full header text.
 */
import { isString } from 'functions/typeOf';

const DATE_VALUE_PATTERN = /Date\((\d+),(\d+),(\d+)\)/;

type SheetCell = { v?: any; f?: any };
type SheetCol = { label?: string };
type SheetRow = { c?: SheetCell[] };
type SheetTable = { cols?: SheetCol[]; rows?: SheetRow[] };
type SheetResponse = { table?: SheetTable };

export type FetchedSheet = {
  headers: string[];
  rows: string[][];
};

export async function fetchGoogleSheetRaw({ sheetId }: { sheetId: string }): Promise<FetchedSheet> {
  const text = await fetchSheetText(sheetId);
  if (!text) return { headers: [], rows: [] };
  return parseSheetResponse(text);
}

async function fetchSheetText(sheetId: string): Promise<string | undefined> {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?`;
  try {
    const response = await window.fetch(sheetUrl);
    return response?.ok ? response.text() : undefined;
  } catch (error) {
    console.error('Error fetching sheet:', error);
    return undefined;
  }
}

export function parseSheetResponse(text: string): FetchedSheet {
  try {
    const content = text.split('setResponse(')[1]?.split(');')[0];
    if (!content) return { headers: [], rows: [] };

    const json: SheetResponse = JSON.parse(content);
    const cols = json.table?.cols ?? [];
    const rows = json.table?.rows ?? [];

    const headersFromLabels = cols.map((col) => (col.label ?? '').trim());
    const haveLabelHeaders = headersFromLabels.some((h) => h.length > 0);

    if (haveLabelHeaders) {
      return {
        headers: headersFromLabels,
        rows: rows.map((row) => extractRow(row, cols.length)),
      };
    }

    // Fall back to using the first data row as the header row
    const [firstRow, ...restRows] = rows;
    if (!firstRow) return { headers: [], rows: [] };
    const headers = (firstRow.c ?? []).map((cell) => (cell?.v == null ? '' : String(cell.v).trim()));
    return {
      headers,
      rows: restRows.map((row) => extractRow(row, headers.length)),
    };
  } catch (error) {
    console.error('Error parsing sheet response:', error);
    return { headers: [], rows: [] };
  }
}

function extractRow(row: SheetRow, columnCount: number): string[] {
  const cells = row.c ?? [];
  const out: string[] = new Array(columnCount).fill('');
  for (let i = 0; i < columnCount; i++) {
    out[i] = extractCellValue(cells[i]);
  }
  return out;
}

function extractCellValue(cell: SheetCell | undefined): string {
  if (!cell) return '';
  if (cell.v == null) return '';
  // Google's gviz returns dates as a serialized "Date(y,m,d)" literal — prefer
  // the formatted value when present so the cell shows the user's display form.
  if (isString(cell.v) && DATE_VALUE_PATTERN.test(cell.v)) {
    return cell.f != null ? String(cell.f) : String(cell.v);
  }
  return String(cell.v);
}
