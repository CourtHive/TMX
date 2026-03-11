/**
 * Geolocation and mapping configuration.
 */
export interface LocationConfig {
  geolocate: boolean;
  geoposition: { lat: number; lng: number } | undefined;
  map: any;
  map_view: 'map' | 'satellite';
  map_provider: string;
}

export interface LeafletTileConfig {
  tileLayer: string;
  attribution: string;
  maxZoom?: number;
}

export interface LeafletConfig {
  map: LeafletTileConfig;
  satellite: LeafletTileConfig;
}

const locationDefaults: LocationConfig = {
  geolocate: true,
  geoposition: undefined,
  map: undefined,
  map_view: 'satellite',
  map_provider: 'leaflet',
};

const leafletDefaults: LeafletConfig = {
  map: {
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> Contributors',
    maxZoom: 18,
  },
  satellite: {
    tileLayer:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

let currentLocation: LocationConfig = { ...locationDefaults };
let currentLeaflet: LeafletConfig = JSON.parse(JSON.stringify(leafletDefaults));

export const locationConfig = {
  get: (): LocationConfig => currentLocation,
  set: (partial: Partial<LocationConfig>) => {
    currentLocation = { ...currentLocation, ...partial };
  },
  reset: () => {
    currentLocation = { ...locationDefaults };
  },
} as const;

export const leafletConfig = {
  get: (): Readonly<LeafletConfig> => currentLeaflet,
} as const;
