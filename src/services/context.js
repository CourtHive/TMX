export const context = {
  matchUpsToBroadcast: [],
  tables: [],

  ee: null, // EventEmitter

  drawer: null,
  modal: null,

  state: {
    authorized: false,
    admin: false,
  },

  displayed: {
    schedule_day: null,
    draw_event: null,
  },

  columns: {},
};
