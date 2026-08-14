'use strict';

const assert = require('assert');

function createEventBus() {
  return {
    globalData: {},
    eventListeners: {},
    onCalls: [],
    offCalls: [],
    on(eventName, handler) {
      if (!this.eventListeners[eventName]) {
        this.eventListeners[eventName] = [];
      }
      this.eventListeners[eventName].push(handler);
      this.onCalls.push({ eventName, handler });
    },
    off(eventName, handler) {
      this.offCalls.push({ eventName, handler });
      if (!this.eventListeners[eventName]) return;
      if (handler) {
        this.eventListeners[eventName] = this.eventListeners[eventName]
          .filter((candidate) => candidate !== handler);
      } else {
        delete this.eventListeners[eventName];
      }
    },
    emit(eventName, payload) {
      (this.eventListeners[eventName] || []).slice().forEach((handler) => handler(payload));
    },
    listenerCount(eventName) {
      return (this.eventListeners[eventName] || []).length;
    }
  };
}

const app = createEventBus();
global.getApp = () => app;
global.wx = {
  getStorageSync() {
    return undefined;
  },
  setStorageSync() {},
  showToast() {}
};

const originalSetTimeout = global.setTimeout;
global.setTimeout = () => 1;

let indexDefinition = null;
global.Page = (definition) => {
  indexDefinition = definition;
};
require('../pages/index/index.js');
assert.ok(indexDefinition, 'index page must register itself');

function createPage(label) {
  const counters = {
    calculateAntiForgotTime: 0,
    setData: 0,
    learningRecordAdded: 0,
    learningRecordDeleted: 0,
    cloudSyncComplete: 0,
    startupNotice: 0
  };
  const page = {
    ...indexDefinition,
    data: {
      ...indexDefinition.data,
      currentStudent: null,
      currentWordbook: null
    }
  };

  page.setData = function setData(patch, callback) {
    counters.setData += 1;
    this.data = { ...this.data, ...patch };
    if (typeof callback === 'function') callback();
  };
  page.calculateAntiForgotTime = () => {
    counters.calculateAntiForgotTime += 1;
  };
  page.handleLearningRecordUpdate = () => {
    counters.learningRecordAdded += 1;
  };
  page.handleLearningRecordDelete = () => {
    counters.learningRecordDeleted += 1;
  };
  page.refreshAfterCloudSync = () => {
    counters.cloudSyncComplete += 1;
  };
  page.consumeStartupSyncNotice = () => {
    counters.startupNotice += 1;
  };

  return { label, page, counters };
}

function mount(label) {
  const instance = createPage(label);
  instance.page.onLoad({});
  return instance;
}

function snapshot(counters) {
  return { ...counters };
}

function assertNoSideEffects(counters, before, message) {
  assert.deepStrictEqual(counters, before, message);
}

try {
  // 1. A mounted homepage has one listener and responds exactly once.
  const first = mount('first');
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);
  const firstMasteryRegistration = app.onCalls.find(
    ({ eventName }) => eventName === 'wordMasteryUpdated'
  );
  assert.strictEqual(firstMasteryRegistration.handler, first.page.wordMasteryUpdateHandler);
  const mountedSetDataCount = first.counters.setData;
  app.emit('wordMasteryUpdated');
  assert.strictEqual(first.counters.calculateAntiForgotTime, 1);
  assert.strictEqual(first.counters.setData, mountedSetDataCount);

  // 2. After unload, emitting the event cannot touch the old page instance.
  first.page.onUnload();
  const firstAfterUnload = snapshot(first.counters);
  app.emit('wordMasteryUpdated');
  assertNoSideEffects(
    first.counters,
    firstAfterUnload,
    'unloaded homepage must not receive wordMasteryUpdated'
  );
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
  const firstMasteryOff = app.offCalls.find(
    ({ eventName }) => eventName === 'wordMasteryUpdated'
  );
  assert.ok(firstMasteryOff, 'unload must unregister wordMasteryUpdated');
  assert.strictEqual(firstMasteryOff.handler, firstMasteryRegistration.handler);

  // 3. Rebuilding leaves only the new instance active.
  const second = mount('second');
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);
  app.emit('wordMasteryUpdated');
  assertNoSideEffects(first.counters, firstAfterUnload, 'old instance must remain inactive');
  assert.strictEqual(second.counters.calculateAntiForgotTime, 1);

  // Other homepage listeners still respond once while active.
  app.emit('learningRecordAdded', { studentId: 'student-5b' });
  app.emit('learningRecordDeleted', { studentId: 'student-5b' });
  app.emit('cloudSyncComplete');
  assert.strictEqual(second.counters.learningRecordAdded, 1);
  assert.strictEqual(second.counters.learningRecordDeleted, 1);
  assert.strictEqual(second.counters.cloudSyncComplete, 1);

  const secondBeforeUnload = snapshot(second.counters);
  second.page.onUnload();
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
  assert.strictEqual(app.listenerCount('learningRecordAdded'), 0);
  assert.strictEqual(app.listenerCount('learningRecordDeleted'), 0);
  assert.strictEqual(app.listenerCount('cloudSyncComplete'), 0);
  app.emit('wordMasteryUpdated');
  app.emit('learningRecordAdded');
  app.emit('learningRecordDeleted');
  app.emit('cloudSyncComplete');
  assertNoSideEffects(
    second.counters,
    secondBeforeUnload,
    'unload must remove mastery and existing homepage listeners without conflict'
  );

  // 4. Repeated mount/unload cycles never accumulate listeners.
  const completedCycles = [];
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const current = mount(`cycle-${cycle}`);
    assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);
    app.emit('wordMasteryUpdated');
    assert.strictEqual(current.counters.calculateAntiForgotTime, 1);
    current.page.onUnload();
    assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
    const afterUnload = snapshot(current.counters);
    app.emit('wordMasteryUpdated');
    assertNoSideEffects(current.counters, afterUnload, `cycle ${cycle} leaked a listener`);
    completedCycles.push({ current, afterUnload });
  }

  // 5. After three cycles, one final mount still produces only one callback.
  const active = mount('active');
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);
  app.emit('wordMasteryUpdated');
  assert.strictEqual(active.counters.calculateAntiForgotTime, 1);
  completedCycles.forEach(({ current, afterUnload }) => {
    assertNoSideEffects(current.counters, afterUnload, `${current.label} became active again`);
  });

  console.log('homepage-mastery-listener-lifecycle counts:', JSON.stringify({
    mounted: 1,
    afterUnload: 0,
    rebuiltOld: 0,
    rebuiltNew: 1,
    repeatedCycles: 3,
    activeListenerCount: app.listenerCount('wordMasteryUpdated')
  }));
  console.log('homepage-mastery-listener-lifecycle: PASS');
} finally {
  global.setTimeout = originalSetTimeout;
}
