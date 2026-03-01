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
  SPLASH,
  STRUCTURE,
  SYSTEM,
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

  // Topology routes — standalone page, reuses tournament loading
  router.on(`/${TOURNAMENT}/:tournamentId/topology/:eventId/:drawId/${VIEW}`, (match) => {
    destroyTables();
    displayTournament({
      config: { ...match?.data, selectedTab: 'topology', readOnly: true },
    });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/topology/:eventId/:drawId`, (match) => {
    destroyTables();
    displayTournament({
      config: { ...match?.data, selectedTab: 'topology' },
    });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/topology/:eventId`, (match) => {
    destroyTables();
    displayTournament({
      config: { ...match?.data, selectedTab: 'topology' },
    });
  });

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
  router.on(`/${SYSTEM}/:selectedTab`, (match) => renderSystemPage(match?.data?.selectedTab));
  router.on(`/${SYSTEM}`, () => renderSystemPage());

  router.on(`/actionKey/:key`, (match) => {
    const key = match?.data?.key;
    if (key) queueKey(key);
    router.navigate(`/${TMX_TOURNAMENTS}`);
  });
  router.on('/', () => {
    // During initial load the splash animation is active — show it.
    // On any subsequent navigation to root, go straight to tournaments.
    const splash = document.getElementById(SPLASH);
    if (splash?.dataset.animating) {
      showSplash();
    } else {
      router.navigate(`/${TMX_TOURNAMENTS}`);
    }
  });
  router.notFound(() => {
    const splash = document.getElementById(SPLASH);
    if (splash?.dataset.animating) {
      showSplash();
    } else {
      router.navigate(`/${TMX_TOURNAMENTS}`);
    }
  });
  router.resolve();

  return { success: true };
}
