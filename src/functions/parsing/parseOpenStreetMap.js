import { isLatLong } from './isLatLongRegex';

export function parseOpenStreetMap(link) {
  let parts = link.split('/');
  if (parts[2] === 'www.openstreetmap.org') {
    let coords = parts.slice(4).join(',');
    return isLatLong.test(coords) ? { latitude: parts[4], longitude: parts[5] } : {};
  }

  return {};
}
