/**
 * Google Sheets data fetcher and parser for participant registration.
 *
 * OVERVIEW:
 * Fetches and parses Google Sheets data for importing participant information into tournaments.
 * Supports flexible column mapping with automatic header detection.
 *
 * GOOGLE SHEETS SETUP INSTRUCTIONS:
 * ================================
 *
 * 1. SHARING REQUIREMENTS:
 *    - Share the Google Sheet with "Anyone with the link can view"
 *    - Copy the shareable link from Google Sheets
 *    - Example URL: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
 *
 * 2. REQUIRED COLUMNS (must have these):
 *    - First Name / first / first_name: Participant's given name
 *    - Last Name / last / last_name: Participant's family name
 *
 * 3. OPTIONAL COLUMNS (recognized automatically):
 *    - id / participantid: Unique identifier (if not provided, auto-generated from name hash)
 *    - Full Name / name: Complete participant name (alternative to first/last)
 *    - Gender / sex: "MALE", "FEMALE", "M", "F", "W" (woman), "B" (boy), "G" (girl)
 *    - Birth Date / birth: Date of birth (YYYY-MM-DD format)
 *    - IOC / country / nationality: Country code (3-letter IOC code)
 *    - City: City of residence
 *    - State: State/province of residence
 *    - Tennis ID / tennisid: Official tennis organization ID
 *    - UTR: Universal Tennis Rating (numeric)
 *    - WTN: World Tennis Number (numeric)
 *    - UTR Profile: Link to UTR profile page
 *
 * 4. COLUMN NAME FLEXIBILITY:
 *    - Column names are case-insensitive
 *    - Spaces and underscores are treated the same
 *    - Partial matches work (e.g., "birth" matches any column containing "birth")
 *
 * 5. ID GENERATION:
 *    - If no 'id' column is provided, participant IDs are auto-generated
 *    - Generated format: "XXX-{hash}" where hash is computed from full participant name
 *    - Hash algorithm: 32-bit signed integer hash of the participant name string
 *    - Example: "John Smith" might generate "XXX-123456789"
 *    - Same name always generates the same ID (deterministic)
 *
 * EXAMPLE SHEET STRUCTURE:
 * ========================
 *
 * Option 1 - Basic (minimal columns):
 * | First Name | Last Name | Gender |
 * |------------|-----------|--------|
 * | John       | Smith     | M      |
 * | Jane       | Doe       | F      |
 *
 * Option 2 - With IDs:
 * | id    | First | Last  | Gender | Birth Date | IOC | UTR  | WTN  |
 * |-------|-------|-------|--------|------------|-----|------|------|
 * | P001  | John  | Smith | MALE   | 1990-05-15 | USA | 9.5  | 18.2 |
 * | P002  | Jane  | Doe   | FEMALE | 1992-08-20 | GBR | 8.75 | 17.5 |
 *
 * Option 3 - Without IDs (auto-generated):
 * | First Name | Last Name | City       | State | UTR  |
 * |------------|-----------|------------|-------|------|
 * | John       | Smith     | Los Angeles| CA    | 9.5  |
 * | Jane       | Doe       | London     |       | 8.75 |
 * (These will get IDs like "XXX-123456789" based on name hash)
 *
 * USAGE IN APPLICATION:
 * ====================
 * 1. Navigate to Participants tab
 * 2. Click "Import from Google sheet" in the control bar
 * 3. Paste the shareable Google Sheets link
 * 4. Click "Import" to fetch and process the data
 * 5. Participants are automatically added to the tournament
 *
 * DATA FLOW:
 * 1. fetchGoogleSheet() → Fetches sheet data via Google Sheets API
 * 2. getRows() → Parses response and extracts header/data
 * 3. mapHeaderIntoRows() → Maps columns to participant attributes
 * 4. incomingParticipants() → Processes and validates participant data
 * 5. ADD_PARTICIPANTS mutation → Adds participants to tournament
 *
 * @module fetchGoogleSheet
 */

import { isString } from 'functions/typeOf';

const notEmpty = (v: any) => ![null, undefined].includes(v);
const mapColumns = ({ c }) => c.map((col) => (notEmpty(col?.v) ? col : {}));

/**
 * Maps sheet header columns into row objects with attribute names.
 * @param header - Array of column header names from the sheet
 * @param rows - Array of row data from the sheet
 * @param useFormat - Whether to use formatted values (e.g., formatted dates)
 * @returns Array of objects with header names as keys and cell values as values
 */
export function mapHeaderIntoRows({ header, rows, useFormat = false }) {
  const hasDateValue = (v) => isString(v) && /Date\((\d+),(\d+),(\d+)\)/.test(v);
  const formatOrValue = (c) => c.f || c.v;
  const extractColumnValue = (c) => {
    if (useFormat) return formatOrValue(c);
    if (hasDateValue(c.v)) return formatOrValue(c);
    return c.v;
  };
  const addAttribute = (p, c, i) => ({ ...p, [header[i]]: extractColumnValue(c) });
  const processColumn = (p, c, i) => (notEmpty(c.v) ? addAttribute(p, c, i) : p);
  const buildRow = (row) => row.reduce((p, c, i) => processColumn(p, c, i), {});
  return rows.map(mapColumns).map(buildRow);
}

/**
 * Parses Google Sheets API response and extracts row data.
 * Handles both labeled columns and first-row headers.
 * @param res - Raw response text from Google Sheets API
 * @returns Array of parsed row objects with header columns as keys
 */
export function getRows(res) {
  try {
    const content = res.split('setResponse(')[1].split(');')[0];
    const json = JSON.parse(content);
    const { cols, rows } = json.table ?? {};
    const header = cols.map(({ label }) => {
      return label.split(' ')[0];
    });
    if (header.filter(Boolean).length) {
      return mapHeaderIntoRows({ header, rows });
    } else {
      const [headerRow, ...remainingRows] = rows;
      const header = mapColumns(headerRow).map((row) => row.v);
      console.log({ header });
      return mapHeaderIntoRows({ header, rows: remainingRows });
    }
  } catch (_e) {
    console.error('Error parsing sheet response:', _e);
    return [];
  }
}

/**
 * Fetches raw data from a Google Sheet using the visualization API.
 * @param sheetId - The unique identifier for the Google Sheet
 * @returns Response text if successful, undefined if error
 */
async function fetchSheet({ sheetId }) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?`;

  try {
    const response = await window.fetch(sheetUrl);
    return response?.ok ? response.text() : undefined;
  } catch (_e) {
    console.error('Error fetching sheet:', _e);
    return undefined;
  }
}

/**
 * Main entry point: Fetches and parses a Google Sheet into structured participant data.
 * @param sheetId - The unique identifier extracted from the Google Sheets URL
 * @returns Array of participant objects with mapped attributes, empty array if error
 *
 * @example
 * const sheetId = '1ABC123xyz'; // From URL: .../d/1ABC123xyz/edit
 * const participants = await fetchGoogleSheet({ sheetId });
 * // Returns: [{ First: 'John', Last: 'Smith', Gender: 'M', ... }, ...]
 */
export async function fetchGoogleSheet({ sheetId }) {
  const res = await fetchSheet({ sheetId });
  return res ? getRows(res) : [];
}
