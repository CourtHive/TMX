import { renderTemplatesPage } from 'pages/templates/renderTemplatesPage';
import { registrationModal } from 'components/modals/registrationModal';
import { ssoLoginWithToken, consumeMagicLink } from 'services/authentication/authApi';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';
import { ensureConnected, queueKey } from 'services/messaging/socketIo';
import { resetActivityTimer } from 'services/staleness/stalenessGuard';
import { renderSettingsPage } from 'pages/settings/renderSettingsPage';
import { renderPolicyCatalogPage } from 'pages/policies/renderPolicyCatalogPage';
import { renderPoliciesPage } from 'pages/policies/renderPoliciesPage';
import { displayTournament } from 'pages/tournament/tournamentDisplay';
import { tmxTournaments } from 'pages/tournaments/tournaments';
import { showSplash } from 'services/transitions/screenSlaver';
import { renderAdminPage } from 'pages/admin/renderAdminPage';
import { destroyTables } from 'pages/tournament/destroyTable';
import { logIn, logOut } from 'services/authentication/loginState';
import {
  forceExitAssignmentMode,
  isAssignmentMode,
} from 'pages/tournament/tabs/eventsTab/renderDraws/participantAssignmentMode';
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
  TOURNAMENT,
  EVENTS_TAB,
  SCHEDULE2_TAB,
  SCHEDULING_TAB,
  VENUES_TAB,
  VENUE,
  TEMPLATES,
  POLICIES,
  SETTINGS,
  INVITE,
  VIEW,
} from 'constants/tmxConstants';

export function routeTMX() {
  const routerRoot = '/';

  const useHash = true;
  const router = new Navigo(useHash ? '/' : `/${routerRoot}`, { hash: useHash });

  // make accessible
  context.router = router;

  // Reconnect socket on any navigation if it was lost
  router.hooks({
    before(done) {
      if (isAssignmentMode()) forceExitAssignmentMode();
      ensureConnected();
      resetActivityTimer();
      done();
    },
  });

  const displayRoute = ({ selectedTab, renderDraw, renderPoints, data }: any) => {
    destroyTables();
    displayTournament({ config: { selectedTab, renderDraw, renderPoints, ...data } }); // ...data must come last
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

  router.on(`/${TOURNAMENT}/:tournamentId/format-wizard`, (match) => {
    displayTournament({
      config: { ...match?.data, selectedTab: 'format-wizard' },
    });
  });

  router.on(`/${TOURNAMENT}/:tournamentId`, (match) => {
    displayRoute({ data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/draws`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderDraw: true, data: match?.data });
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
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/points`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, renderPoints: true, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${EVENT}/:eventId/${DRAW_ENTRIES}/:drawId`, (match) => {
    displayRoute({ selectedTab: EVENTS_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${PARTICIPANTS}/:participantView`, (match) => {
    displayRoute({ selectedTab: PARTICIPANTS, data: match?.data });
  });
  // Bookmarked `/schedule/:date` URLs from before the schedule2 cutover
  // redirect to the new tab.
  router.on(`/${TOURNAMENT}/:tournamentId/schedule/:scheduledDate`, (match) => {
    const tournamentId = match?.data?.tournamentId;
    const scheduledDate = match?.data?.scheduledDate;
    if (tournamentId && scheduledDate) {
      router.navigate(`/${TOURNAMENT}/${tournamentId}/${SCHEDULE2_TAB}/${scheduledDate}`);
    }
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${SCHEDULE2_TAB}/:scheduledDate/:scheduleView`, (match) => {
    displayRoute({ selectedTab: SCHEDULE2_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${SCHEDULE2_TAB}/:scheduledDate`, (match) => {
    displayRoute({ selectedTab: SCHEDULE2_TAB, data: match?.data });
  });
  // New unified scheduling workspace (Option C — in flight). Old /schedule2/* and
  // /venues/availability routes still work; 301 redirects land after the three modes
  // are fully wired through the workspace queue.
  router.on(`/${TOURNAMENT}/:tournamentId/${SCHEDULING_TAB}/:scheduledDate/:schedulingMode`, (match) => {
    displayRoute({ selectedTab: SCHEDULING_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${SCHEDULING_TAB}/:scheduledDate`, (match) => {
    displayRoute({ selectedTab: SCHEDULING_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${SCHEDULING_TAB}`, (match) => {
    displayRoute({ selectedTab: SCHEDULING_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${VENUES_TAB}/:venueView`, (match) => {
    displayRoute({ selectedTab: VENUES_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/${VENUE}/:venueId`, (match) => {
    displayRoute({ selectedTab: VENUES_TAB, data: match?.data });
  });
  router.on(`/${TOURNAMENT}/:tournamentId/:selectedTab`, (match) => {
    displayRoute({ data: match?.data });
  });

  // adding a unique identifer to the URL will force refresh
  router.on(`/${TMX_TOURNAMENTS}/:uuid`, tmxTournaments);
  router.on(`/${TMX_TOURNAMENTS}`, tmxTournaments);

  router.on(`/${INVITE}/:inviteKey`, registrationModal);

  // SSO login: provisioner redirects user here with a one-time token
  router.on('/sso', async () => {
    const params = new URLSearchParams(globalThis.location?.hash?.split('?')[1] ?? '');
    const token = params.get('token');
    if (token) {
      try {
        const res = await ssoLoginWithToken(token);
        if (res?.status === 200 && res.data?.accessToken) {
          logIn({ data: { token: res.data.accessToken, refreshToken: res.data.refreshToken } });
        } else {
          logOut();
        }
      } catch {
        logOut();
      }
    } else {
      router.navigate(`/${TMX_TOURNAMENTS}`);
    }
  });

  // Magic-link login: the email lands the user on `#/magic/:code`. The code is
  // single-use and consumed server-side for an access + refresh session.
  router.on('/magic/:code', async (match) => {
    const code = match?.data?.code;
    if (!code) {
      router.navigate(`/${TMX_TOURNAMENTS}`);
      return;
    }
    try {
      const res = await consumeMagicLink(code);
      if (res?.status === 200 && res.data?.token) {
        logIn({ data: res.data });
      } else {
        tmxToast({ intent: 'is-danger', message: t('toasts.magicLinkInvalid') });
        router.navigate(`/${TMX_TOURNAMENTS}`);
      }
    } catch {
      tmxToast({ intent: 'is-danger', message: t('toasts.magicLinkInvalid') });
      router.navigate(`/${TMX_TOURNAMENTS}`);
    }
  });

  router.on(`/${TEMPLATES}/:templateView`, (match) => renderTemplatesPage(match?.data ?? undefined));
  router.on(`/${TEMPLATES}`, () => renderTemplatesPage());
  router.on(`/${POLICIES}/catalog`, renderPolicyCatalogPage);
  router.on(`/${POLICIES}`, renderPoliciesPage);
  router.on(`/${SETTINGS}`, renderSettingsPage);
  router.on('/admin', renderAdminPage);
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
