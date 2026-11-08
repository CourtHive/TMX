import type { SchedulePageCatalogState } from 'courthive-components';

import type { ProviderValue } from 'types/tmx';

export const context: {
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
    /** chip / choice filters: the values selected; absent when there is no filter */
    eventIds?: string[];
    drawIds?: string[];
    teamId?: string;
    status?: string;
    /** chip filters: the values that are on; absent when every chip is on */
    profile?: string[];
    type?: string[];
    statusBuckets?: string[];
    search?: string;
    scheduledDate?: string;
  };
  participantFilters: {
    eventId?: string;
    teamId?: string;
    sex?: string;
    search?: string;
  };
  collectionTables?: any[];
  refreshActiveTable?: () => void;
  router?: {
    navigate: (path: string, options?: Record<string, any>) => void;
    resolve: () => void;
    current: any[] | null;
  };
  provider?: ProviderValue;
  dragMatch?: any;
  dragMatchLight?: any;
  /** schedule2 matchUp catalog filter state, persisted across tab navigation
   *  within a single tournament. Cleared on tournament load. */
  scheduleCatalogState?: SchedulePageCatalogState;
} = {
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
