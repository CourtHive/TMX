import { parse as cParse, stringify as cStringify } from 'circular-json';

function tildeCount(str) {
  return (str?.match(/~/g) || []).length;
}

export function parse({ note, data, maxTilde }) {
  if (!data) return undefined;
  if (typeof data !== 'string') return data;
  try {
    let circular = false;
    let tc = tildeCount(data);
    if (tc && tc > maxTilde) {
      circular = true;
    }
    let parsed = cParse(data);
    if (circular && parsed.metadata && parsed.metadata.format_version) {
      console.log('CIRCULAR', note || '');
      parsed.metadata.format_version = '1.0';
    }
    return parsed;
  } catch (e) {
    console.log({ message: 'failed circular parse', data: note || data });
    return parseNormal({ note, data });
  }
}

function parseNormal({ note, data }) {
  try {
    return JSON.parse(data);
  } catch (err) {
    console.log({ message: 'falied normal parse', note });
  }
}

export function stringify(data) {
  if (!data) return undefined;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch (e) {
    return cStringify(data);
  }
}
