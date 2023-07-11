import { drawDefinitionConstants, drawEngine } from 'tods-competition-factory';
import { renderOptions } from 'components/renderers/renderField';
import { removeAllChildNodes } from 'services/dom/transformers';

import { NONE } from 'constants/tmxConstants';

const { ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;

export function getFormRelationships() {
  const drawTypeChange = ({ e, fields }) => {
    const visible = [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(e.target.value);
    fields['groupSize'].style.display = visible ? '' : NONE;
  };

  const drawSizeChange = ({ inputs }) => {
    const drawSize = inputs['drawSize'].value;
    const { validGroupSizes } = drawEngine.getValidGroupSizes({ drawSize, groupSizeLimit: 8 });
    const options = validGroupSizes.map((size) => ({ label: size, value: size }));
    const groupSizeSelect = inputs['groupSize'];
    const value = validGroupSizes.includes(4) ? 4 : validGroupSizes[0];
    removeAllChildNodes(groupSizeSelect);
    renderOptions(groupSizeSelect, { options, value });
  };

  return [
    {
      onChange: drawTypeChange,
      control: 'drawType'
    },
    {
      onChange: drawSizeChange,
      control: 'drawSize'
    }
  ];
}
