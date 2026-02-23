import { registrationModal } from 'components/modals/registrationModal';
import { displayTournament } from 'pages/tournament/tournamentDisplay';
import { tmxTournaments } from 'pages/tournaments/tournaments';
import { showSplash } from 'services/transitions/screenSlaver';
import { destroyTables } from 'pages/tournament/destroyTable';
import { renderCalendar } from 'pages/tournaments/calendar';
import { renderAdminPage } from 'pages/admin/renderAdminPage';
import { renderSystemPage } from 'pages/system/renderSystemPage';
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

  router.on(`/${TOURNAMENT}/:tournamentId`, (match) => {
    displayRoute({ data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId/${VIEW}/:roundsView`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId/${STRUCTURE}/:structureId`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data: match?.data });
  });
  router.on(
    `/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW}/:drawId/${STRUCTURE}/:structureId/${VIEW}/:roundsView`,
    (match) => {
      displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data: match?.data });
    },
  );
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW_ENTRIES}/:drawId`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${PARTICIPANTS}/:participantView`, (match) => {
    displayRoute({ selectedTab: PARTICIPANTS, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${SCHEDULE_TAB}/:scheduledDate`, (match) => {
    displayRoute({ selectedTab: SCHEDULE_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/:selectedTab`, (match) => {
    displayRoute({ data: match?.data });
  });

  // adding a unique identifer to the URL will force refresh
  router.on(`/${TMX_TOURNAMENTS}/:uuid`, tmxTournaments);
  router.on(`/${TMX_TOURNAMENTS}`, tmxTournaments);

  router.on(`/${INVITE}/:inviteKey`, registrationModal);

  router.on(`/calendar`, renderCalendar);
  router.on('/admin', renderAdminPage);
  router.on('/system', renderSystemPage);

  router.on(`/actionKey/:key`, (match) => {
    const key = match?.data?.key;
    if (key) queueKey(key);
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
