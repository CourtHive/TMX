import { isObject } from 'functions/typeOf';

export const groupOrderFormatter = (cell) => {
  const elem = document.createElement('div');
  const value = cell.getValue();
  const row = cell.getRow();
  const playerRow = row?.getData();
  const ties = playerRow?.ties;

  if (ties) {
    const subOrder = playerRow?.subOrder;
    const color = subOrder ? 'blue' : 'red';
    elem.innerHTML = `<span style='font-weight: bold; color: ${color}'>[${isObject(value) ? (value as any).groupOrder : value}]</span>`;
  } else {
    elem.innerHTML = (isObject(value) ? (value as any).groupOrder : value) || '';
  }

  return elem;
};
