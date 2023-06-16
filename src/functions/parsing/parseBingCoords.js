import { isLatLong } from './isLatLongRegex';

export function parseBingCoords(link) {
  let parts = link.split(',');
  return isLatLong.test(link) ? { latitude: parts[0], longitude: parts[1] } : {};
}
