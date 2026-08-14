'use strict';

const assert = require('assert');
const Module = require('module');
const path = require('path');

const appPath = path.resolve(__dirname, '..', 'app.js');
const splashPath = path.resolve(__dirname, '..', 'pages', 'splash', 'splash.js');

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createHarness = async (options = {}) => {
  let now = 0;
  let nextTimerId = 1;
  let currentTimer = null;
  let appDefinition = null;
  let pageDefinition = null;
  let app = null;
  let splashPage = null;
  let route = 'pages/splash/splash';
  let stackDepth = 1;
  let homeInstances = 0;
  let successfulReLaunches = 0;
  const timers = new Map();
  const navigation = [];
  const reLaunchResults = (options.reLaunchResults || []).slice();
  const sync = createDeferred();

  const originals = {
    App: global.App,
    Page: global.Page,
    wx: global.wx,
    getApp: global.getApp,
    getCurrentPages: global.getCurrentPages,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout
  };
  const originalLoad = Module._load;

  const identifySource = () => {
    if (app && app._startupNavigationOwner) return app._startupNavigationOwner;
    const stack = new Error().stack || '';
    if (stack.includes(`${path.sep}pages${path.sep}splash${path.sep}splash.js`)) return 'splash';
    if (currentTimer && currentTimer.stack.includes(`${path.sep}app.js`)) return 'app-timer';
    if (stack.includes(`${path.sep}app.js`)) return 'app-timer';
    return 'unknown';
  };

  const unloadSplashIfNeeded = () => {
    if (
      route === 'pages/splash/splash' &&
      splashPage &&
      splashPage._isSplashSessionActive === true
    ) {
      splashPage.onUnload();
    }
  };

  const finishNavigation = (method, navigationOptions, succeeded) => {
    navigation.push({
      method,
      source: identifySource(),
      atMs: now,
      from: route,
      to: navigationOptions.url,
      succeeded
    });
    if (!succeeded) {
      if (typeof navigationOptions.fail === 'function') {
        navigationOptions.fail({ errMsg: `${method}:fail mock` });
      }
      return;
    }

    unloadSplashIfNeeded();
    route = navigationOptions.url.replace(/^\//, '');
    stackDepth = 1;
    if (method === 'reLaunch') successfulReLaunches += 1;
    if (route === 'pages/index/index') homeInstances += 1;
    if (typeof navigationOptions.success === 'function') {
      navigationOptions.success({ errMsg: `${method}:ok` });
    }
  };

  global.setTimeout = (callback, delay) => {
    const id = nextTimerId++;
    timers.set(id, {
      id,
      callback,
      due: now + Number(delay || 0),
      cleared: false,
      stack: new Error().stack || ''
    });
    return id;
  };
  global.clearTimeout = (id) => {
    const timer = timers.get(id);
    if (timer) timer.cleared = true;
  };
  global.App = (definition) => {
    appDefinition = definition;
  };
  global.Page = (definition) => {
    pageDefinition = definition;
  };
  global.getApp = () => app;
  global.getCurrentPages = () => (
    route
      ? [...Array(Math.max(0, stackDepth - 1)).fill({ route: 'mock/parent' }), { route }]
      : []
  );
  global.wx = {
    cloud: { init() {} },
    setInnerAudioOption() {},
    getStorageSync() { return null; },
    showToast() {},
    showModal() {},
    reLaunch(navigationOptions) {
      const result = reLaunchResults.length ? reLaunchResults.shift() : 'success';
      finishNavigation('reLaunch', navigationOptions, result !== 'fail');
    },
    switchTab(navigationOptions) {
      finishNavigation('switchTab', navigationOptions, true);
    }
  };

  Module._load = function(request, parent, isMain) {
    if (parent && parent.filename === appPath) {
      if (request.includes('cloud-sync')) {
        return { syncLearningRecord() {}, syncLearningProgress() {} };
      }
      if (request.includes('learning-progress')) {
        return {
          reconcileLearningProgressMap() {},
          reconcileStudentLearningProgress() {}
        };
      }
      if (request.includes('cloud-mode')) {
        return { resolveCloudReadOnlyMode: () => true };
      }
      if (request.includes('wordbook-loader')) return function WordbookLoader() {};
      if (request.includes('data-migration')) return {};
      if (request.includes('cloud-wordbook-loader')) return {};
      if (request.includes('babel-polyfill')) return {};
    }
    if (parent && parent.filename === splashPath && request.includes('login-service')) {
      return { doSilentLogin: () => sync.promise };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[appPath];
    delete require.cache[splashPath];
    require(appPath);
    assert.ok(appDefinition, 'app.js must register App');
    app = {
      ...appDefinition,
      globalData: { ...(appDefinition.globalData || {}) }
    };
    app.initializeVersion = () => ({ upgraded: false });
    app.initData = () => {};
    app.migrateLearningProgress = () => {};
    app.normalizeStudentsStorage = () => {};
    app.initEventSystem = () => {};
    app.initWordbookLoader = () => {};
    app.checkStorageRegularly = () => {};
    app.preloadCloudWordbooks = () => {};

    require(splashPath);
    assert.ok(pageDefinition, 'splash.js must register Page');
    splashPage = {
      ...pageDefinition,
      data: { ...(pageDefinition.data || {}) },
      setData(patch) {
        Object.assign(this.data, patch);
      }
    };

    app.onLaunch();
    if (options.startSplash !== false) splashPage.onLoad();
    if (Number.isFinite(options.syncAtMs)) {
      setTimeout(() => sync.resolve({ ok: true, pending: 0 }), options.syncAtMs);
    }
  } finally {
    Module._load = originalLoad;
  }

  const advanceTo = async (targetMs) => {
    while (true) {
      const next = Array.from(timers.values())
        .filter((timer) => !timer.cleared && timer.due <= targetMs)
        .sort((left, right) => left.due - right.due || left.id - right.id)[0];
      if (!next) break;
      next.cleared = true;
      now = next.due;
      currentTimer = next;
      next.callback();
      currentTimer = null;
      await flushPromises();
    }
    now = targetMs;
    await flushPromises();
  };

  const navigateForUser = (nextRoute) => {
    route = nextRoute;
    stackDepth = 2;
  };

  const snapshot = () => ({
    now,
    route,
    stackDepth,
    homeInstances,
    successfulReLaunches,
    navigation: navigation.slice(),
    appTimer: app._splashNavTimer,
    retryTimer: app._splashNavRetryTimer,
    startupState: app._startupNavigationState,
    startupOwner: app._startupNavigationOwner,
    splashActive: splashPage._isSplashSessionActive === true
  });

  const cleanup = () => {
    delete require.cache[appPath];
    delete require.cache[splashPath];
    Module._load = originalLoad;
    global.App = originals.App;
    global.Page = originals.Page;
    global.wx = originals.wx;
    global.getApp = originals.getApp;
    global.getCurrentPages = originals.getCurrentPages;
    global.setTimeout = originals.setTimeout;
    global.clearTimeout = originals.clearTimeout;
  };

  return { advanceTo, navigateForUser, snapshot, cleanup };
};

const runHarness = async (options, verify) => {
  const harness = await createHarness(options);
  try {
    await verify(harness);
  } finally {
    harness.cleanup();
  }
};

(async () => {
  await runHarness({ syncAtMs: 1000 }, async (harness) => {
    await harness.advanceTo(1500);
    assert.strictEqual(harness.snapshot().successfulReLaunches, 1);
    await harness.advanceTo(2000);
    assert.strictEqual(
      harness.snapshot().successfulReLaunches,
      1,
      'fast synchronization must not let the App timer rebuild home'
    );
    assert.strictEqual(harness.snapshot().homeInstances, 1);
  });

  await runHarness({ syncAtMs: 1700 }, async (harness) => {
    await harness.advanceTo(1700);
    assert.strictEqual(harness.snapshot().successfulReLaunches, 1);
    await harness.advanceTo(2000);
    assert.strictEqual(harness.snapshot().successfulReLaunches, 1);
  });

  await runHarness({ syncAtMs: 2500 }, async (harness) => {
    await harness.advanceTo(2000);
    assert.strictEqual(harness.snapshot().successfulReLaunches, 1);
    assert.strictEqual(harness.snapshot().navigation[0].source, 'app-timer');
    await harness.advanceTo(2500);
    assert.strictEqual(
      harness.snapshot().successfulReLaunches,
      1,
      'late Splash completion must not navigate after App fallback'
    );
  });

  await runHarness({ syncAtMs: 1000 }, async (harness) => {
    await harness.advanceTo(1600);
    harness.navigateForUser('subpages/word-view/word-view');
    await harness.advanceTo(2000);
    assert.strictEqual(harness.snapshot().route, 'subpages/word-view/word-view');
  });

  const protectedRoutes = [
    'pages/learning/learning',
    'pages/review/review',
    'subpages/review-merged/review-merged',
    'subpages/records/records',
    'pages/students/students',
    'subpages/word-view/word-view'
  ];
  for (const protectedRoute of protectedRoutes) {
    await runHarness({ startSplash: false }, async (harness) => {
      await harness.advanceTo(1500);
      harness.navigateForUser(protectedRoute);
      await harness.advanceTo(2000);
      assert.strictEqual(harness.snapshot().route, protectedRoute);
      assert.strictEqual(harness.snapshot().successfulReLaunches, 0);
    });
  }

  await runHarness({
    startSplash: false,
    reLaunchResults: ['fail', 'success']
  }, async (harness) => {
    await harness.advanceTo(2000);
    assert.strictEqual(harness.snapshot().navigation.length, 1);
    await harness.advanceTo(2500);
    assert.strictEqual(harness.snapshot().navigation.length, 2);
    assert.strictEqual(harness.snapshot().successfulReLaunches, 1);
  });

  await runHarness({
    startSplash: false,
    reLaunchResults: ['fail', 'success']
  }, async (harness) => {
    await harness.advanceTo(2000);
    harness.navigateForUser('pages/learning/learning');
    await harness.advanceTo(2500);
    assert.strictEqual(
      harness.snapshot().navigation.length,
      1,
      'App retry must expire after the route leaves Splash'
    );
    assert.strictEqual(harness.snapshot().route, 'pages/learning/learning');
  });

  await runHarness({ syncAtMs: 2000 }, async (harness) => {
    await harness.advanceTo(2000);
    assert.strictEqual(
      harness.snapshot().successfulReLaunches,
      1,
      'near-simultaneous App and Splash requests must share one navigation claim'
    );
  });

  console.log('startup-navigation-coordination: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
