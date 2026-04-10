/**
 * Hand-rolled CSV/TSV parser.
 *
 * Returns headers + rows as positional string arrays so duplicate headers are preserved
 * (the import pipeline keys columns by index, not by header name).
 *
 * Handles:
 *   - quoted fields with embedded delimiters
 *   - quoted fields with embedded newlines
 *   - escaped quotes via doubled `""`
 *   - mixed CRLF / LF line endings
 *   - empty trailing lines
 *   - auto-detect of `,` vs `\t` when delimiter is not supplied
 */

export type DelimiterChar = ',' | '\t';

export type ParseDelimitedOptions = {
  delimiter?: DelimiterChar;
};

export type ParseDelimitedResult = {
  delimiter: DelimiterChar;
  headers: string[];
  rows: string[][];
};

const QUOTE = '"';
const CR = '\r';
const LF = '\n';

export function parseDelimited(text: string, options: ParseDelimitedOptions = {}): ParseDelimitedResult {
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const allRows = parseRows(text, delimiter);
  const [headerRow = [], ...rows] = allRows;
  return { delimiter, headers: headerRow.map((cell) => cell.trim()), rows };
}

export function detectDelimiter(text: string): DelimiterChar {
  let inQuotes = false;
  let tabs = 0;
  let commas = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === QUOTE) {
      if (inQuotes && text[i + 1] === QUOTE) {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === '\t') tabs++;
    else if (ch === ',') commas++;
    else if (ch === LF) break;
  }
  return tabs > commas ? '\t' : ',';
}

function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  const commitField = () => {
    currentRow.push(currentField);
    currentField = '';
  };

  const commitRow = () => {
    // Skip rows that are just a single empty field (blank lines)
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === QUOTE) {
        if (text[i + 1] === QUOTE) {
          currentField += QUOTE;
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentField += ch;
      i++;
      continue;
    }

    if (ch === QUOTE) {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      commitField();
      i++;
      continue;
    }
    if (ch === CR) {
      i++;
      if (text[i] === LF) i++;
      commitField();
      commitRow();
      continue;
    }
    if (ch === LF) {
      i++;
      commitField();
      commitRow();
      continue;
    }
    currentField += ch;
    i++;
  }

  // Final field/row (no trailing newline case)
  if (currentField.length > 0 || currentRow.length > 0) {
    commitField();
    commitRow();
  }

  return rows;
}
