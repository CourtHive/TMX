/*
 * requires bulma.css
 * animation requires animate.css
 */

import { isFunction } from 'functions/typeOf';
import { tmxTimer } from 'services/tmxTimer';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

const containers = {};
const defaults = {
  position: 'top-right',
  clickClose: true,
  duration: 2000,
  offsetBottom: 0,
  offsetRight: 0,
  offsetLeft: 0,
  offsetTop: 0,
  opacity: 1
};

const generateStyle = (position, offsetTop, offsetBottom, offsetLeft, offsetRight) => {
  const parts = position.split('-');
  const left = parts.includes(LEFT) && `left:${offsetLeft}`;
  const right = parts.includes(RIGHT) && `right:${offsetRight}`;
  const top = parts.includes('top') && `top:${offsetTop}`;
  const bottom = parts.includes('bottom') && `bottom:${offsetBottom}`;
  const alignItems =
    `align-items: ` + ((parts.includes('left') && 'flex-start') || (parts.includes('right') && 'flex-end') || CENTER);
  const textAlign =
    `text-align: ` + ((parts.includes('left') && 'left') || (parts.includes('right') && 'right') || CENTER);

  return [left, right, top, bottom, alignItems, textAlign].filter(Boolean).join(';');
};

function getContainer(options) {
  if (containers.position) return containers.position;

  const container = document.createElement('div');
  container.style =
    'position: fixed; display: flex; flex-direction: column; width:100%; z-index: 9999; pointer-events: none;padding:15px;' +
    generateStyle(options.position, options.offsetTop, options.offsetBottom, options.offsetLeft, options.offsetRight);
  (options.appendTo || document.body).appendChild(container);
  containers.position = container;
  return container;
}

export function toast(params) {
  if (!params.message) return { error: 'Missing message' };
  const options = { ...defaults, ...params };
  const container = getContainer(options);
  const toast = createToast(options);

  if (options.onlyOne) {
    let child = container.lastElementChild;
    while (child) {
      container.removeChild(child);
      child = container.lastElementChild;
    }
  }

  container.appendChild(toast.element);
}

function createToast(options) {
  const element = document.createElement('div');

  options.clickClose && element.addEventListener('click', () => cleanUp(options.onClose));
  const timer = options.duration && tmxTimer(() => cleanUp(options.onClose), options.duration);

  if (timer && options.pauseOnHover) {
    element.addEventListener('mouseover', timer.pause);
    element.addEventListener('mouseout', timer.resume);
  }

  element.style = `display:inline-flex;width:auto;pointer-events:auto;white-space:pre-wrap;opacity:${options.opacity};${
    !options.dismissible ? 'padding: 1.25rem, 1.5rem;' : ''
  }`;

  const classes = ['notification'];
  if (typeof options.classList === 'string') classes.push(options.classList);
  if (options.type) classes.push(options.type);
  if (options.animate && options.animate.in) {
    const speed = options.animate.speed ? `animate__${options.animate.speed}` : 'animate__faster';
    const animation = `animate__${options.animate.in}`;
    classes.push(`animate__animated ${animation} ${speed}`);
    endAnimation(() => element.classList.remove(animation));
  }

  element.className = classes.join(' ');

  if (options.dismissible) {
    const dismissButton = document.createElement('button');
    dismissButton.className = 'delete';
    dismissButton.addEventListener('click', () => cleanUp(options.onClose));
    element.insertAdjacentElement('afterbegin', dismissButton);
  }

  const container = document.createElement('div');
  container.style = 'display: flex; flex-direction: row; align-items: center; justify-content: center;';

  if (typeof options.message === 'string') {
    container.insertAdjacentHTML('beforeend', options.message);
  } else if (options.message) {
    console.log(' MESSAGE ', options.message, typeof options.messsage);
    container.appendChild(options.message);
  }

  if (isFunction(options.action?.onClick)) {
    const actionButton = document.createElement('button');
    actionButton.style = 'margin-left: 1em;';
    actionButton.className = 'button';
    actionButton.innerHTML = options.action.text || 'OK';
    actionButton.addEventListener('click', options.action.onClick);
    container.appendChild(actionButton);
  }

  element.appendChild(container);

  return { element };

  function cleanUp(onClose) {
    if (isFunction(onClose)) onClose();
    if (options.animate && options.animate.out) {
      element.classList.add(`animate__${options.animate.out}`);
      endAnimation(() => {
        removeParent(element.parentNode);
        delete containers.position;
        element.remove();
      });
    } else {
      removeParent(element.parentNode);
      delete containers.position;
      element.remove();
    }
  }

  function removeParent(element) {
    if (element && element.children.length <= 1) {
      element.remove();
    }
  }

  function endAnimation(callback = () => {}) {
    const animations = {
      WebkitAnimation: 'webkitAnimationEnd',
      MozAnimation: 'mozAnimationEnd',
      OAnimation: 'oAnimationEnd',
      animation: 'animationend'
    };

    for (const t in animations) {
      if (element.style[t] !== undefined) {
        element.addEventListener(animations[t], () => callback());
        break;
      }
    }
  }
}
