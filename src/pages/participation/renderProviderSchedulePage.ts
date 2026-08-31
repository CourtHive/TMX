/**
 * Provider schedule page — `/#/provider/:providerId/schedule`.
 *
 * The last link in schedule-≠-calendar. A tournament lives in exactly ONE provider's calendar
 * (`detachFromOtherCalendars` enforces it), so a college dual — which belongs to the seasons of TWO
 * programmes — is deliberately in no calendar at all. The season shells that ARE in the calendar
 * are empty on purpose. This page is therefore the only surface that can answer "when does this
 * programme play"; it reads the participation index rather than any calendar.
 *
 * WHY ITS OWN ROUTE rather than a tab on the tournaments page:
 *
 *   1. The URL has to name the SUBJECT. A calendar is keyed on its owner, a schedule on the
 *      competitor. A tab would inherit the calendar page's identity and re-fuse the two concepts
 *      the read model exists to separate.
 *   2. `:providerId` in the path is what makes a season reachable for a subject that is NOT the
 *      active provider — including the known case of a programme whose fixtures sit under an id no
 *      team page issues. A tab reads the impersonation context and could never address that,
 *      leaving an alias as the only way to reach it, which is exactly what was ruled out.
 *   3. A season is a link worth sending someone. Tab state is not.
 *
 * NOT DONE, deliberately: nothing here folds fixtures into a calendar, and nothing infers a
 * "season" from dates. Both were considered upstream and rejected with reasons.
 */
import { hasGlobalAdminRole } from 'services/authentication/hasGlobalAdminRole';
import { getParticipation, getProvider } from 'services/apis/servicesApi';
import { showProviderSchedule } from 'services/transitions/screenSlaver';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { homeNavigation } from 'homeNavigation';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  buildScheduleHeader,
  renderScheduleEmpty,
  renderScheduleError,
  renderScheduleGroups,
  renderScheduleSkeleton,
} from './providerScheduleView';
import { groupEntriesByYear, readParticipationResponse, SUBJECT_TYPE_TEAM } from './participationEntries';

import {
  PARTICIPATION_CONTROL,
  TMX_PARTICIPATION,
  TMX_TOURNAMENTS,
  TOURNAMENT,
  SCHEDULE,
} from 'constants/tmxConstants';

/**
 * Guards a render against a route change that happened while a fetch was in flight. Two requests
 * are outstanding at once (the subject's name and its fixtures) and either can resolve after the
 * user has moved on; painting then would show one programme's season under another's heading.
 */
let renderToken = 0;

function toTournaments(): void {
  context.router?.navigate(`/${TMX_TOURNAMENTS}`);
}

function openFixture(tournamentId: string): void {
  if (!tournamentId) return;
  // Mirrors the tournaments grid: reset the engine before routing so the incoming record is not
  // read against the previous tournament's state.
  tournamentEngine.reset();
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}`);
}

/**
 * The best name we can honestly put on the page.
 *
 * Falls back to the subject id rather than to a placeholder. The id is not decoration: a programme
 * whose fixtures sit under an id that has no provider row is a REAL, recorded state of this data,
 * and showing the id is what lets an operator recognise it. "Unknown provider" would hide exactly
 * the thing worth seeing.
 */
async function resolveSubjectLabel(providerId: string): Promise<string> {
  const active = context.provider;
  if (active?.organisationId === providerId && active.organisationName) return active.organisationName;
  try {
    const response: any = await getProvider({ providerId });
    return response?.data?.provider?.organisationName ?? providerId;
  } catch {
    // A name is presentation; the fixtures are the page. Never let the lookup decide whether the
    // schedule loads at all.
    return providerId;
  }
}

interface ScheduleAnchors {
  control: HTMLElement;
  list: HTMLElement;
}

function mountPage(container: HTMLElement): ScheduleAnchors {
  const control = document.createElement('div');
  control.className = 'controlBar flexcol flexgrow flexcenter';
  control.id = PARTICIPATION_CONTROL;

  const list = document.createElement('div');
  list.className = 'flexcol flexgrow tmx-schedule-body';

  container.replaceChildren(control, list);
  return { control, list };
}

async function loadSchedule(anchors: ScheduleAnchors, providerId: string, subjectLabel: string): Promise<void> {
  const token = renderToken;
  const response = await getParticipation({ subjectType: SUBJECT_TYPE_TEAM, subjectId: providerId });
  if (token !== renderToken) return;

  const result = readParticipationResponse(response);

  if (result.status === 'error') {
    // A fault must not be rendered as "no fixtures". The count stays blank because there is no
    // count to report — see participationEntries for why the two states are kept apart.
    anchors.control.replaceChildren(buildScheduleHeader({ subjectLabel }));
    renderScheduleError(anchors.list, () => {
      renderScheduleSkeleton(anchors.list);
      void loadSchedule(anchors, providerId, subjectLabel);
    });
    return;
  }

  anchors.control.replaceChildren(buildScheduleHeader({ subjectLabel, fixtureCount: result.entries.length }));

  if (result.entries.length === 0) {
    renderScheduleEmpty(anchors.list);
    return;
  }

  renderScheduleGroups(anchors.list, groupEntriesByYear(result.entries), openFixture);
}

export function renderProviderSchedulePage(data?: { providerId?: string }): void {
  const providerId = data?.providerId;
  if (!providerId) {
    toTournaments();
    return;
  }

  // Route-level guard, not just a hidden nav icon. A bookmark, a shared link, browser history or a
  // typed hash all reach this route directly, and the participation route is `@Roles([ADMIN,
  // SUPER_ADMIN])` — a PROVIDER_ADMIN who got here would see only a load failure, which reads as an
  // outage rather than as a permission they do not have.
  if (!hasGlobalAdminRole()) {
    tmxToast({ intent: 'is-warning', message: t('pages.participation.adminOnly') });
    toTournaments();
    return;
  }

  showProviderSchedule(t('pages.participation.title'));
  homeNavigation(SCHEDULE);

  const container = document.getElementById(TMX_PARTICIPATION);
  if (!container) return;

  const token = ++renderToken;
  const anchors = mountPage(container);

  // The id is a truthful label on its own, so the page paints immediately and sharpens when the
  // provider lookup lands — rather than withholding the fixtures behind a name.
  anchors.control.replaceChildren(buildScheduleHeader({ subjectLabel: providerId }));
  renderScheduleSkeleton(anchors.list);

  void resolveSubjectLabel(providerId).then((subjectLabel) => {
    if (token !== renderToken) return;
    return loadSchedule(anchors, providerId, subjectLabel);
  });
}
