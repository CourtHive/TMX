/**
 * Topology Templates — Save/load/delete templates via tournament extensions.
 * Extension name: topologyTemplates
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';

import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';

import type { TopologyState, TopologyTemplate } from 'courthive-components';

const TopologyTemplates = 'topologyTemplates';

export function getTopologyTemplates(): TopologyTemplate[] {
  const { extension } = tournamentEngine.findExtension({ discover: true, name: TopologyTemplates }) || {};
  return extension?.value || [];
}

export function saveTopologyTemplate({
  state,
  name,
  description,
  callback,
}: {
  state: TopologyState;
  name: string;
  description?: string;
  callback?: () => void;
}): void {
  const existing = getTopologyTemplates();

  // Remove selection state for storage
  const templateState = {
    drawName: state.drawName,
    nodes: state.nodes,
    edges: state.edges,
  };

  const newTemplate: TopologyTemplate = {
    name,
    description,
    state: templateState,
  };

  // Replace if name exists, otherwise append
  const existingIndex = existing.findIndex((t) => t.name === name);
  if (existingIndex >= 0) {
    existing[existingIndex] = newTemplate;
  } else {
    existing.push(newTemplate);
  }

  const methods = [
    {
      method: ADD_TOURNAMENT_EXTENSION,
      params: {
        extension: {
          name: TopologyTemplates,
          value: existing,
        },
      },
    },
  ];

  mutationRequest({
    methods,
    callback: () => {
      tmxToast({ message: `Template "${name}" saved`, intent: 'is-success' });
      if (callback) callback();
    },
  });
}

export function deleteTopologyTemplate({ name, callback }: { name: string; callback?: () => void }): void {
  const existing = getTopologyTemplates();
  const filtered = existing.filter((t) => t.name !== name);

  const methods = [
    {
      method: ADD_TOURNAMENT_EXTENSION,
      params: {
        extension: {
          name: TopologyTemplates,
          value: filtered,
        },
      },
    },
  ];

  mutationRequest({
    methods,
    callback: () => {
      tmxToast({ message: `Template "${name}" deleted`, intent: 'is-info' });
      if (callback) callback();
    },
  });
}
