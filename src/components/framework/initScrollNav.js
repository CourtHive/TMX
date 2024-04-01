export function initScrollNav() {
  const nav = document.getElementById('dnav');
  const supportPageOffset = window.pageXOffset !== undefined;
  const isCSS1Compat = (document.compatMode || '') === 'CSS1Compat';

  let previousScrollPosition = 0;

  const isScrollingDown = () => {
    let scrolledPosition = supportPageOffset
      ? window.pageYOffset
      : isCSS1Compat
        ? document.documentElement.scrollTop
        : document.body.scrollTop;
    let isScrollDown;

    if (scrolledPosition > previousScrollPosition) {
      isScrollDown = true;
    } else {
      isScrollDown = false;
    }
    previousScrollPosition = scrolledPosition;
    return isScrollDown;
  };

  const handleNavScroll = () => {
    if (isScrollingDown() && !nav.contains(document.activeElement)) {
      nav.classList.add('scroll-down');
      nav.classList.remove('scroll-up');
    } else {
      nav.classList.add('scroll-up');
      nav.classList.remove('scroll-down');
    }
  };

  var throttleTimer;

  const throttle = (callback, time) => {
    if (throttleTimer) return;

    throttleTimer = true;
    setTimeout(() => {
      callback();
      throttleTimer = false;
    }, time);
  };

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  window.addEventListener('scroll', () => {
    if (mediaQuery && !mediaQuery.matches) {
      throttle(handleNavScroll, 250);
    }
  });
}
