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
import { getPointsColumns } from './getPointsColumns';
import { controlBar } from 'courthive-components';
import { destroyTable } from 'pages/tournament/destroyTable';
import { context } from 'services/context';
import { env } from 'settings/env';

import { POINTS_VIEW, RIGHT } from 'constants/tmxConstants';

type CreatePointsTableParams = {
  eventId: string;
};

type CreatePointsTableResult = {
  policyControlsElement?: HTMLElement;
};

export function createPointsTable({ eventId }: CreatePointsTableParams): CreatePointsTableResult {
  const pointsContainer = document.getElementById(POINTS_VIEW);
  if (!pointsContainer) return {};
  removeAllChildNodes(pointsContainer);

  const availablePolicies = getAvailablePolicies();
  if (!availablePolicies.length) return {};

  let selectedPolicyId = availablePolicies[0].id;
  let selectedLevel: number | undefined;
  let table: any;

  const getSelectedPolicy = (): PolicyOption | undefined => availablePolicies.find((p) => p.id === selectedPolicyId);

  // Build a participantId → participant lookup for enriching awards
  const buildParticipantMap = () => {
    const { participants = [] } =
      tournamentEngine.getParticipants({
        participantFilters: { eventIds: [eventId] },
        withIndividualParticipants: true,
        withScaleValues: true,
        withISO2: true,
      }) ?? {};
    const map: Record<string, any> = {};
    for (const p of participants) {
      map[p.participantId] = p;
    }
    return map;
  };

  const participantMap = buildParticipantMap();

  const computePoints = () => {
    const policy = getSelectedPolicy();
    if (!policy) return [];

    if (policy.requiresLevel && !selectedLevel) return [];

    let result: any;
    try {
      result = tournamentEngine.getEventRankingPoints({
        policyDefinitions: policy.policyData,
        level: selectedLevel,
        eventId,
      });
    } catch {
      return [];
    }

    if (!result?.success) return [];

    // Enrich awards with full participant objects
    return (result.eventAwards || []).map((award: any) => ({
      ...award,
      participant: participantMap[award.participantId],
    }));
  };

  const columns = getPointsColumns();

  // Container for policy/level selector controls (rendered into tabs bar)
  const policyControlsElement = document.createElement('div');
  policyControlsElement.style.cssText = 'display: flex; align-items: center; gap: 0.25em;';

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

  const renderPolicyControls = () => {
    const policy = getSelectedPolicy();
    policyControlsElement.innerHTML = '';

    const policyOptions = availablePolicies.map((p) => ({
      label: p.requiresLevel ? `${p.label} *` : p.label,
      close: true,
      active: p.id === selectedPolicyId,
      onClick: () => {
        selectedPolicyId = p.id;
        selectedLevel = undefined;
        render();
        renderPolicyControls();
      },
    }));

    const policyEl = document.createElement('div');
    controlBar({
      target: policyEl,
      items: [
        {
          options: policyOptions,
          label: policy?.label || 'Select policy',
          modifyLabel: true,
          intent: 'is-info',
          location: RIGHT,
          align: RIGHT,
        },
      ],
    });
    policyControlsElement.appendChild(policyEl);

    // Level selector — only shown when policy requires a level
    if (policy?.requiresLevel) {
      const levelOptions = policy.availableLevels.map((lvl) => ({
        label: getLevelDisplayLabel(lvl, policy),
        close: true,
        active: lvl === selectedLevel,
        onClick: () => {
          selectedLevel = lvl;
          render();
          renderPolicyControls();
        },
      }));

      const levelLabel = selectedLevel ? getLevelDisplayLabel(selectedLevel, policy) : 'Select level';

      const levelEl = document.createElement('div');
      controlBar({
        target: levelEl,
        items: [
          {
            options: levelOptions,
            label: levelLabel,
            modifyLabel: true,
            location: RIGHT,
            intent: 'is-warning',
          },
        ],
      });
      policyControlsElement.appendChild(levelEl);
    }
  };

  render();
  renderPolicyControls();

  return { policyControlsElement };
}
