export function panelNotice({ targetClassName, header, message, buttonLabel, panelId, destroy, onClick }) {
  if (!targetClassName && !panelId) return;

  const existing = document.getElementById(panelId);
  if (existing) {
    if (destroy) {
      existing.remove();
    }
    return;
  }

  if (!message || !buttonLabel) return;

  const target = targetClassName
    ? document.getElementsByClassName(targetClassName)?.[0]
    : document.getElementById(panelId);
  if (!target) return;

  const elem = document.createElement('div');
  if (panelId) elem.setAttribute('id', panelId);
  elem.classList.add('flexcenter');
  elem.style = 'width: 100%;';
  const container = document.createElement('div');
  container.classList.add('flexcenter');
  container.classList.add('flexcol');
  container.style = 'background-color: lightgray; width: 80%; padding: 1.5em;';
  const heading = document.createElement('h2');
  heading.classList.add('bp3-heading');
  heading.innerHTML = header;
  container.appendChild(heading);
  const msg = document.createElement('div');
  msg.style = 'margin: 2em; font-size: 16px';
  msg.innerHTML = message;
  container.appendChild(msg);
  const action = document.createElement('button');
  action.classList.add('button');
  action.classList.add('is-info');
  action.innerHTML = buttonLabel;
  action.onclick = onClick;
  container.appendChild(action);
  elem.appendChild(container);
  target.appendChild(elem);
}
