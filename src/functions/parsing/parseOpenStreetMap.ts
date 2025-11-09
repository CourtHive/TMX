import { isLatLong } from './isLatLongRegex';

type Coordinates = {
  latitude?: string;
  longitude?: string;
};

export function parseOpenStreetMap(link: string): Coordinates {
  const parts = link.split('/');
  if (parts[2] === 'www.openstreetmap.org') {
    const coords = parts.slice(4).join(',');
    return isLatLong.test(coords) ? { latitude: parts[4], longitude: parts[5] } : {};
  }

  return {};
}
