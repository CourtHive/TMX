import { removeAllChildNodes } from 'services/dom/transformers';
import { isFunction } from 'functions/typeOf';

import { NONE, TMX_NAV } from 'constants/tmxConstants';

export function showNav(onClick) {
  const anchor = getAnchor();
  const clickAction = (e) => {
    e.stopPropagation();
    e.preventDefault();
    isFunction(onClick) && onClick();
  };

  const displayNav = () => {
    anchor.style.display = 'block';
    const button = document.createElement('button');
    button.className = 'button fa-solid fa-bars is-rounded';
    button.style.position = 'absolute';
    button.onclick = clickAction;
    button.style.margin = '1em';
    button.style.right = '1em';
    button.style.top = '1em';
    anchor.appendChild(button);
  };

  if (anchor) displayNav();
}

export function hideNav() {
  const anchor = document.getElementById(TMX_NAV);
  removeAllChildNodes(anchor);
  anchor.style.display = NONE;
}

function getAnchor() {
  let anchor = document.getElementById(TMX_NAV);

  if (!anchor) {
    const el = document.createElement('div');
    el.setAttribute('id', TMX_NAV);
    el.setAttribute('style', 'position: fixed; padding: 2em; right: 0%; top: 0%');
    document.body.appendChild(el);
    anchor = document.getElementById(TMX_NAV);
  }

  return anchor;
}
