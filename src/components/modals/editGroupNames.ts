/**
 * Edit group names modal for round robin structures.
 * Allows renaming of group structures with minimum character validation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { validators, renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { RENAME_STRUCTURES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

const EDIT_GROUP_NAMES_STYLE_ID = 'tmx-edit-group-names-style';
function ensureEditGroupNamesStyles(): void {
  if (document.getElementById(EDIT_GROUP_NAMES_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = EDIT_GROUP_NAMES_STYLE_ID;
  // `renderField` appends an empty `<p class="help">` below each input so a
  // validation message has a slot to land in. While empty it adds vertical
  // weight to the `.field` block, which pushes the input above the label
  // baseline when the row is centered. Hiding the help while empty + bottom-
  // aligning the row lands the input's baseline next to the label text.
  style.textContent = `
    .tmx-edit-group-names .flexrow { align-items: flex-end; }
    .tmx-edit-group-names .help:empty { display: none; }
  `;
  document.head.appendChild(style);
}

export function editGroupNames({
  drawId,
  structure,
  callback,
}: {
  drawId: string;
  structure: any;
  callback?: (result: any) => void;
}): void {
  const matchUps = Object.values(structure.roundMatchUps).flat();
  const groups = matchUps.reduce((groups: Record<string, any>, matchUp: any) => {
    const { structureName, structureId } = matchUp;
    if (!groups[structureId]) groups[structureId] = { structureName, structureId };
    return groups;
  }, {});
  const options = Object.values(groups).map(({ structureName, structureId }: any) => ({
    text: `${structureName}:`,
    fieldPair: {
      error: t('modals.editGroupNames.minChars'),
      validator: validators.nameValidator(3),
      placeholder: structureName,
      field: structureId,
      id: structureId,
    },
  }));

  let inputs: any;
  let modalHandle: any;
  const onClick = () => {
    const structureDetails = Object.values(groups)
      .map(
        ({ structureId }: any) =>
          inputs[structureId]?.value && { structureId, structureName: inputs[structureId].value.trim() },
      )
      .filter(Boolean);
    const methods = [
      {
        params: { drawId, structureDetails },
        method: RENAME_STRUCTURES,
      },
    ];
    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: t('modals.editGroupNames.groupsRenamed'), intent: 'is-success' });
        isFunction(callback) && callback?.(result);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const checkValid = () => {
    const nameValues = Object.values(groups)
      .map(({ structureId }: any) => inputs[structureId]?.value)
      .filter(Boolean);
    const validValues = nameValues.every(validators.nameValidator(3));
    const valid = nameValues.length && validValues;
    modalHandle?.setButtonState('renameGroups', { disabled: !valid });
  };
  const relationships = Object.values(groups).map(({ structureId }: any) => ({
    control: structureId,
    onInput: checkValid,
  }));
  const content = (elem: HTMLElement) => {
    // Vertically center each row's label (`.flexaligncenter`, 2.5em tall)
    // with the input (whose `.control` block includes an empty `.help`
    // paragraph that pushes the input upward). The global `.flexrow`
    // utility intentionally has no `align-items` rule, so do it scoped
    // here instead of changing the shared class.
    elem.classList.add('tmx-edit-group-names');
    ensureEditGroupNamesStyles();
    inputs = renderForm(elem, options, relationships);
  };
  modalHandle = openModal({
    title: t('modals.editGroupNames.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('rename'), id: 'renameGroups', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
