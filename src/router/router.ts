import { registrationModal } from 'components/modals/registrationModal';
import { displayTournament } from 'pages/tournament/tournamentDisplay';
import { tmxTournaments } from 'pages/tournaments/tournaments';
import { showSplash } from 'services/transitions/screenSlaver';
import { destroyTables } from 'pages/tournament/destroyTable';
import { renderCalendar } from 'pages/tournaments/calendar';
import { queueKey } from 'services/messaging/socketIo';
import { context } from 'services/context';
import Navigo from 'navigo';

import {
  DRAW,
  DRAW_ENTRIES,
  EVENT,
  TMX_TOURNAMENTS,
  PARTICIPANTS,
  STRUCTURE,
  TOURNAMENT,
  EVENTS_TAB,
  SCHEDULE_TAB,
  INVITE,
  VIEW,
} from 'constants/tmxConstants';

export function routeTMX() {
  const routerRoot = '/';

  const useHash = true;
  const router = new Navigo(useHash ? '/' : `/${routerRoot}`, { hash: useHash });

  // make accessible
  context.router = router;

  const displayRoute = ({ selectedTab, renderDraw, data }: any) => {
    destroyTables();
    displayTournament({ config: { selectedTab, renderDraw, ...data } }); // ...data must come last
  };

  router.on(`/${TOURNAMENT}/:tournamentId`, ({ data }) => {
    displayRoute({ data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId/${VIEW}/:roundsView`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId/${STRUCTURE}/:structureId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data });
  });
  router.on(
    `/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId/${STRUCTURE}/:structureId/${VIEW}/:roundsView`,
    ({ data }) => {
      displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data });
    },
  );
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW_ENTRIES}/:drawId`, ({ data }) => {
    displayRoute({ selectedTab: EVENTS_TAB, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${PARTICIPANTS}/:participantView`, ({ data }) => {
    displayRoute({ selectedTab: PARTICIPANTS, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${SCHEDULE_TAB}/:scheduledDate`, ({ data }) => {
    displayRoute({ selectedTab: SCHEDULE_TAB, data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/:selectedTab`, ({ data }) => {
    displayRoute({ data });
  });

  // adding a unique identifer to the URL will force refresh
  router.on(`/${TMX_TOURNAMENTS}/:uuid`, tmxTournaments);
  router.on(`/${TMX_TOURNAMENTS}`, tmxTournaments);

  router.on(`/${INVITE}/:inviteKey`, registrationModal);

  router.on(`/calendar`, renderCalendar);

  router.on(`/actionKey/:key`, ({ data }) => {
    const key = data.key;
    queueKey(key);
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
