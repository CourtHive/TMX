import { isObject } from 'functions/typeOf';

export const participantResponsiveLayourFormatter = (data) => {
  const list = document.createElement('ul');
  data.forEach((col) => {
    let item = document.createElement('li');
    if (col.field === 'sex') {
      item.innerHTML = '<strong>Gender:&nbsp;</strong>' + col.value;
    } else if (isObject(col.value)) {
      if (col.value) {
        let header = document.createElement('div');
        header.innerHTML = `<strong>${col.title}:&nbsp;</strong>`;
        item.appendChild(header);
        item.appendChild(col.value);
      }
    } else {
      item.innerHTML = '<strong>' + col.title + '</strong>:&nbsp;' + col.value;
    }
    list.appendChild(item);
  });

  return Object.keys(data).length ? list : '';
};
