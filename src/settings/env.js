import { version } from '../config/version';

export const env = {
  socketIo: { tmx: '/tmx' }, // should be set as part of authenticated connection
  activeScale: 'wtn', // TODO: discover activeScale from tournament data
  hotkeys: true,

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
    map_view: 'satellite', // 'map'
    map_provider: 'leaflet', // 'google' or 'leaflet'
  },
  leaflet: {
    map: {
      tileLayer: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> Contributors',
      maxZoom: 18,
    },
    satellite: {
      tileLayer: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
    },
  },
  calendar: {
    start: undefined,
    end: undefined,
    category: undefined,
    first_day: 0,
  },
  scoring: {
    delegationOfficial: false,
    delegation: true,
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
