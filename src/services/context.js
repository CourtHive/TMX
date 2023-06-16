export const context = {
  tables: [],

  ee: null, // EventEmitter
  dfx: null,
  draws: {},
  rrDraw: null,
  treeDraw: null,
  draw_types: [],

  display: null,
  displayTab: null, // function to switch tabs programatically

  ccTime: 0, // contextClick time; used to prevent Safari event propagation to click

  state: {
    edit: false,
    admin: false,
    authorized: false,
    lastCloudSave: false,
    exportPlayerDB: false,
    manual_ranking: false,
    manual_pin: undefined
  },

  settings: {
    fetchRegisteredPlayers: false
  },

  // keep track of displayed components
  displayed: {
    team: null,
    euid: null,
    location: null,
    draw_event: null,
    schedule_day: null,
    dual_match: null,
    players: {
      not_signed_in: true
    }
  },

  player_views: {
    section_scroll: undefined,
    doubles_rankings: false,
    dynamic_ratings: false
  },

  schedule_filters: {
    event: '',
    round: '',
    court: '',
    teamid: ''
  },

  event_config: null,
  filters: []
};
