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
 * Various parts of the application dynamically add or modify properties at runtime.
 *
 * CAUTION: Do not add TypeScript type constraints (interfaces, type assertions) to this
 * object as they can interfere with runtime property additions and cause initialization
 * failures or navigation issues. The `any` type is intentional and necessary.
 *
 * ============================================================================
 * RUNTIME PROPERTIES - Set/Modified Dynamically
 * ============================================================================
 *
 * DEVICE & DISPLAY:
 * - env.device: Device capabilities { isMobile, isTouch, etc. } - Set during initialization
 * - env.composition: Display composition settings - Set when user configures draw display
 *
 * MUTATION & PERSISTENCE:
 * - env.serverFirst: (default true) Execute mutations on server first, then locally
 *                    If false, executes locally first, then sends to server
 * - env.saveLocal: Auto-save tournament records to IndexedDB after mutations
 * - env.serverTimeout: (default 10000) Milliseconds to wait for server ack before reporting failure
 *
 * RATING SCALES:
 * - env.activeScale: Current rating scale ('wtn' or 'utr') - Changed by user or programmatically
 * - env.scales: Scale configuration { wtn: {...}, utr: {...} } with accessor, color, etc.
 *
 * LOCATION & MAPPING:
 * - env.locations.map: Leaflet map instance - Set when map is initialized
 * - env.locations.geoposition: User's geolocation { lat, lng } - Set when geolocation succeeds
 * - env.locations.map_view: Map display mode ('map' or 'satellite')
 * - env.locations.map_provider: Map provider ('leaflet')
 * - env.locations.geolocate: Enable/disable geolocation
 *
 * SOCKET.IO COMMUNICATION:
 * - env.socketPath: Socket.IO server path - Overrides process.env.SERVER if set
 * - env.socketIo: Socket configuration { tmx: '/tmx' }
 *
 * DEBUGGING & LOGGING:
 * - env.log.verbose: Enable verbose logging for mutations and operations
 * - env.averages: Show rating averages in console (participants table)
 * - env.renderLog: Log draw rendering operations
 * - env.devNotes: Log matchUp modifications
 *
 * USER INTERFACE:
 * - env.hotkeys: Enable keyboard shortcuts for match scoring
 * - env.scoring: Enable scoring modal (vs direct score entry)
 *
 * DATA STORAGE:
 * - env.messages: Array of application messages - Accumulates throughout session
 * - env.ioc: Country code for internationalization (default: 'gbr')
 *
 * ============================================================================
 *
 * @example
 * // Setting active rating scale
 * env.activeScale = 'utr';
 *
 * @example
 * // Enable verbose logging
 * env.log = { verbose: true };
 *
 * @example
 * // Execute mutations locally first (offline mode)
 * env.serverFirst = false;
 *
 * @example
 * // Enable auto-save to IndexedDB
 * env.saveLocal = true;
 */
import { version } from '../config/version';

export const env: any = {
  socketIo: { tmx: '/tmx' },
  activeScale: 'wtn',
  hotkeys: false,
  scoring: false,
  
  // Scoring modal configuration (courthive-components)
  scoringApproach: 'dynamicSets', // 'freeScore' | 'dynamicSets' | 'dialPad'
  smartComplements: false, // Auto-fill complement scores (6 → 6-4, Shift+6 → 4-6)
  composition: undefined, // Set dynamically by display settings modal or draw extension

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

  pdfPrinting: false, // Beta feature flag for PDF generation
  persistInputFields: true, // Keep input fields visible after participant assignment (default ON)

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
    minCourtGridRows: 10,
  },
  messages: [],
  device: {},
};
