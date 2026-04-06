/**
 * Add playoff structures modal with round selection.
 * Configures playoff rounds for finishing position ranges with custom naming.
 * Includes Page Playoff toggle for 4-participant hybrid knockout format.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm } from 'courthive-components';
import { addRRplayoffs } from './addRRplayoffs';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { ATTACH_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import { NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';

const { PAGE_PLAYOFF } = drawDefinitionConstants;
const PAGE_PLAYOFF_FIELD = 'pagePlayoff';

export function addStructures({
  drawId,
  structureId,
  callback,
}: {
  drawId: string;
  structureId: string;
  callback?: () => void;
}): void {
  const result = tournamentEngine.getAvailablePlayoffProfiles({ drawId, structureId });
  const sum = (p: any) => p.finishingPositions.reduce((a: number, b: number) => (a || 0) + (b || 0));

  if (!result.playoffRoundsRanges && result.finishingPositionsAvailable?.length) {
    return (addRRplayoffs as any)({ ...result, drawId, structureId, callback });
  }

  const sortedRanges = result.playoffRoundsRanges?.sort((a: any, b: any) => sum(a) - sum(b)) ?? [];

  // Check if Page Playoff is available: positions 1-4 must all be unplayed
  const allFinishingPositions = new Set(sortedRanges.flatMap((r: any) => r.finishingPositions ?? []));
  const has34 = allFinishingPositions.has(3) && allFinishingPositions.has(4);
  // Positions 1-2 are always available from the main SE final (not in playoffRoundsRanges)
  const pagePlayoffAvailable = has34;

  const fields = sortedRanges.map(({ finishingPositionRange }: any) => ({
    label: finishingPositionRange,
    field: finishingPositionRange,
    id: finishingPositionRange,
    checkbox: true,
    fieldPair: {
      field: `${finishingPositionRange}-name`,
      placeholder: `${PLAYOFF_NAME_BASE} ${finishingPositionRange}`,
      id: `${finishingPositionRange}-name`,
      width: '350px',
    },
  }));

  if (!fields || fields.length < 1) {
    tmxToast({ message: t('modals.addStructures.noPlayoffPositions'), intent: 'is-danger' });
    return;
  }

  const modifyPlaceholders = (value: string) => {
    fields.forEach(({ label, fieldPair }: any) => {
      const elem = document.getElementById(fieldPair.id);
      if (elem) (elem as HTMLInputElement).placeholder = `${value} ${label}`;
    });
  };

  const nameBase = {
    onChange: (e: Event) => modifyPlaceholders((e.target as HTMLInputElement).value),
    onKeyDown: (e: KeyboardEvent) => e.key === 'Tab' && modifyPlaceholders((e.target as HTMLInputElement).value),
    value: PLAYOFF_NAME_BASE,
    label: t('modals.addStructures.nameBase'),
    field: 'nameBase',
    id: 'nameBase',
  };

  // Find the 3-4 range field to disable when Page Playoff is toggled
  const range34 = sortedRanges.find((r: any) => r.finishingPositions?.includes(3) && r.finishingPositions?.includes(4));
  const range34FieldId = range34?.finishingPositionRange;

  const pagePlayoffField = pagePlayoffAvailable
    ? {
        label: '1-4 Page Playoff',
        field: PAGE_PLAYOFF_FIELD,
        id: PAGE_PLAYOFF_FIELD,
        checkbox: true,
      }
    : undefined;

  const options = [nameBase, ...(pagePlayoffField ? [pagePlayoffField] : []), ...fields];

  let inputs: any;

  const onClick = () => {
    const isPagePlayoff = inputs[PAGE_PLAYOFF_FIELD]?.checked;

    if (isPagePlayoff) {
      // Generate PAGE_PLAYOFF via playoffGroups with POSITION link
      const genResult = tournamentEngine.generateAndPopulatePlayoffStructures({
        playoffGroups: [{ drawType: PAGE_PLAYOFF, finishingPositions: [1, 2, 3, 4] }],
        structureId,
        drawId,
      });

      if (genResult.error) {
        tmxToast({ message: genResult.error?.message || 'Generation error', intent: 'is-danger' });
        return;
      }

      attachAndNotify(genResult);
      return;
    }

    // Standard round-based playoffs
    const checkedRanges = result.playoffRoundsRanges.filter(
      (range: any) => inputs[range.finishingPositionRange]?.checked,
    );

    const playoffStructureNameBase = inputs.nameBase.value;
    const playoffAttributes: any = {};
    const roundProfiles = checkedRanges.map(({ roundNumber, finishingPositionRange }: any) => {
      const name = inputs[`${finishingPositionRange}-name`]?.value;
      if (name) {
        playoffAttributes[`0-${roundNumber}`] = { name };
      }
      return { [roundNumber]: 1 };
    });

    const genResult = tournamentEngine.generateAndPopulatePlayoffStructures({
      playoffStructureNameBase,
      playoffAttributes,
      roundProfiles,
      structureId,
      drawId,
    });

    if (genResult.error) {
      tmxToast({ message: genResult.error?.message || 'Generation error', intent: 'is-danger' });
      return;
    }

    attachAndNotify(genResult);
  };

  const attachAndNotify = (genResult: any) => {
    const methods = [
      {
        method: ATTACH_PLAYOFF_STRUCTURES,
        params: {
          matchUpModifications: genResult.matchUpModifications,
          structures: genResult.structures,
          links: genResult.links,
          drawId,
        },
      },
    ];
    const postMutation = (mutationResult: any) => {
      if (mutationResult.success) {
        tmxToast({ message: t('modals.addStructures.structuresAdded'), intent: 'is-success' });
        isFunction(callback) && callback?.();
      } else {
        tmxToast({ message: mutationResult.error?.message || 'Error', intent: 'is-danger' });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const checkValid = () => {
    const pagePlayoffChecked = inputs[PAGE_PLAYOFF_FIELD]?.checked;
    const checkedRanges = result.playoffRoundsRanges.filter(
      (range: any) => inputs[range.finishingPositionRange]?.checked,
    );
    const addButton = document.getElementById('addStructure');
    if (addButton) (addButton as HTMLButtonElement).disabled = !pagePlayoffChecked && !checkedRanges.length;
  };

  const onPagePlayoffChange = () => {
    const isChecked = inputs[PAGE_PLAYOFF_FIELD]?.checked;
    // Disable/enable 3-4 checkbox when Page Playoff is toggled
    if (range34FieldId) {
      const checkbox = inputs[range34FieldId];
      if (checkbox) {
        checkbox.disabled = isChecked;
        if (isChecked) checkbox.checked = false;
      }
    }
    checkValid();
  };

  const relationships = [
    ...(pagePlayoffAvailable ? [{ control: PAGE_PLAYOFF_FIELD, onChange: onPagePlayoffChange }] : []),
    ...result.playoffRoundsRanges.map(({ finishingPositionRange }: any) => ({
      control: finishingPositionRange,
      onChange: checkValid,
    })),
  ];
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  openModal({
    title: t('modals.addStructures.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('add'), id: 'addStructure', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
