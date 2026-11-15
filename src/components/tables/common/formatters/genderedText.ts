import { genderAccent } from './genderAccent';

export function genderedText(cell: any): HTMLDivElement {
  const value = cell.getValue();
  const data = cell.getRow().getData();
  const el = document.createElement('div');
  el.style.color = genderAccent(data.sex || data.person?.sex);
  el.textContent = value ?? '';
  return el;
}
