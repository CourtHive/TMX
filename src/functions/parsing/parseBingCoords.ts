import { isLatLong } from './isLatLongRegex';

type Coordinates = {
  latitude?: string;
  longitude?: string;
};

export function parseBingCoords(link: string): Coordinates {
  const parts = link.split(',');
  return isLatLong.test(link) ? { latitude: parts[0], longitude: parts[1] } : {};
}
