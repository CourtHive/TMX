import { isLatLong } from './isLatLongRegex';

type Coordinates = {
  latitude?: string;
  longitude?: string;
};

export function parseHereWeGo(link: string): Coordinates {
  const parts = link.split('=');
  if (parts.length > 1) {
    const components = parts[1].split(',');
    const coords = [components[0], components[1]].join(',');
    return isLatLong.test(coords)
      ? {
          latitude: components[0],
          longitude: components[1]
        }
      : {};
  }

  return {};
}
