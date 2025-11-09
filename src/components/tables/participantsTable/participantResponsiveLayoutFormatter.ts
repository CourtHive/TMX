import { isObject } from 'functions/typeOf';

export const participantResponsiveLayourFormatter = (data: any[]): HTMLUListElement => {
  const list = document.createElement('ul');
  
  if (!Object.keys(data).length) return list;
  
  data.forEach((col: any) => {
    const item = document.createElement('li');
    if (col.field === 'sex') {
      item.innerHTML = '<strong>Gender:&nbsp;</strong>' + col.value;
    } else if (isObject(col.value)) {
      if (col.value) {
        const header = document.createElement('div');
        header.innerHTML = `<strong>${col.title}:&nbsp;</strong>`;
        item.appendChild(header);
        item.appendChild(col.value);
      }
    } else {
      item.innerHTML = '<strong>' + col.title + '</strong>:&nbsp;' + col.value;
    }
    list.appendChild(item);
  });

  return list;
};
