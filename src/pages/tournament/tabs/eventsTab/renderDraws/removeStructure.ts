/**
 * Remove draw structure with confirmation modal.
 * Navigates to draw view after successful removal.
 * For VOLUNTARY_CONSOLATION structures, also removes VC stage entries.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { isDev } from 'functions/isDev';
import { t } from 'i18n';

// Constants
import { REMOVE_STAGE_ENTRIES, REMOVE_STRUCTURE } from 'constants/mutationConstants';

const { VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

export function removeStructure({
  drawId,
  eventId,
  structureId,
}: {
  drawId: string;
  eventId: string;
  structureId: string;
}): void {
  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  const structure = drawDefinition?.structures?.find((s: any) => s.structureId === structureId);
  const isVC =
    structure?.stage === VOLUNTARY_CONSOLATION ||
    structure?.structures?.some((s: any) => s.stage === VOLUNTARY_CONSOLATION);

  const navigate = () => {
    // After removal, navigate explicitly to the first remaining structure (MAIN).
    // Without a structureId the URL may match the current one, causing the router to skip re-render.
    const { drawDefinition: dd } = tournamentEngine.getEvent({ drawId });
    const mainStructureId = dd?.structures?.[0]?.structureId;
    navigateToEvent({ eventId, drawId, structureId: mainStructureId, renderDraw: true });
  };
  const showError = (result: any) =>
    tmxToast({ message: result.error?.message || t('common.error'), intent: 'is-danger' });

  const doRemove = () => {
    // Step 1: If VC, remove structure and voluntary consolation stage entries
    if (isVC) {
      mutationRequest({
        methods: [
          { method: REMOVE_STRUCTURE, params: { drawId, structureId, force: true } },
          { method: REMOVE_STAGE_ENTRIES, params: { drawId, entryStage: VOLUNTARY_CONSOLATION } },
        ],
        callback: (result: any) => (result.success ? navigate() : showError(result)),
      });
    } else {
      mutationRequest({
        methods: [{ method: REMOVE_STRUCTURE, params: { drawId, structureId, force: true } }],
        callback: (result: any) => (result.success ? navigate() : showError(result)),
      });
    }
  };

  if (isDev()) {
    doRemove();
    return;
  }

  const content = `<div style='font-size: 2em'>${t('modals.removeStructure.warning')}</div>`;
  const buttons = [
    {
      intent: 'is-danger',
      onClick: doRemove,
      label: t('remove'),
      close: true,
    },
    { label: t('common.cancel') },
  ];
  openModal({ title: t('modals.removeStructure.title'), buttons, content });
}
