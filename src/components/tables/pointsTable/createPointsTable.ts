/**
 * Event-level ranking points table.
 * Displays ranking point awards for all participants in an event,
 * with a policy selector to preview different ranking policies.
 * Policies requiring a tournament level show a level picker;
 * the table placeholder explains when no level is selected.
 */
import { getAvailablePolicies, getLevelDisplayLabel, PolicyOption } from './policyUtils';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine } from 'tods-competition-factory';
import { removeAllChildNodes } from 'services/dom/transformers';
import { navigateToEvent } from '../common/navigateToEvent';
import { getPointsColumns } from './getPointsColumns';
import { controlBar } from 'courthive-components';
import { destroyTable } from 'pages/tournament/destroyTable';
import { context } from 'services/context';
import { env } from 'settings/env';

import { EVENT_CONTROL, LEFT, POINTS_VIEW, RIGHT } from 'constants/tmxConstants';

type CreatePointsTableParams = {
  eventId: string;
};

export function createPointsTable({ eventId }: CreatePointsTableParams): void {
  const pointsContainer = document.getElementById(POINTS_VIEW);
  if (!pointsContainer) return;
  removeAllChildNodes(pointsContainer);

  const availablePolicies = getAvailablePolicies();
  if (!availablePolicies.length) return;

  let selectedPolicyId = availablePolicies[0].id;
  let selectedLevel: number | undefined;
  let table: any;

  const getSelectedPolicy = (): PolicyOption | undefined => availablePolicies.find((p) => p.id === selectedPolicyId);

  const computePoints = () => {
    const policy = getSelectedPolicy();
    if (!policy) return [];

    if (policy.requiresLevel && !selectedLevel) return [];

    const result = tournamentEngine.getEventRankingPoints({
      policyDefinitions: policy.policyData,
      level: selectedLevel,
      eventId,
    });

    if (!result?.success) return [];
    return result.eventAwards || [];
  };

  const columns = getPointsColumns();

  const render = () => {
    const policy = getSelectedPolicy();
    const data = computePoints();
    destroyTable({ anchorId: POINTS_VIEW });
    removeAllChildNodes(pointsContainer);

    // Table container
    const tableElement = document.createElement('div');
    tableElement.style.width = '100%';
    pointsContainer.appendChild(tableElement);

    let placeholder = 'No ranking points — check that the policy matches this event';
    if (policy?.requiresLevel && !selectedLevel) {
      placeholder = 'Select a tournament level to calculate ranking points for this policy';
    }

    table = new Tabulator(tableElement, {
      headerSortElement: headerSortElement([
        'participantName',
        'positionPoints',
        'perWinPoints',
        'bonusPoints',
        'qualityWinPoints',
        'points',
        'winCount',
        'rangeAccessor',
      ]),
      height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
      responsiveLayoutCollapseStartOpen: false,
      responsiveLayout: 'collapse',
      layout: 'fitColumns',
      reactiveData: true,
      placeholder,
      columns,
      data,
    });

    context.tables.pointsTable = table;
  };

  render();

  // Build event-level control bar with policy selector, level selector, and back navigation
  const event = tournamentEngine.getEvent({ eventId })?.event;
  const events = tournamentEngine.getEvents()?.events || [];

  const eventOptions = events
    .filter((e: any) => e.eventId !== eventId)
    .map((e: any) => ({
      label: e.eventName,
      close: true,
      onClick: () => navigateToEvent({ eventId: e.eventId, renderPoints: true }),
    }));

  const renderControlBar = () => {
    const policy = getSelectedPolicy();

    const policyOptions = availablePolicies.map((p) => ({
      label: p.requiresLevel ? `${p.label} *` : p.label,
      close: true,
      active: p.id === selectedPolicyId,
      onClick: () => {
        selectedPolicyId = p.id;
        const newPolicy = getSelectedPolicy();
        // Reset level when switching policies
        if (newPolicy?.requiresLevel) {
          selectedLevel = undefined;
        } else {
          selectedLevel = undefined;
        }
        render();
        renderControlBar();
      },
    }));

    const items: any[] = [
      {
        options: eventOptions.length ? eventOptions : undefined,
        label: event?.eventName || 'Event',
        modifyLabel: true,
        location: LEFT,
      },
      {
        label: 'Points',
        location: LEFT,
        intent: 'is-info',
      },
      {
        options: policyOptions,
        label: policy?.label || 'Select policy',
        modifyLabel: true,
        location: RIGHT,
      },
    ];

    // Level selector — only shown when policy requires a level
    if (policy?.requiresLevel) {
      const levelOptions = policy.availableLevels.map((lvl) => ({
        label: getLevelDisplayLabel(lvl, policy),
        close: true,
        active: lvl === selectedLevel,
        onClick: () => {
          selectedLevel = lvl;
          render();
          renderControlBar();
        },
      }));

      const levelLabel = selectedLevel ? getLevelDisplayLabel(selectedLevel, policy) : 'Select level';

      items.push({
        options: levelOptions,
        label: levelLabel,
        modifyLabel: true,
        location: RIGHT,
        intent: !selectedLevel ? 'is-warning' : undefined,
      });
    }

    items.push({
      label: 'Entries',
      location: RIGHT,
      close: true,
      onClick: () => navigateToEvent({ eventId }),
    });

    const eventControlElement = document.getElementById(EVENT_CONTROL) || undefined;
    controlBar({ target: eventControlElement, items });
  };

  renderControlBar();
}
