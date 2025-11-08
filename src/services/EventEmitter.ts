/**
 * EventEmitter - Generic event management class.
 * Can be extended to provide event functionality in other classes.
 * 
 * @preserve
 * EventEmitter v5.2.6 - git.io/ee
 * Unlicense - http://unlicense.org/
 * Oliver Caldwell - https://oli.me.uk/
 */

interface ListenerObject {
  listener: Function;
  once: boolean;
}

export const EventEmitter = (function () {
  /**
   * Class for managing events.
   * Can be extended to provide event functionality in other classes.
   *
   * @class EventEmitter Manages event registering and emitting.
   */
  function EventEmitter() {
    //
  }

  const proto = EventEmitter.prototype;

  /**
   * Finds the index of the listener for the event in its storage array.
   */
  function indexOfListener(listeners: ListenerObject[], listener: Function): number {
    let i = listeners.length;
    while (i--) {
      if (listeners[i].listener === listener) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Alias a method while keeping the context correct, to allow for overwriting of target method.
   */
  function alias(name: string) {
    return function aliasClosure(this: any) {
      return this[name].apply(this, arguments);
    };
  }

  /**
   * Returns the listener array for the specified event.
   */
  proto.getListeners = function getListeners(evt: string | RegExp): ListenerObject[] | Record<string, ListenerObject[]> {
    const events = this._getEvents();
    let response: any;
    let key: string;

    if (evt instanceof RegExp) {
      response = {};
      for (key in events) {
        if (events.hasOwnProperty(key) && evt.test(key)) {
          response[key] = events[key];
        }
      }
    } else {
      response = events[evt] || (events[evt] = []);
    }

    return response;
  };

  /**
   * Takes a list of listener objects and flattens it into a list of listener functions.
   */
  proto.flattenListeners = function flattenListeners(listeners: ListenerObject[]): Function[] {
    const flatListeners: Function[] = [];

    for (let i = 0; i < listeners.length; i += 1) {
      flatListeners.push(listeners[i].listener);
    }

    return flatListeners;
  };

  /**
   * Fetches the requested listeners via getListeners but will always return the results inside an object.
   */
  proto.getListenersAsObject = function getListenersAsObject(evt: string | RegExp): Record<string, ListenerObject[]> {
    const listeners = this.getListeners(evt);
    let response: any;

    if (listeners instanceof Array) {
      response = {};
      response[evt as string] = listeners;
    }

    return response || listeners;
  };

  function isValidListener(listener: any): boolean {
    if (typeof listener === 'function' || listener instanceof RegExp) {
      return true;
    } else if (listener && typeof listener === 'object') {
      return isValidListener(listener.listener);
    } else {
      return false;
    }
  }

  /**
   * Adds a listener function to the specified event.
   */
  proto.addListener = function addListener(this: any, evt: string | RegExp, listener: Function | ListenerObject): any {
    if (!isValidListener(listener)) {
      throw new TypeError('listener must be a function');
    }

    const listeners = this.getListenersAsObject(evt);
    const listenerIsWrapped = typeof listener === 'object';
    let key: string;

    for (key in listeners) {
      if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listenerIsWrapped ? (listener as ListenerObject).listener : listener) === -1) {
        listeners[key].push(
          listenerIsWrapped
            ? (listener as ListenerObject)
            : {
                listener: listener as Function,
                once: false
              }
        );
      }
    }

    return this;
  };

  proto.on = alias('addListener');

  /**
   * Semi-alias of addListener. It will add a listener that will be
   * automatically removed after its first execution.
   */
  proto.addOnceListener = function addOnceListener(this: any, evt: string | RegExp, listener: Function): any {
    return this.addListener(evt, {
      listener: listener,
      once: true
    });
  };

  proto.once = alias('addOnceListener');

  /**
   * Defines an event name. This is required if you want to use a regex to add a listener to multiple events at once.
   */
  proto.defineEvent = function defineEvent(this: any, evt: string): any {
    this.getListeners(evt);
    return this;
  };

  /**
   * Uses defineEvent to define multiple events.
   */
  proto.defineEvents = function defineEvents(this: any, evts: string[]): any {
    for (let i = 0; i < evts.length; i += 1) {
      this.defineEvent(evts[i]);
    }
    return this;
  };

  /**
   * Removes a listener function from the specified event.
   */
  proto.removeListener = function removeListener(this: any, evt: string | RegExp, listener: Function): any {
    const listeners = this.getListenersAsObject(evt);
    let index: number;
    let key: string;

    for (key in listeners) {
      if (listeners.hasOwnProperty(key)) {
        index = indexOfListener(listeners[key], listener);

        if (index !== -1) {
          listeners[key].splice(index, 1);
        }
      }
    }

    return this;
  };

  proto.off = alias('removeListener');

  /**
   * Adds listeners in bulk using the manipulateListeners method.
   */
  proto.addListeners = function addListeners(this: any, evt: string | Record<string, Function | Function[]> | RegExp, listeners?: Function[]): any {
    return this.manipulateListeners(false, evt, listeners);
  };

  /**
   * Removes listeners in bulk using the manipulateListeners method.
   */
  proto.removeListeners = function removeListeners(this: any, evt: string | Record<string, Function | Function[]> | RegExp, listeners?: Function[]): any {
    return this.manipulateListeners(true, evt, listeners);
  };

  /**
   * Edits listeners in bulk.
   */
  proto.manipulateListeners = function manipulateListeners(this: any, remove: boolean, evt: string | Record<string, Function | Function[]> | RegExp, listeners?: Function[]): any {
    let i: any;
    let value: any;
    const single = remove ? this.removeListener : this.addListener;
    const multiple = remove ? this.removeListeners : this.addListeners;

    if (typeof evt === 'object' && !(evt instanceof RegExp)) {
      for (i in evt) {
        if (evt.hasOwnProperty(i) && (value = evt[i])) {
          if (typeof value === 'function') {
            single.call(this, i, value);
          } else {
            multiple.call(this, i, value);
          }
        }
      }
    } else {
      i = listeners!.length;
      while (i--) {
        single.call(this, evt, listeners![i]);
      }
    }

    return this;
  };

  /**
   * Removes all listeners from a specified event.
   */
  proto.removeEvent = function removeEvent(this: any, evt?: string | RegExp): any {
    const type = typeof evt;
    const events = this._getEvents();
    let key: string;

    if (type === 'string') {
      delete events[evt as string];
    } else if (evt instanceof RegExp) {
      for (key in events) {
        if (events.hasOwnProperty(key) && (evt as RegExp).test(key)) {
          delete events[key];
        }
      }
    } else {
      delete this._events;
    }

    return this;
  };

  proto.removeAllListeners = alias('removeEvent');

  /**
   * Emits an event of your choice.
   */
  proto.emitEvent = function emitEvent(this: any, evt: string | RegExp, args?: any[]): any {
    const listenersMap = this.getListenersAsObject(evt);
    let listeners: ListenerObject[];
    let listener: ListenerObject;
    let i: number;
    let key: string;
    let response: any;

    for (key in listenersMap) {
      if (listenersMap.hasOwnProperty(key)) {
        listeners = listenersMap[key].slice(0);

        for (i = 0; i < listeners.length; i++) {
          listener = listeners[i];

          if (listener.once === true) {
            this.removeListener(evt, listener.listener);
          }

          response = listener.listener.apply(this, args || []);

          if (response === this._getOnceReturnValue()) {
            this.removeListener(evt, listener.listener);
          }
        }
      }
    }

    return this;
  };

  proto.trigger = alias('emitEvent');

  /**
   * Subtly different from emitEvent in that it will pass its arguments on to the listeners.
   */
  proto.emit = function emit(this: any, evt: string | RegExp, ...args: any[]): any {
    return this.emitEvent(evt, args);
  };

  proto.setOnceReturnValue = function setOnceReturnValue(this: any, value: any): any {
    this._onceReturnValue = value;
    return this;
  };

  proto._getOnceReturnValue = function _getOnceReturnValue(): any {
    if (this.hasOwnProperty('_onceReturnValue')) {
      return this._onceReturnValue;
    } else {
      return true;
    }
  };

  proto._getEvents = function _getEvents(): Record<string, ListenerObject[]> {
    return this._events || (this._events = {});
  };

  return EventEmitter;
})();
