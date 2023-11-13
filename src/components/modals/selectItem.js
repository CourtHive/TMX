import { createSelectionTable } from 'components/tables/selection/createSelectionTable';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { controlBar } from 'components/controlBar/controlBar';
import { closeModal, openModal } from './baseModal/baseModal';
import { context } from 'services/context';

import { LEFT } from 'constants/tmxConstants';

/*
 * assumes that all options have their own .onClick method
 */
export function selectItem({ title, placeholder, options, selectionLimit }) {
  const controlId = 'selectionControl';
  const anchorId = 'selectionTable';
  const buttons = [{ label: 'Cancel', intent: 'is-none', close: true }];
  const onClose = () => {
    const table = context.tables['selectionTable'];
    table?.destroy();

    delete context.tables['selectionTable'];
  };
  const content = `
    <div style='min-height: 420px'>
      <div id='${controlId}'></div>
      <div id='${anchorId}'></div>
    </div>
  `;

  openModal({ title, content, buttons, onClose });

  const onSelected = (value) => {
    if (value?.[0]?.onClick) {
      value[0].onClick();
      closeModal();
    }
  };
  const { table } = createSelectionTable({
    targetAttribute: 'participantid',
    selectionLimit,
    data: options,
    placeholder,
    onSelected,
    anchorId
  });

  const setSearchFilter = createSearchFilter(table);
  const items = [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search',
      location: LEFT,
      search: true
    }
  ];

  const target = document.getElementById(controlId);
  controlBar({ table, target, items });
}
