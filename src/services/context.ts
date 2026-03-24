import type { ProviderValue } from 'types/tmx';

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
  matchUpFilters: {
    eventId?: string;
    drawId?: string;
    teamId?: string;
    status?: string;
    type?: string;
    search?: string;
  };
  participantFilters: {
    eventId?: string;
    teamId?: string;
    sex?: string;
    search?: string;
  };
  collectionTables?: any[];
  refreshActiveTable?: () => void;
  router?: { navigate: (path: string) => void; resolve: () => void; current: any[] | null };
  provider?: ProviderValue;
  quill?: any;
  dragMatch?: any;
  dragMatchLight?: any;
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
  matchUpFilters: {},
  participantFilters: {},
};
