'use strict';

const assert = require('assert');

const splashPath = require.resolve('../pages/splash/splash.js');
const loginServicePath = require.resolve('../utils/login-service.js');

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createSplashHarness = (syncPromise) => {
  let pageDefinition = null;
  let nextTimerId = 1;
  const timers = new Map();
  const navigation = [];
  const pageUpdates = [];
  const app = { globalData: {} };

  delete require.cache[splashPath];
  require.cache[loginServicePath] = {
    id: loginServicePath,
    filename: loginServicePath,
    loaded: true,
    exports: {
      doSilentLogin: () => syncPromise
    }
  };

  global.Page = (definition) => {
    pageDefinition = definition;
  };
  global.getApp = () => app;
  global.wx = {
    reLaunch: (options) => navigation.push({ method: 'reLaunch', url: options.url }),
    switchTab: (options) => navigation.push({ method: 'switchTab', url: options.url }),
    showModal: (options) => pageUpdates.push({ type: 'modal', options })
  };
  global.setTimeout = (callback, delay) => {
    const id = nextTimerId++;
    timers.set(id, { callback, delay, cleared: false });
    return id;
  };
  global.clearTimeout = (id) => {
    const timer = timers.get(id);
    if (timer) timer.cleared = true;
  };

  require(splashPath);
  assert.ok(pageDefinition, 'splash page must register itself');

  const page = {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    setData: (patch) => {
      pageUpdates.push({ type: 'setData', patch });
      Object.assign(page.data, patch);
    }
  };

  const runTimer = (delay, options = {}) => {
    const timer = Array.from(timers.values()).find((item) => (
      item.delay === delay && (options.includeCleared === true || !item.cleared)
    ));
    assert.ok(timer, `a ${delay}ms timer must be scheduled`);
    timer.callback();
  };

  return { app, navigation, page, pageUpdates, runTimer };
};

(async () => {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;

  try {
    // Root-cause regression: App navigation unloads Splash before the
    // background synchronization promise settles.
    const lateSync = createDeferred();
    let lateSyncCompleted = false;
    lateSync.promise.then(() => {
      lateSyncCompleted = true;
    });
    const stale = createSplashHarness(lateSync.promise);
    stale.page.onLoad();
    stale.page.onUnload();
    stale.runTimer(1120, { includeCleared: true });
    stale.runTimer(1500);
    lateSync.resolve({ ok: true, pending: 0 });
    await flushPromises();
    await flushPromises();

    assert.strictEqual(
      lateSyncCompleted,
      true,
      'invalidating Splash must not cancel the background synchronization promise'
    );
    assert.deepStrictEqual(
      stale.navigation,
      [],
      'a synchronization callback arriving after splash onUnload must not navigate'
    );
    assert.deepStrictEqual(
      stale.pageUpdates,
      [],
      'timers and synchronization callbacks must not operate on an unloaded splash page'
    );
    assert.strictEqual(
      stale.app.globalData.syncFreshCompleted,
      undefined,
      'an invalid splash session must not publish splash navigation notice state'
    );

    // A still-active Splash session must preserve the original fast-sync path.
    const fast = createSplashHarness(Promise.resolve({ ok: true, pending: 0 }));
    fast.page.onLoad();
    await flushPromises();
    fast.runTimer(1500);
    await flushPromises();
    assert.deepStrictEqual(fast.navigation, [
      { method: 'reLaunch', url: '/pages/index/index' }
    ]);
    assert.strictEqual(fast.app.globalData.syncFreshCompleted, true);

    // Failure remains non-blocking and still enters the product once.
    const failed = createSplashHarness(Promise.reject(new Error('offline')));
    failed.page.onLoad();
    await flushPromises();
    failed.runTimer(1500);
    await flushPromises();
    assert.strictEqual(failed.navigation.length, 1);
    assert.strictEqual(failed.app.globalData.syncFreshFailed, true);

    // Timeout followed by a late completion signal must never navigate twice.
    const timedOutSync = createDeferred();
    const timedOut = createSplashHarness(timedOutSync.promise);
    timedOut.page.onLoad();
    timedOut.runTimer(20000);
    assert.strictEqual(timedOut.navigation.length, 1);
    timedOut.runTimer(1500);
    timedOutSync.resolve({ ok: true, pending: 0 });
    await flushPromises();
    await flushPromises();
    assert.strictEqual(
      timedOut.navigation.length,
      1,
      'timeout and synchronization completion signals must share the one-jump guard'
    );

    console.log('startup-splash-session: PASS');
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    delete require.cache[splashPath];
    delete require.cache[loginServicePath];
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
