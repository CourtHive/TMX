import { NAVBAR, NONE } from 'constants/tmxConstants';

export function navbarBlock() {
  const nav = document.createElement('nav');
  nav.className = 'navbar is-transparent';
  nav.ariaLabel = 'main navigation';
  nav.style.display = NONE;
  nav.style.width = '100%';
  nav.role = 'navigation';
  nav.id = NAVBAR;

  nav.innerHTML = `
    <div class="navbar-brand">
      <div class="navbar-item" id="provider">TMX</div>
      <div class="navbar-item" id="pageTitle">
      </div>
      <a
        data-target="navbar-basic"
        class="navbar-burger"
        aria-expanded="false"
        aria-label="menu"
        role="button"
      >
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>

    <div id="navbar-menu" class="navbar-menu">
      <div class="navbar-end">
        <div class="navbar-item" style="font-size: 2em">
          <i id="config" class="fa-solid fa-sliders"></i>
        </div>
        <div class="navbar-item" style="font-size: 2.5em">
          <i id="login" class="fa-solid fa-circle-user"></i>
        </div>
      </div>
    </div>
  `;

  return nav;
}
