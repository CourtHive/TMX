export function toggleSideBar(state?: boolean): void {
  const sideBar = document.querySelector('.side-bar');
  const arrowCollapse = document.querySelector('#logo-name__icon');

  if (state === false && sideBar?.classList.contains('collapse')) return;

  sideBar?.classList.toggle('collapse');
  arrowCollapse?.classList.toggle('collapse');

  if (arrowCollapse?.classList.contains('collapse')) {
    arrowCollapse.classList.value = 'fa-solid fa-expand logo-name__icon collapse';
  } else if (arrowCollapse) {
    arrowCollapse.classList.value = 'fa-solid fa-compress logo-name__icon';
  }
}
