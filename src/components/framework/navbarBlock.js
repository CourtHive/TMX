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
      <div class="navbar-item" id="tmx">TMX</div>
      <div class="navbar-item" id="tournamentName"></div>
      <div class="navbar-item" id="authorizeActions"></div>
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
        <div class="navbar-item">
          <figure class="image">
            <img class="is-rounded" src="" alt="" />
          </figure>
        </div>
        <div class="navbar-item">
          <div class="buttons"></div>
        </div>
      </div>
    </div>
  `;

  return nav;
}
