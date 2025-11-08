/**
 * Application configuration and initialization.
 * Sets up database and event listeners.
 */
import { processDirective } from 'services/processDirective';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { isDev } from 'functions/isDev';
import { env } from 'settings/env';

import { PROCESS_DIRECTIVE } from 'constants/comsConstants';

export function initConfig(): Promise<void> {
  return new Promise((resolve, reject) => {
    initListeners();

    const initWithDB = () => {};

    const DBready = () => {
      initWithDB();
      resolve();
    };

    initDB().then(DBready, reject);
  });
}

const catchAsync =
  (fn: (...args: any[]) => Promise<any>) =>
  (...args: any[]) =>
    isDev() ? fn(...args) : fn(...args).catch((err) => console.log(err));

function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const initTMXdb = () => new Promise<void>((rz, rj) => catchAsync(tmx2db.initDB)().then(() => resolve(), dbUpgrade).then(rz, rj));
    initTMXdb().then(resolve, reject);
  });
}

function dbUpgrade(): void {
  const message = '<h2>Database Upgraded</h2><div style="margin: 1em;">Please Close Browser and Re-launch</div>';
  context.modal.inform({ message });
}

function addMessage(msg: any): void {
  const msgHash = (m: any) =>
    Object.keys(m)
      .map((key) => m[key])
      .join('');
  const messageHash = msgHash(msg);
  const exists = env.messages.reduce((p: boolean, c: any) => (msgHash(c) === messageHash ? true : p), false);
  if (!exists) env.messages.push(msg);
}

function initListeners(): void {
  context.ee.addListener(PROCESS_DIRECTIVE, processDirective);
  context.ee.addListener('addMessage', addMessage);
}
