/**
 * Generic DOM event manager with class-based event registration.
 * Supports touch and mouse events with hold detection and device type detection.
 */

interface RegisteredFunction {
  fx: Function;
  delay?: number;
}

interface MouseCoords {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
}

export const eventManager = (function () {
  let touchTimer: NodeJS.Timeout;
  const em: any = {
    elapsed: 100000,
    held: undefined as any,
    touched: undefined as any,
    holdTime: 800,
    holdAction: undefined as any,
    holdActions: {},
  };
  const keys: Record<string, string[]> = {};
  let registeredFunctions: Record<string, Record<string, RegisteredFunction>> = {};
  const intersection = (a: string[], b: string[]) => a.filter((n) => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);

  em.reset = () => {
    registeredFunctions = {};
    return em;
  };

  em.register = (cls: string, evnt: string, fx: Function, delay?: number) => {
    if (typeof fx == 'function') {
      if (!registeredFunctions[evnt]) {
        registeredFunctions[evnt] = {};
        keys[evnt] = [];
      }
      registeredFunctions[evnt][cls] = { fx, delay };
      keys[evnt] = Object.keys(registeredFunctions[evnt]);
    }
    return em;
  };

  em.deRegister = (cls: string, evnt: string) => {
    if (registeredFunctions[evnt]) {
      delete registeredFunctions[evnt][cls];
      keys[evnt] = Object.keys(registeredFunctions[evnt]);
    }
    return em;
  };

  em.call = (cls: string, evnt: string, ...args: any[]) => {
    return registeredFunctions?.[evnt]?.[cls]?.fx(...args);
  };
  em.trigger = (cls: string, evnt: string, target: any, mouse: MouseCoords) => registeredFunctions[evnt][cls].fx(target, mouse, evnt);
  em.list = () => console.log(registeredFunctions);

  const tapHandler = 'ontouchstart' in document.documentElement ? 'touchstart' : 'click';
  document.addEventListener(tapHandler, (evt) => processEvnt({ evt, evnt: 'tap' }));
  document.addEventListener('change', (evt) => processEvnt({ evt, evnt: 'change' }));
  document.addEventListener('click', (evt) => processEvnt({ evt, evnt: 'click' }));
  document.addEventListener('mouseover', (evt) => processEvnt({ evt, evnt: 'mouseover', stopPropagation: false }));
  document.addEventListener('mouseout', (evt) => processEvnt({ evt, evnt: 'mouseout', stopPropagation: false }));
  document.addEventListener('keyup', (evt) => processEvnt({ evt, evnt: 'keyup', stopPropagation: false }));

  let lastTap = 0;

  function processEvnt({ evt, evnt, stopPropagation = true }: { evt: Event; evnt: string; stopPropagation?: boolean }) {
    if (stopPropagation) evt.stopPropagation();
    const mouseEvent = evt as MouseEvent;
    const mouse: MouseCoords = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
    };
    const classList = Array.from((evt.target as HTMLElement).classList);
    const matchedClasses = classList.length && keys[evnt] ? intersection(classList, keys[evnt]) : [];
    if (matchedClasses.length) {
      const thisTap = new Date().getTime();
      em.elapsed = thisTap - lastTap;
      lastTap = thisTap;
      matchedClasses.forEach((cls) => {
        callFunction({ cls, evt, evnt, mouse });
      });
    }
  }

  function callFunction({ cls, evt, evnt, mouse }: { cls: string; evt: Event; evnt: string; mouse: MouseCoords }) {
    const target = evt.target;
    registeredFunctions[evnt][cls].fx(target, mouse, evnt, evt);
  }

  document.addEventListener(
    'touchstart',
    (pointerEvent: Event) => {
      const touchEvent = pointerEvent as TouchEvent;
      em.touched = touchEvent.target;
      em.coords = [touchEvent.touches[0].clientX, touchEvent.touches[0].clientY];
      if (em.touched) {
        touchTimer = setTimeout(function () {
          holdAction();
        }, em.holdTime);
      }
    },
    false,
  );
  document.addEventListener(
    'touchend',
    function () {
      touchleave();
    },
    false,
  );
  document.addEventListener(
    'touchmove',
    function (pointerEvent: Event) {
      const touchEvent = pointerEvent as TouchEvent;
      if (em.touched !== touchEvent.target) touchleave();
    },
    false,
  );
  function touchleave() {
    clearTimeout(touchTimer);
  }
  function holdAction() {
    if (typeof em.holdAction == 'function') {
      em.held = em.touched;
      em.holdAction(em.held, em.coords);
    }
  }

  (function () {
    let isTouch = false;
    let isTouchTimer: NodeJS.Timeout;
    let curRootClass = '';

    function addtouchclass() {
      clearTimeout(isTouchTimer);
      isTouch = true;
      if (curRootClass !== 'can-touch') {
        curRootClass = 'can-touch';
        document.documentElement.classList.add(curRootClass);
      }
      isTouchTimer = setTimeout(function () {
        isTouch = false;
      }, 500);
    }

    function removetouchclass() {
      if (!isTouch && curRootClass === 'can-touch') {
        isTouch = false;
        curRootClass = '';
        document.documentElement.classList.remove('can-touch');
      }
    }

    document.addEventListener('touchstart', addtouchclass, false);
    document.addEventListener('mouseover', removetouchclass, false);
  })();

  return em;
})();
