import { tmxToast } from 'services/notifications/tmxToast';

export function copyClick(message) {
  navigator.clipboard
    .writeText(message)
    .then(() => tmxToast({ message: `Key copied to clipboard: ${message}`, intent: 'is-success' }))
    .catch((err) => tmxToast({ message: err, intent: 'is-danger' }));

  let c = document.createElement('input');
  c.style.opacity = 0;
  c.setAttribute('id', 'c2c');
  c.setAttribute('type', 'text');
  c.setAttribute('value', message);
  let inp = document.body.appendChild(c);

  let b = document.createElement('button');
  b.style.display = 'none';
  b.setAttribute('data-copytarget', '#c2c');
  b.addEventListener('click', elementCopy, true);
  let elem = document.body.appendChild(b);
  elem.click();
  elem.remove();
  inp.remove();
}

function elementCopy(e) {
  let t = e.target;
  let c = t.dataset.copytarget;
  let inp = c ? document.querySelector(c) : null;

  if (inp?.select) {
    inp.select();

    try {
      document.execCommand('copy');
      inp.blur();
    } catch (err) {
      alert('please press Ctrl/Cmd+C to copy');
    }
  }
}
