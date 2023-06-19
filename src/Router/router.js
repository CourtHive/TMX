import { displayTournament } from 'Pages/Tournament/tournamentDisplay';
import { tmxTournaments } from 'Pages/Tournaments/tournaments';
import { showSplash } from 'services/transitions/screenSlaver';
import { renderCalendar } from 'Pages/Tournaments/calendar';
import { context } from 'services/context';
import { coms } from 'services/coms';
import Navigo from 'navigo';

import {
  DRAW,
  DRAW_ENTRIES,
  EVENT,
  TMX_TOURNAMENTS,
  PARTICIPANTS,
  STRUCTURE,
  TOURNAMENT,
  EVENTS_TAB
} from 'constants/tmxConstants';

export function routeTMX() {
  const routerRoot = window.location.host.indexOf('localhost:3333') === 0 ? '/' : process.env.PUBLIC_URL || '/';

  const useHash = true;
  const router = new Navigo(useHash ? '/' : `/${routerRoot}`, { hash: useHash });

  // make accessible
  context.router = router;

  const displayRoute = ({ selectedTab, renderDraw, data }) => {
    displayTournament({ config: { selectedTab, renderDraw, ...data } }); // ...data must come last
  };

  router.on(`/${TOURNAMENT}/:tournamentId`, ({ data }) => {
    displayRoute({ data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/:selectedTab`, ({ data }) => {
    displayRoute({ data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId/${STRUCTURE}/:structureId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW_ENTRIES}/:drawId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${PARTICIPANTS}/:participantView`, ({ data }) => {
    displayRoute({ selectedTab: PARTICIPANTS, data });
  });

  // adding a unique identifer to the URL will force refresh
  router.on(`/${TMX_TOURNAMENTS}/:uuid`, tmxTournaments);
  router.on(`/${TMX_TOURNAMENTS}`, tmxTournaments);

  router.on(`/calendar`, renderCalendar);

  router.on(`/actionKey/:key`, ({ data }) => {
    const key = data.key;
    coms.queueKey(key);
    router.navigate('/');
    showSplash();
  });
  router.on('/', () => {
    showSplash();
  });
  router.notFound(() => {
    router.navigate('/');
    showSplash();
  });
  router.resolve();

  return { success: true };
}
