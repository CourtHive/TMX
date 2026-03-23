/**
 * Empty state panel for VOLUNTARY_CONSOLATION structures (non-AD_HOC).
 * Shows "Select eligible participants" button that triggers participant selection,
 * adds entries, generates the draw locally, and attaches via mutation.
 */
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  positionActionConstants,
  tournamentEngine,
} from 'tods-competition-factory';

// constants
import { ADD_DRAW_ENTRIES, ATTACH_CONSOLATION_STRUCTURES } from 'constants/mutationConstants';
import { DRAWS_VIEW } from 'constants/tmxConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;
const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { VOLUNTARY_CONSOLATION, ROUND_ROBIN } = drawDefinitionConstants;

type GenerateVoluntaryConsolationPanelParams = {
  structure: any;
  drawId: string;
  eventId: string;
  callback?: (params?: any) => void;
};

export function generateVoluntaryConsolationPanel({
  structure,
  drawId,
  eventId,
  callback,
}: GenerateVoluntaryConsolationPanelParams): void {
  const generatePanel = document.createElement('div');
  generatePanel.className = 'flexcol flexcenter';
  generatePanel.style.width = '100%';
  generatePanel.style.height = '300px';

  const button = document.createElement('button');
  button.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    selectEligibleParticipants({ structure, drawId, eventId, callback });
  };
  button.className = 'button is-info';
  button.innerHTML = t('modals.addConsolation.selectEligible');
  generatePanel.appendChild(button);

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (drawsView) drawsView.appendChild(generatePanel);
}

function selectEligibleParticipants({ structure, drawId, eventId, callback }: GenerateVoluntaryConsolationPanelParams) {
  const eligible = tournamentEngine.getEligibleVoluntaryConsolationParticipants({ drawId });
  const eligibleParticipantIds = (eligible?.eligibleParticipants || []).map((p: any) => p.participantId);

  if (!eligibleParticipantIds.length) {
    tmxToast({ message: 'No eligible participants found', intent: 'is-warning' });
    return;
  }

  const participantsAvailable = tournamentEngine.getParticipants({
    participantFilters: { participantIds: eligibleParticipantIds },
  }).participants;

  const action = {
    type: ASSIGN_PARTICIPANT,
    participantsAvailable,
  };

  const onSelection = (result: any) => {
    const selectedIds = result.selected?.map(({ participantId }: any) => participantId);
    if (!selectedIds?.length) return;
    addEntriesAndGenerate({ selectedIds, structure, drawId, eventId, callback });
  };

  selectParticipant({
    title: t('modals.addConsolation.selectEligible'),
    selectedParticipantIds: eligibleParticipantIds,
    activeOnEnter: true,
    selectionLimit: 99,
    onSelection,
    action,
  });
}

function addEntriesAndGenerate({
  selectedIds,
  structure,
  drawId,
  eventId,
  callback,
}: {
  selectedIds: string[];
  structure: any;
  drawId: string;
  eventId: string;
  callback?: (params?: any) => void;
}) {
  // Step 1: Add selected participants as entries to the VOLUNTARY_CONSOLATION stage
  const entryMethods = [
    {
      method: ADD_DRAW_ENTRIES,
      params: {
        entryStatus: DIRECT_ACCEPTANCE,
        entryStage: VOLUNTARY_CONSOLATION,
        participantIds: selectedIds,
        ignoreStageSpace: true,
        eventId,
        drawId,
      },
    },
  ];

  mutationRequest({
    methods: entryMethods,
    callback: (entryResult: any) => {
      if (!entryResult.success) {
        tmxToast({ message: entryResult.error?.message || 'Error adding entries', intent: 'is-danger' });
        return;
      }

      // Step 2: Read stored VC config for draw type preference (RR stores config in extension)
      const { drawDefinition } = tournamentEngine.getEvent({ drawId });
      const vcConfig = drawDefinition?.extensions?.find((e: any) => e.name === 'voluntaryConsolationConfig')?.value;
      const drawType = vcConfig?.drawType;
      const structureOptions =
        drawType === ROUND_ROBIN && vcConfig?.groupSize ? { groupSize: vcConfig.groupSize } : undefined;

      // Step 3: Generate structure locally so client and server use identical UUIDs
      const genResult = tournamentEngine.generateVoluntaryConsolation({
        structureName: structure.structureName,
        attachConsolation: false,
        automated: true,
        structureOptions,
        drawType,
        drawId,
      });

      if (genResult.error) {
        tmxToast({ message: genResult.error?.message || 'Error generating draw', intent: 'is-danger' });
        return;
      }

      // Step 4: Attach generated structures via mutation (client/server UUID consistency)
      const attachMethods = [
        {
          method: ATTACH_CONSOLATION_STRUCTURES,
          params: {
            structures: genResult.structures,
            links: genResult.links,
            drawId,
          },
        },
      ];

      mutationRequest({
        methods: attachMethods,
        callback: (attachResult: any) => {
          if (attachResult.success) {
            tmxToast({ message: t('modals.addConsolation.structureAdded'), intent: 'is-success' });
            isFunction(callback) && callback?.({ refresh: true });
          } else {
            tmxToast({ message: attachResult.error?.message || 'Error attaching structure', intent: 'is-danger' });
          }
        },
      });
    },
  });
}
