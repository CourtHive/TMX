/**
 * Environment configuration and settings.
 * Application-wide configuration for scales, locations, scoreboard, and display options.
 */
import { version } from '../config/version';

interface Scale {
  accessor: string;
  scaleType: string;
  scaleColor: string;
  scaleName: string;
  fallback: boolean;
}

interface LeafletConfig {
  tileLayer: string;
  attribution: string;
  maxZoom?: number;
}

interface ScoreboardSettings {
  max_sets: number;
  sets_to_win: number;
  games_for_set: number;
  tiebreak_to: number;
  tiebreaks_at: number;
  supertiebreak_to: number;
  final_set_tiebreak: boolean;
  final_set_supertiebreak: boolean;
}

export const env = {
  socketIo: { tmx: '/tmx' },
  activeScale: 'wtn',
  hotkeys: false,
  scoring: false,

  scales: {
    utr: {
      accessor: 'utrRating',
      scaleType: 'RATING',
      scaleColor: 'blue',
      scaleName: 'UTR',
      fallback: true,
    } as Scale,
    wtn: {
      accessor: 'wtnRating',
      scaleType: 'RATING',
      scaleColor: 'red',
      scaleName: 'WTN',
      fallback: true,
    } as Scale,
  },

  serverFirst: true,
  version,

  ioc: 'gbr',
  locations: {
    geolocate: true,
    geoposition: undefined as any,
    map: undefined as any,
    map_view: 'satellite',
    map_provider: 'leaflet',
  },
  leaflet: {
    map: {
      tileLayer: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> Contributors',
      maxZoom: 18,
    } as LeafletConfig,
    satellite: {
      tileLayer: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
    } as LeafletConfig,
  },
  scoreboard: {
    matchFormats: {
      categories: {} as Record<string, any>,
      singles: 'SET3-S:6/TB7',
      doubles: 'SET3-S:6/TB7-F:TB10',
    },
    options: {
      bestof: [1, 3, 5],
      setsto: [4, 6, 8, 9],
      tiebreaksto: [5, 7, 12],
      supertiebreakto: [7, 10, 21],
    },
    settings: {
      singles: {
        max_sets: 3,
        sets_to_win: 2,
        games_for_set: 6,
        tiebreak_to: 7,
        tiebreaks_at: 6,
        supertiebreak_to: 10,
        final_set_tiebreak: true,
        final_set_supertiebreak: false,
      } as ScoreboardSettings,
      doubles: {
        max_sets: 3,
        sets_to_win: 2,
        games_for_set: 6,
        tiebreak_to: 7,
        tiebreaks_at: 6,
        supertiebreak_to: 10,
        final_set_tiebreak: false,
        final_set_supertiebreak: true,
      } as ScoreboardSettings,
    },
  },
  printing: {
    pageSize: 'A4',
  },
  schedule: {
    teams: true,
    clubs: true,
    time24: true,
    ioc_codes: false,
    default_time: '9:00',
    scores_in_draw_order: true,
    completed_matches_in_search: false,
    max_matches_per_court: 14,
    court_identifiers: true,
  },
  messages: [] as any[],
  device: {} as Record<string, any>,
  averages: false, // show averages in console
  log: { verbose: false } as any, // enable logging
  saveLocal: true, // save locally
  composition: {} as any, // composition settings
};
