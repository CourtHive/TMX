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
    selectedScheduleDate: null,
    draw_event: null,
  },

  columns: {},
};
