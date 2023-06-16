import { isLatLong } from './isLatLongRegex';

export function parseHereWeGo(link) {
  let parts = link.split('=');
  if (parts.length > 1) {
    let components = parts[1].split(',');
    let coords = [components[0], components[1]].join(',');
    return isLatLong.test(coords)
      ? {
          latitude: components[0],
          longitude: components[1]
        }
      : {};
  }

  return {};
}
