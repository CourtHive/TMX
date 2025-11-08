/**
 * Environment configuration and settings.
 *
 * Global application configuration object that contains runtime settings for:
 * - Rating scales (WTN, UTR)
 * - Location and mapping services
 * - Scoreboard and match format settings
 * - Schedule display preferences
 * - Device-specific configurations
 *
 * RUNTIME MUTABILITY:
 * This object is typed as `any` to preserve full JavaScript mutability.
 * Various parts of the application dynamically add or modify properties at runtime:
 *
 * Properties added dynamically:
 * - env.device: Populated with device capabilities during initialization
 * - env.composition: Set when user configures display settings
 * - env.saveLocal: Modified when user changes save preferences
 * - env.log: Can be set to enable verbose logging
 * - env.averages: Toggle for showing averages in console
 *
 * Properties modified at runtime:
 * - env.activeScale: Changed when switching between WTN/UTR rating systems
 * - env.locations.map: Set when map is initialized
 * - env.locations.geoposition: Set when geolocation succeeds
 * - env.messages: Array that accumulates application messages
 *
 * CAUTION: Do not add TypeScript type constraints (interfaces, type assertions) to this
 * object as they can interfere with runtime property additions and cause initialization
 * failures or navigation issues. The `any` type is intentional and necessary.
 *
 * @example
 * // Setting active scale
 * env.activeScale = 'utr';
 *
 * @example
 * // Adding device info at runtime
 * env.device = { isMobile: true, isTouch: true };
 *
 * @example
 * // Modifying composition settings
 * env.composition = { genderColor: true, flags: false };
 */
import { version } from '../config/version';

export const env: any = {
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
    },
    wtn: {
      accessor: 'wtnRating',
      scaleType: 'RATING',
      scaleColor: 'red',
      scaleName: 'WTN',
      fallback: true,
    },
  },

  serverFirst: true,
  version,

  ioc: 'gbr',
  locations: {
    geolocate: true,
    geoposition: undefined,
    map: undefined,
    map_view: 'satellite',
    map_provider: 'leaflet',
  },
  leaflet: {
    map: {
      tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> Contributors',
      maxZoom: 18,
    },
    satellite: {
      tileLayer: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
    },
  },
  scoreboard: {
    matchFormats: {
      categories: {},
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
      },
      doubles: {
        max_sets: 3,
        sets_to_win: 2,
        games_for_set: 6,
        tiebreak_to: 7,
        tiebreaks_at: 6,
        supertiebreak_to: 10,
        final_set_tiebreak: false,
        final_set_supertiebreak: true,
      },
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
  messages: [],
  device: {},
};
