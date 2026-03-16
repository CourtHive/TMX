/**
 * Add voluntary consolation structure modal.
 * Configures consolation draw type and optional group size for round robin.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm } from 'courthive-components';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

// constants
import { GENERATE_VOLUNTARY_CONSOLATION } from 'constants/mutationConstants';
import { DRAW_TYPE, GROUP_SIZE, NONE } from 'constants/tmxConstants';

const { ROUND_ROBIN, SINGLE_ELIMINATION, LUCKY_DRAW, AD_HOC } = drawDefinitionConstants;

const CONSOLATION_DRAW_TYPES = [
  { label: 'Single elimination', value: SINGLE_ELIMINATION },
  { label: 'Lucky', value: LUCKY_DRAW },
  { label: 'Round robin', value: ROUND_ROBIN },
  { label: 'Ad-hoc', value: AD_HOC },
];

export function addConsolation({ callback, drawId }: { callback?: () => void; drawId: string }): void {
  const structureName = {
    value: 'Consolation',
    label: t('modals.addConsolation.structureName'),
    field: 'structureName',
    id: 'structureName',
  };

  const consolationDrawType = {
    value: SINGLE_ELIMINATION,
    options: CONSOLATION_DRAW_TYPES,
    label: t('dtp'),
    field: DRAW_TYPE,
    id: DRAW_TYPE,
  };

  const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize: 4, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size) => ({ label: size, value: size }));
  const groupSizeSelector = {
    options: roundRobinOptions,
    label: t('modals.addConsolation.groupSize'),
    field: GROUP_SIZE,
    visible: false,
    value: 4,
  };

  const options = [structureName, consolationDrawType, groupSizeSelector] as any[];

  let inputs: any;

  const onClick = () => {
    const drawType = inputs[DRAW_TYPE].value;
    const name = inputs.structureName.value || 'Consolation';

    const params: any = {
      structureName: name,
      drawType,
      drawId,
    };

    if (drawType === ROUND_ROBIN) {
      const groupSize = Number.parseInt(inputs[GROUP_SIZE].value);
      params.structureOptions = { groupSize };
    }

    const methods = [
      {
        params,
        method: GENERATE_VOLUNTARY_CONSOLATION,
      },
    ];

    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: t('modals.addConsolation.structureAdded'), intent: 'is-success' });
        isFunction(callback) && callback?.();
      } else {
        tmxToast({ message: result.error?.message || 'Error', intent: 'is-danger' });
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const drawTypeChange = ({ e, fields }: any) => {
    const drawType = e.target.value;

    const groupSizeVisible = [ROUND_ROBIN].includes(drawType);
    fields[GROUP_SIZE].style.display = groupSizeVisible ? '' : NONE;
  };

  const relationships = [
    {
      onChange: drawTypeChange as any,
      control: DRAW_TYPE,
    },
  ] as any;

  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  openModal({
    title: t('modals.addConsolation.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('add'), id: 'addConsolation', intent: 'is-info', close: true, onClick },
    ],
  });
}
