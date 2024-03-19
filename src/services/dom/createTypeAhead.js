import { isFunction } from 'functions/typeOf';

import AWSP from 'awesomplete';

export function createTypeAhead({ list, element, callback, currentValue, withCatchTab, onChange }) {
  const typeAhead = new AWSP(element, { list });
  element.parentElement.style.width = '100%';

  let selectionFlag = false;
  const selectComplete = (c) => {
    selectionFlag = true;
    isFunction(callback) && callback(c.text.value);
    element.value = c.text.label;
    typeAhead.suggestions = [];
  };

  if (withCatchTab) {
    const catchTab = (evt) => evt.which === 9 && evt.preventDefault();
    element.addEventListener('keydown', catchTab, false);
    element.addEventListener('keyup', catchTab, false);
  }
  if (typeof onChange === 'function') element.addEventListener('change', onChange);
  element.setAttribute('autocomplete', 'off');
  element.addEventListener('awesomplete-selectcomplete', (c) => selectComplete(c), false);
  element.addEventListener('keyup', function (evt) {
    // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
    if ((evt.which === 13 || evt.which === 9) && !selectionFlag && typeAhead.suggestions?.length) {
      typeAhead.next();
      typeAhead.select(0);
    }
    selectionFlag = false;
  });

  if (currentValue) {
    const currentLabel = list.find((item) => item.value === currentValue)?.label;
    if (currentLabel) element.value = currentLabel;
  }

  return { typeAhead };
}
