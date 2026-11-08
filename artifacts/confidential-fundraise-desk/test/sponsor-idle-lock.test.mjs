import assert from 'node:assert/strict';
import test from 'node:test';
import { startSponsorIdleLock } from '../src/lib/sponsor-idle-lock.ts';

function installBrowserHarness() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const listeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  const windowMock = {
    addEventListener: (name, listener) => listeners.set(`window:${name}`, listener),
    removeEventListener: (name) => listeners.delete(`window:${name}`),
    setTimeout: (callback) => {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const documentMock = {
    visibilityState: 'visible',
    addEventListener: (name, listener) => listeners.set(`document:${name}`, listener),
    removeEventListener: (name) => listeners.delete(`document:${name}`),
  };

  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
  const restore = () => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  };

  return { documentMock, listeners, restore, timers };
}

test('sponsor idle lock resets on activity and locks again after the next idle period', (t) => {
  const { listeners, restore, timers } = installBrowserHarness();
  let lockCount = 0;
  const cleanup = startSponsorIdleLock(() => lockCount++, 100);
  t.after(() => {
    cleanup();
    restore();
  });

  const firstTimer = [...timers.keys()][0];
  listeners.get('window:pointerdown')();
  assert.equal(timers.has(firstTimer), false);
  assert.equal(timers.size, 1);

  const firstActiveTimer = [...timers.values()][0];
  firstActiveTimer();
  assert.equal(lockCount, 1);
  assert.equal(timers.size, 0);

  listeners.get('window:keydown')();
  [...timers.values()][0]();
  assert.equal(lockCount, 2);
});

test('sponsor idle lock clears immediately when the page becomes hidden', (t) => {
  const { documentMock, listeners, restore, timers } = installBrowserHarness();
  let lockCount = 0;
  const cleanup = startSponsorIdleLock(() => lockCount++, 100);
  t.after(() => {
    cleanup();
    restore();
  });

  documentMock.visibilityState = 'hidden';
  listeners.get('document:visibilitychange')();

  assert.equal(lockCount, 1);
  assert.equal(timers.size, 0);
});
