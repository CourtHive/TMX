/**
 * Initialize scroll-based navigation behavior.
 * Shows/hides navigation bar based on scroll direction with throttling and reduced motion support.
 */
export function initScrollNav(): void {
  const nav = document.getElementById('dnav');
  if (!nav) return;

  const supportPageOffset = window.pageXOffset !== undefined;
  const isCSS1Compat = (document.compatMode || '') === 'CSS1Compat';

  let previousScrollPosition = 0;

  const isScrollingDown = (): boolean => {
    const scrolledPosition = supportPageOffset
      ? window.pageYOffset
      : isCSS1Compat
        ? document.documentElement.scrollTop
        : document.body.scrollTop;
    let isScrollDown: boolean;

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

  let throttleTimer: boolean;

  const throttle = (callback: () => void, time: number) => {
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
