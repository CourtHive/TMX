/**
 * Add draw configuration drawer.
 * Provides form for creating new draw/flight with matchUp format and generation options.
 */
import { mountRoundProfileEditor, RoundProfileEditorController } from './roundProfileEditor';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { getUserTopologiesSync } from 'pages/templates/topologyBridge';
import { getDrawFormRelationships } from './getDrawFormRelationships';
import { informModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { entryStatusConstants } from 'tods-competition-factory';
import { getDrawTypeInfoKey } from './drawTypeDescriptions';
import { tournamentEngine } from 'services/factory/engine';
import { getTopologyTemplates } from './topologyTemplates';
import { tmxToast } from 'services/notifications/tmxToast';
import { resolveDrawFormMode } from './drawFormModel';
import { getDrawFormItems } from './getDrawFormItems';
import { submitDrawParams } from './submitDrawParams';
import { generateDraw } from './generateDraw';
import { context } from 'services/context';
import { t } from 'i18n';

const { LUCKY_DRAW } = drawDefinitionConstants;
import {
  getMatchUpFormatModal,
  renderButtons,
  renderForm,
  validators,
  topologyToDrawOptions,
} from 'courthive-components';

// constants
import { ATTACH_CONSOLATION_STRUCTURES, ATTACH_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import {
  CUSTOM,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  NONE,
  QUALIFYING_FIRST,
  RIGHT,
  STRUCTURE_NAME,
  TOPOLOGY_TEMPLATE_PREFIX,
} from 'constants/tmxConstants';

type AddDrawParams = {
  callback?: (result: any) => void;
  isPopulateMain?: boolean;
  isQualifying?: boolean;
  flightNumber?: number;
  drawName?: string;
  structureId?: string;
  eventId: string;
  drawId?: string;
  /** When supplied, the new draw's `drawEntries` are derived from these
   *  participantIds (cross-stage allowed) instead of falling back to
   *  `event.entries` filtered by `DIRECT_ENTRY_STATUSES`. Passed through
   *  from the unified entries panel when rows are selected at click time. */
  selectedParticipantIds?: string[];
};

export function addDraw({
  isPopulateMain,
  isQualifying,
  flightNumber,
  structureId,
  callback,
  drawName,
  eventId,
  drawId,
  selectedParticipantIds,
}: AddDrawParams): void {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return;

  // Phase D: resolve the flag tuple into a single DrawFormMode at the
  // drawer boundary. Downstream functions receive the mode directly.
  const mode = resolveDrawFormMode({ event, drawId, isQualifying, isPopulateMain, structureId });
  const { items, structurePositionAssignments } = getDrawFormItems({ event, mode });
  const relationships = getDrawFormRelationships({
    maxQualifiers: structurePositionAssignments?.length,
    isQualifying,
    isPopulateMain,
    drawId,
    event,
  });

  let inputs: any;
  let roundProfileEditor: RoundProfileEditorController | undefined;
  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
    attachDrawTypeHelp(inputs);

    // LUCKY_DRAW: bespoke chained-input round-profile editor mounted after the
    // form. Visible whenever LUCKY_DRAW is selected; if the user touches the
    // strip the explicit roundProfile is sent to the factory, otherwise the
    // submit just lets the factory derive the default ceil-halving cascade.
    const initialDrawSize = Number.parseInt(inputs[DRAW_SIZE]?.value) || 0;
    roundProfileEditor = mountRoundProfileEditor(elem, { drawSize: initialDrawSize });
    roundProfileEditor.setVisible(false);

    const drawTypeInput = inputs[DRAW_TYPE] as HTMLSelectElement | undefined;
    const drawSizeInput = inputs[DRAW_SIZE] as HTMLInputElement | undefined;

    const syncEditorDrawSize = () => {
      const size = Number.parseInt(drawSizeInput?.value || '0') || 0;
      roundProfileEditor?.setDrawSize(size);
    };
    const syncEditorVisibility = () => {
      const selectedDrawType =
        drawTypeInput?.options?.[drawTypeInput.selectedIndex]?.getAttribute('value') ||
        drawTypeInput?.value;
      const isLucky = selectedDrawType === LUCKY_DRAW;
      // drawType change triggers a drawSize coercion in getDrawFormRelationships
      // (raw entry count for LUCKY_DRAW vs nextPowerOf2 for elimination types).
      // Re-read drawSize before showing the editor so the freshly-coerced value
      // populates the strip — otherwise the editor stays on the pre-change size.
      if (isLucky) syncEditorDrawSize();
      roundProfileEditor?.setVisible(isLucky);
    };

    drawTypeInput?.addEventListener('change', syncEditorVisibility);
    drawSizeInput?.addEventListener('input', syncEditorDrawSize);
    drawSizeInput?.addEventListener('change', syncEditorDrawSize);
    syncEditorVisibility();
  };

  const isValid = () => {
    const isQualifyingFirst = inputs[QUALIFYING_FIRST]?.checked;
    if (isQualifying || isQualifyingFirst) {
      return validators.nameValidator(4)(inputs[STRUCTURE_NAME].value);
    }
    return validators.nameValidator(3)(inputs[DRAW_NAME].value);
  };

  const checkParams = () => {
    const selectedDrawType =
      inputs[DRAW_TYPE]?.options?.[inputs[DRAW_TYPE].selectedIndex]?.getAttribute?.('value') ||
      inputs[DRAW_TYPE]?.value;
    if (selectedDrawType?.startsWith(TOPOLOGY_TEMPLATE_PREFIX)) {
      context.drawer.close();
      const templateName = selectedDrawType.slice(TOPOLOGY_TEMPLATE_PREFIX.length);
      generateFromTopologyTemplate({ templateName, eventId, drawId, callback });
      return;
    }
    if (!isValid()) {
      tmxToast({ message: t('drawers.addDraw.missingName'), intent: 'is-danger' });
    } else if (inputs.matchUpFormat?.value === CUSTOM) {
      const setMatchUpFormat = (matchUpFormat: string) => {
        if (matchUpFormat) {
          (submitDrawParams as any)({
            isPopulateMain,
            event,
            inputs,
            callback,
            structureId,
            matchUpFormat,
            drawId,
            drawName,
            isQualifying,
            roundProfileEditor,
            selectedParticipantIds,
          });
        }
      };
      (getMatchUpFormatModal as any)({
        callback: setMatchUpFormat,
        config: { labels: getMatchFormatLabels() },
        modalConfig: {
          style: {
            fontSize: '12px',
            border: '3px solid var(--tmx-border-focus)',
          },
        },
      });
    } else {
      (submitDrawParams as any)({
        isPopulateMain,
        event,
        inputs,
        callback,
        structureId,
        drawId,
        drawName,
        isQualifying,
        roundProfileEditor,
        selectedParticipantIds,
      });
    }
  };

  const buttons = [
    { label: t('common.cancel'), intent: NONE, close: true },
    {
      label: t('drawers.addDraw.generate'),
      id: 'generateDraw',
      intent: 'is-primary',
      onClick: checkParams,
      close: isValid,
    },
  ];

  const title = isPopulateMain
    ? t('drawers.addDraw.generateMainDraw')
    : flightNumber
      ? t('drawers.addDraw.generateFlight')
      : t('drawers.addDraw.configureDraw');

  const footer = (elem: HTMLElement, close: () => void) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}

function generateFromTopologyTemplate({
  templateName,
  eventId,
  drawId,
  callback,
}: {
  templateName: string;
  eventId: string;
  drawId?: string;
  callback?: (result: any) => void;
}): void {
  // Resolve the template from tournament extensions or user catalog
  const tournamentTemplates = getTopologyTemplates();
  let template = tournamentTemplates.find((t) => t.name === templateName);

  if (!template) {
    const userTopo = getUserTopologiesSync().find((t) => t.name === templateName);
    if (userTopo) {
      template = { name: userTopo.name, description: userTopo.description, state: userTopo.state };
    }
  }

  if (!template) {
    tmxToast({ message: `Template "${templateName}" not found`, intent: 'is-danger' });
    return;
  }

  const state = {
    ...template.state,
    selectedNodeId: null,
    selectedEdgeId: null,
  };

  let drawOptions: any;
  let postGenerationMethods: any[];
  try {
    const result = topologyToDrawOptions(state);
    drawOptions = result.drawOptions;
    postGenerationMethods = result.postGenerationMethods;
  } catch (err: any) {
    tmxToast({ message: err.message || 'Failed to convert topology', intent: 'is-danger' });
    return;
  }

  drawOptions.eventId = eventId;
  if (drawId) drawOptions.drawId = drawId;

  const event = tournamentEngine.q.event({ eventId });
  if (!event) return;

  const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;
  const drawEntries =
    event.entries?.filter(
      ({ entryStage, entryStatus }: any) =>
        (!entryStage || entryStage === 'MAIN') && DIRECT_ENTRY_STATUSES.includes(entryStatus),
    ) || [];
  drawOptions.drawEntries = drawEntries;

  const postGeneration = (result: any) => {
    if (!result?.drawDefinition) {
      tmxToast({ message: 'Draw generation failed', intent: 'is-danger' });
      return;
    }

    const generatedDrawId = result.drawDefinition.drawId;
    const mainStructureId = result.drawDefinition.structures?.find((s: any) => s.stage === 'MAIN')?.structureId;

    if (postGenerationMethods.length > 0 && mainStructureId) {
      const methods = postGenerationMethods.flatMap((pgm) => {
        if (pgm.method === ATTACH_CONSOLATION_STRUCTURES) {
          // Generate structure locally, then attach via server-first mutation
          const genResult = tournamentEngine.generateConsolationStructure(pgm.params);
          if (!genResult?.structures?.length) return [];
          const consolationStructure = genResult.structures[0];

          // Build LOSER links from main to consolation
          const links = (pgm.params.links || []).map((link: any) => ({
            linkType: 'LOSER',
            source: { roundNumber: link.sourceRoundNumber, structureId: mainStructureId },
            target: {
              roundNumber: link.targetRoundNumber,
              feedProfile: 'TOP_DOWN',
              structureId: consolationStructure.structureId,
            },
          }));

          return {
            method: ATTACH_CONSOLATION_STRUCTURES,
            params: { drawId: generatedDrawId, structures: [consolationStructure], links },
          };
        }
        // Generate playoff structures locally, then attach via server-first mutation
        const playoffResult = tournamentEngine.generateAndPopulatePlayoffStructures({
          ...pgm.params,
          drawId: generatedDrawId,
          structureId: mainStructureId,
        });
        if (playoffResult.error || !playoffResult.structures?.length) return [];
        return {
          method: ATTACH_PLAYOFF_STRUCTURES,
          params: {
            matchUpModifications: playoffResult.matchUpModifications,
            structures: playoffResult.structures,
            links: playoffResult.links,
            drawId: generatedDrawId,
          },
        };
      });

      mutationRequest({
        methods,
        callback: () => {
          tmxToast({ message: 'Draw generated successfully', intent: 'is-success' });
          navigateToEvent({ eventId, drawId: generatedDrawId, structureId: mainStructureId, renderDraw: true });
          if (callback) callback(result);
        },
      });
    } else {
      tmxToast({ message: 'Draw generated successfully', intent: 'is-success' });
      navigateToEvent({ eventId, drawId: generatedDrawId, structureId: mainStructureId, renderDraw: true });
      if (callback) callback(result);
    }
  };

  generateDraw({ drawOptions, eventId, callback: postGeneration });
}

function attachDrawTypeHelp(inputs: any) {
  const drawTypeSelect = inputs[DRAW_TYPE] as HTMLSelectElement;
  if (!drawTypeSelect) return;

  // Find the field container (parent label row) for the draw type select
  const fieldContainer = drawTypeSelect.closest('.field');
  if (!fieldContainer) return;
  const labelEl = fieldContainer.querySelector('label');
  if (!labelEl) return;

  // Create (?) button next to the label
  const helpBtn = document.createElement('span');
  helpBtn.textContent = '\u24D8';
  helpBtn.title = t('drawers.addDraw.drawTypeInfo');
  helpBtn.style.cssText = 'cursor: pointer; margin-left: 0.4em; color: var(--tmx-text-muted, #888); font-size: 0.9em;';
  labelEl.appendChild(helpBtn);

  const showInfo = () => {
    const selectedValue =
      drawTypeSelect.options[drawTypeSelect.selectedIndex]?.getAttribute('value') || drawTypeSelect.value;
    const infoKey = getDrawTypeInfoKey(selectedValue);
    const description = t(`drawers.addDraw.drawTypeDescriptions.${infoKey}`, { defaultValue: '' });
    const selectedLabel = drawTypeSelect.options[drawTypeSelect.selectedIndex]?.textContent || selectedValue;
    const message = description
      ? `<div><strong>${selectedLabel}</strong></div><div style="margin-top: 0.5em;">${description}</div>`
      : `<div><strong>${selectedLabel}</strong></div>`;

    informModal({
      title: t('drawers.addDraw.drawTypeInfo'),
      message,
      okAction: undefined,
    });
  };

  helpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showInfo();
  });
}
