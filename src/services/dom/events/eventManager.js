export const eventManager = (function () {
  let touchTimer;
  let em = {
    elapsed: 100000,
    held: undefined,
    touched: undefined,
    holdTime: 800,
    holdAction: undefined,
    holdActions: {},
  };
  const keys = {};
  let registeredFunctions = {};
  const intersection = (a, b) => a.filter((n) => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);

  em.reset = () => {
    registeredFunctions = {};
    return em;
  };

  em.register = (cls, evnt, fx, delay) => {
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

  em.deRegister = (cls, evnt) => {
    if (registeredFunctions[evnt]) {
      delete registeredFunctions[evnt][cls];
      keys[evnt] = Object.keys(registeredFunctions[evnt]);
    }
    return em;
  };

  em.call = (cls, evnt, ...args) => {
    return registeredFunctions?.[evnt]?.[cls]?.fx(...args);
  };
  em.trigger = (cls, evnt, target, mouse) => registeredFunctions[evnt][cls].fx(target, mouse, evnt);
  em.list = () => console.log(registeredFunctions);

  const tapHandler = 'ontouchstart' in document.documentElement ? 'touchstart' : 'click';
  document.addEventListener(tapHandler, (evt) => processEvnt({ evt, evnt: 'tap' }));
  document.addEventListener('change', (evt) => processEvnt({ evt, evnt: 'change' }));
  document.addEventListener('click', (evt) => processEvnt({ evt, evnt: 'click' }));
  document.addEventListener('mouseover', (evt) => processEvnt({ evt, evnt: 'mouseover', stopPropagation: false }));
  document.addEventListener('mouseout', (evt) => processEvnt({ evt, evnt: 'mouseout', stopPropagation: false }));
  document.addEventListener('keyup', (evt) => processEvnt({ evt, evnt: 'keyup', stopPropagation: false }));

  let lastTap = 0;

  function processEvnt({ evt, evnt, stopPropagation = true }) {
    if (stopPropagation) evt.stopPropagation();
    const mouse = {
      x: evt.clientX,
      y: evt.clientY,
      pageX: evt.pageX,
      pageY: evt.pageY,
    };
    let classList = Array.from(evt.target.classList);
    let matchedClasses = classList.length && keys[evnt] ? intersection(classList, keys[evnt]) : [];
    if (matchedClasses.length) {
      let thisTap = new Date().getTime();
      em.elapsed = thisTap - lastTap;
      lastTap = thisTap;
      matchedClasses.forEach((cls) => {
        callFunction({ cls, evt, evnt, mouse });
      });
    }
  }

  function callFunction({ cls, evt, evnt, mouse }) {
    let target = evt.target;
    registeredFunctions[evnt][cls].fx(target, mouse, evnt, evt);
  }

  document.addEventListener(
    'touchstart',
    (pointerEvent) => {
      em.touched = pointerEvent.target;
      em.coords = [pointerEvent.touches[0].clientX, pointerEvent.touches[0].clientY];
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
    function (pointerEvent) {
      if (em.touched !== pointerEvent.target) touchleave();
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
    let isTouch = false; //let to indicate current input type (is touch versus no touch)
    let isTouchTimer;
    let curRootClass = ''; //let indicating current document root class ("can-touch" or "")

    function addtouchclass() {
      clearTimeout(isTouchTimer);
      isTouch = true;
      if (curRootClass !== 'can-touch') {
        //add "can-touch' class if it's not already present
        curRootClass = 'can-touch';
        document.documentElement.classList.add(curRootClass);
      }
      //maintain "istouch" state for 500ms so removetouchclass doesn't get fired immediately following a touch event
      isTouchTimer = setTimeout(function () {
        isTouch = false;
      }, 500);
    }

    function removetouchclass() {
      // console.log('removing touch class');
      if (!isTouch && curRootClass === 'can-touch') {
        //remove 'can-touch' class if not triggered by a touch event and class is present
        isTouch = false;
        curRootClass = '';
        document.documentElement.classList.remove('can-touch');
      }
    }

    document.addEventListener('touchstart', addtouchclass, false); //this event only gets called when input type is touch
    document.addEventListener('mouseover', removetouchclass, false); //this event gets called when input type is everything from touch to mouse/ trackpad
  })();

  return em;
})();
