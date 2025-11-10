export const context: {
  matchUpsToBroadcast: any[];
  tables: any;
  ee: any;
  drawer: any;
  modal: any;
  state: {
    authorized: boolean;
    admin: boolean;
  };
  displayed: {
    selectedScheduleDate: string | null;
    draw_event: any;
  };
  columns: Record<string, any>;
  collectionTables?: any[];
  router?: any;
  provider?: any;
  quill?: any;
  dragMatch?: any;
} = {
  matchUpsToBroadcast: [],
  tables: [],

  ee: null,

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
