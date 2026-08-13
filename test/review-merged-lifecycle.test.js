'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pagePath = path.resolve(__dirname, '../subpages/review-merged/review-merged.js');

const loadPageDefinition = () => {
  let definition = null;
  global.Page = (pageDefinition) => {
    definition = pageDefinition;
  };
  delete require.cache[require.resolve(pagePath)];
  require(pagePath);
  assert.ok(definition, 'review-merged must register Page');
  return definition;
};

const createEventBus = () => {
  const listeners = new Map();
  const onCalls = [];
  const offCalls = [];

  return {
    globalData: {},
    on(eventName, handler) {
      onCalls.push({ eventName, handler });
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
    },
    off(eventName, handler) {
      offCalls.push({ eventName, handler });
      listeners.get(eventName)?.delete(handler);
    },
    emit(eventName, payload) {
      Array.from(listeners.get(eventName) || []).forEach((handler) => handler(payload));
    },
    listenerCount(eventName) {
      return listeners.get(eventName)?.size || 0;
    },
    onCalls,
    offCalls
  };
};

const createTimerHarness = () => {
  let nextId = 1;
  const timers = new Map();

  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay, cleared: false, fired: false });
      return id;
    },
    clearTimeout(id) {
      const timer = timers.get(id);
      if (timer) timer.cleared = true;
    },
    pendingCount() {
      return Array.from(timers.values()).filter((timer) => !timer.cleared && !timer.fired).length;
    },
    firePending() {
      Array.from(timers.values()).forEach((timer) => {
        if (timer.cleared || timer.fired) return;
        timer.fired = true;
        timer.callback();
      });
    }
  };
};

const createPage = (definition, counters) => {
  const page = Object.assign({}, definition);
  page.data = {
    ...definition.data,
    learningMode: null,
    currentStudent: { id: 'student456', name: 'Test Student' },
    currentWordbook: { id: 'book_a', title: 'Test Book' }
  };
  page.setData = (patch) => {
    counters.setData += 1;
    Object.assign(page.data, patch);
  };
  page.syncFromGlobalData = () => {};
  page.checkSelectedStudentAndWordbook = () => {};
  page.initMergedViewProcess = () => {
    counters.refresh += 1;
  };
  return page;
};

const source = fs.readFileSync(pagePath, 'utf8');
assert.strictEqual(
  (source.match(/\bonUnload\s*:/g) || []).length,
  1,
  'review-merged must define exactly one onUnload lifecycle method'
);

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

try {
  const app = createEventBus();
  const timers = createTimerHarness();
  let hideLoadingCount = 0;
  global.getApp = () => app;
  global.setTimeout = timers.setTimeout;
  global.clearTimeout = timers.clearTimeout;
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    showToast: () => {},
    showLoading: () => {},
    hideLoading: () => {
      hideLoadingCount += 1;
    }
  };

  const definition = loadPageDefinition();
  const counters = { refresh: 0, setData: 0 };
  const page = createPage(definition, counters);

  // Scenarios 1 and 6: one active listener, and one event causes one refresh.
  page.onLoad({});
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);
  const staleHandler = app.onCalls.at(-1).handler;
  app.emit('wordMasteryUpdated');
  assert.strictEqual(counters.refresh, 1);

  // Scenario 7: the review availability timer runs while the page is active.
  page.scheduleReviewAvailabilityRefresh([{ time: Date.now() + 60 * 1000 }]);
  assert.strictEqual(timers.pendingCount(), 1);
  timers.firePending();
  assert.strictEqual(counters.refresh, 2);

  // Scenarios 2, 3 and 8: unload removes the same handler and cancels all page timers.
  page.scheduleReviewAvailabilityRefresh([{ time: Date.now() + 60 * 1000 }]);
  page.refreshRecords();
  assert.strictEqual(timers.pendingCount(), 2);
  const updatesBeforeUnload = counters.setData;
  const refreshesBeforeUnload = counters.refresh;
  page.onUnload();
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
  assert.strictEqual(timers.pendingCount(), 0);
  assert.strictEqual(app.offCalls.at(-1).handler, app.onCalls.at(-1).handler);
  app.emit('wordMasteryUpdated');
  staleHandler();
  timers.firePending();
  assert.strictEqual(counters.refresh, refreshesBeforeUnload);
  assert.strictEqual(counters.setData, updatesBeforeUnload);
  assert.strictEqual(hideLoadingCount, 1);

  // Cleanup remains idempotent if the framework or a harness calls it again.
  const offCountAfterUnload = app.offCalls.length;
  page.onUnload();
  assert.strictEqual(app.offCalls.length, offCountAfterUnload);

  // Scenarios 4 and 5: three enter/exit cycles never accumulate listeners.
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const cycleCounters = { refresh: 0, setData: 0 };
    const cyclePage = createPage(definition, cycleCounters);
    cyclePage.onLoad({});
    assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);
    app.emit('wordMasteryUpdated');
    assert.strictEqual(cycleCounters.refresh, 1);
    cyclePage.onUnload();
    assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 0);
  }

  const activeCounters = { refresh: 0, setData: 0 };
  const activePage = createPage(definition, activeCounters);
  activePage.onLoad({});
  app.emit('wordMasteryUpdated');
  assert.strictEqual(activeCounters.refresh, 1);
  assert.strictEqual(app.listenerCount('wordMasteryUpdated'), 1);

  // Hide clears the timer; showing and reinitializing may create one new timer.
  activePage.scheduleReviewAvailabilityRefresh([{ time: Date.now() + 60 * 1000 }]);
  assert.strictEqual(timers.pendingCount(), 1);
  activePage.onHide();
  assert.strictEqual(timers.pendingCount(), 0);
  activePage.scheduleReviewAvailabilityRefresh([{ time: Date.now() + 60 * 1000 }]);
  assert.strictEqual(timers.pendingCount(), 1);
  activePage.onUnload();
  assert.strictEqual(timers.pendingCount(), 0);

  process.stdout.write('review-merged-lifecycle: PASS\n');
} finally {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
  delete require.cache[require.resolve(pagePath)];
}
