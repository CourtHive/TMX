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

export class EventManager {
  elapsed = 100000;
  held: any;
  touched: any;
  coords: any;
  holdTime = 800;
  holdAction: any;

  private registeredFunctions: Record<string, Record<string, RegisteredFunction>> = {};
  private keys: Record<string, string[]> = {};
  private touchTimer: NodeJS.Timeout | undefined;
  private lastTap = 0;

  constructor() {
    this.attachListeners();
  }

  reset = (): this => {
    this.registeredFunctions = {};
    this.keys = {};
    return this;
  };

  register = (cls: string, evnt: string, fx: Function, _delay?: number): this => {
    if (typeof fx === 'function') {
      if (!this.registeredFunctions[evnt]) {
        this.registeredFunctions[evnt] = {};
        this.keys[evnt] = [];
      }
      this.registeredFunctions[evnt][cls] = { fx, delay: _delay };
      this.keys[evnt] = Object.keys(this.registeredFunctions[evnt]);
    }
    return this;
  };

  deRegister = (cls: string, evnt: string): this => {
    if (this.registeredFunctions[evnt]) {
      delete this.registeredFunctions[evnt][cls];
      this.keys[evnt] = Object.keys(this.registeredFunctions[evnt]);
    }
    return this;
  };

  call = (cls: string, evnt: string, ...args: any[]): any => {
    return this.registeredFunctions?.[evnt]?.[cls]?.fx(...args);
  };

  trigger = (cls: string, evnt: string, target: any, mouse: MouseCoords): any => {
    return this.registeredFunctions[evnt][cls].fx(target, mouse, evnt);
  };

  list = (): void => {
    console.log(this.registeredFunctions);
  };

  // ── Private ──

  private attachListeners(): void {
    const tapHandler = 'ontouchstart' in document.documentElement ? 'touchstart' : 'click';
    document.addEventListener(tapHandler, (evt) => this.processEvent(evt, 'tap'));
    document.addEventListener('change', (evt) => this.processEvent(evt, 'change'));
    document.addEventListener('click', (evt) => this.processEvent(evt, 'click'));
    document.addEventListener('mouseover', (evt) => this.processEvent(evt, 'mouseover', false));
    document.addEventListener('mouseout', (evt) => this.processEvent(evt, 'mouseout', false));
    document.addEventListener('keyup', (evt) => this.processEvent(evt, 'keyup', false));

    document.addEventListener(
      'touchstart',
      (e: Event) => {
        const te = e as TouchEvent;
        this.touched = te.target;
        this.coords = [te.touches[0].clientX, te.touches[0].clientY];
        if (this.touched) {
          this.touchTimer = setTimeout(() => this.holdActionFire(), this.holdTime);
        }
      },
      false,
    );
    document.addEventListener('touchend', () => this.touchLeave(), false);
    document.addEventListener(
      'touchmove',
      (e: Event) => {
        const te = e as TouchEvent;
        if (this.touched !== te.target) this.touchLeave();
      },
      false,
    );

    // Device type detection (touch vs mouse)
    let isTouch = false;
    let isTouchTimer: NodeJS.Timeout;
    let curRootClass = '';

    document.addEventListener(
      'touchstart',
      () => {
        clearTimeout(isTouchTimer);
        isTouch = true;
        if (curRootClass !== 'can-touch') {
          curRootClass = 'can-touch';
          document.documentElement.classList.add(curRootClass);
        }
        isTouchTimer = setTimeout(() => {
          isTouch = false;
        }, 500);
      },
      { passive: true },
    );
    document.addEventListener(
      'mouseover',
      () => {
        if (!isTouch && curRootClass === 'can-touch') {
          isTouch = false;
          curRootClass = '';
          document.documentElement.classList.remove('can-touch');
        }
      },
      { passive: true },
    );
  }

  private processEvent(evt: Event, evnt: string, stopPropagation = true): void {
    if (stopPropagation) evt.stopPropagation();
    const mouseEvent = evt as MouseEvent;
    const mouse: MouseCoords = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
    };
    const classList = Array.from((evt.target as HTMLElement).classList);
    const intersection = classList.filter((c) => this.keys[evnt]?.includes(c));
    if (intersection.length) {
      const thisTap = Date.now();
      this.elapsed = thisTap - this.lastTap;
      this.lastTap = thisTap;
      for (const cls of intersection) {
        this.registeredFunctions[evnt][cls].fx(evt.target, mouse, evnt, evt);
      }
    }
  }

  private touchLeave(): void {
    clearTimeout(this.touchTimer);
  }

  private holdActionFire(): void {
    if (typeof this.holdAction === 'function') {
      this.held = this.touched;
      this.holdAction(this.held, this.coords);
    }
  }
}

export const eventManager = new EventManager();
