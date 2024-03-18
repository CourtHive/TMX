import { isString } from 'functions/typeOf';

const notEmpty = (v: any) => ![null, undefined].includes(v);
const mapColumns = ({ c }) => c.map((col) => (notEmpty(col?.v) ? col : {}));

export function mapHeaderIntoRows({ header, rows, useFormat = false }) {
  const hasDateValue = (v) => isString(v) && /Date\((\d+),(\d+),(\d+)\)/.test(v);
  const formatOrValue = (c) => c.f || c.v;
  const extractColumnValue = (c) => (useFormat ? formatOrValue(c) : hasDateValue(c.v) ? formatOrValue(c) : c.v);
  const addAttribute = (p, c, i) => ({ ...p, [header[i]]: extractColumnValue(c) });
  const processColumn = (p, c, i) => (notEmpty(c.v) ? addAttribute(p, c, i) : p);
  const buildRow = (row) => row.reduce((p, c, i) => processColumn(p, c, i), {});
  return rows.map(mapColumns).map(buildRow);
}

export function getRows(res) {
  try {
    const content = res.split('setResponse(')[1].split(');')[0];
    const json = JSON.parse(content);
    const { cols, rows } = json.table ?? {};
    const header = cols.map(({ label }) => label);
    if (header.filter(Boolean).length) {
      return mapHeaderIntoRows({ header, rows });
    } else {
      const [headerRow, ...remainingRows] = rows;
      const header = mapColumns(headerRow).map((row) => row.v);
      return mapHeaderIntoRows({ header, rows: remainingRows });
    }
  } catch (e) {
    return [];
  }
}

async function fetchSheet({ sheetId }) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?`;

  try {
    const response = await window.fetch(sheetUrl);
    return response?.ok ? response.text() : undefined;
  } catch (e) {
    return undefined;
  }
}

export async function fetchGoogleSheet({ sheetId }) {
  const res = await fetchSheet({ sheetId });
  return res ? getRows(res) : [];
}
