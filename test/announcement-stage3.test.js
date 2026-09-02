'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  compareVersions,
  isVersionAtLeast,
  resolveRuntimeContext
} = require('../utils/announcement-version');
const {
  ACTION_UNAVAILABLE,
  resolveAnnouncementAction
} = require('../utils/announcement-action-registry');
const {
  CACHE_PREFIX,
  CACHE_TTL_MS,
  HISTORY_PAGE_SIZE,
  ERROR_CODES,
  createAnnouncementService
} = require('../utils/announcement-service');

const NOW = 1788264000000;

const runtime = (overrides = {}) => ({
  appId: 'wx-stage3-test',
  envVersion: 'release',
  version: '2.10.0',
  rawVersion: '2.10.0',
  versionStatus: 'valid',
  versionError: null,
  ...overrides
});

const success = (data) => ({ result: { success: true, data } });
const failure = (error) => ({ result: { success: false, error } });

const bootstrapData = (overrides = {}) => ({
  latestAnnouncement: { _id: 'latest', title: 'Latest' },
  latestReadState: null,
  latestIsNew: true,
  majorCandidate: null,
  majorReadState: null,
  ...overrides
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const createHarness = ({
  context = runtime(),
  session = { accountId: 'teacher-stage3-a', generation: 1 },
  handler,
  initialNow = NOW
} = {}) => {
  const storage = new Map();
  const calls = [];
  let currentNow = initialNow;
  let currentContext = context;
  let currentSession = session;
  const fallbackHandler = async (request) => {
    if (request.data.action === 'bootstrap') return success(bootstrapData());
    return success({});
  };

  const service = createAnnouncementService({
    now: () => currentNow,
    getRuntimeContext: () => currentContext,
    getSessionSnapshot: () => currentSession,
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    callFunction: async (request) => {
      calls.push(request);
      return (handler || fallbackHandler)(request, calls.length);
    }
  });

  return {
    service,
    storage,
    calls,
    setNow: (value) => { currentNow = value; },
    setContext: (value) => { currentContext = value; },
    setSession: (value) => { currentSession = value; }
  };
};

let checks = 0;
const test = async (name, fn) => {
  await fn();
  checks += 1;
  return name;
};

(async () => {
  await test('01 release runtime uses legal Mini Program version', async () => {
    const result = resolveRuntimeContext({
      miniProgram: { appId: 'wx-release', envVersion: 'release', version: '1.2.10' }
    });
    assert.deepStrictEqual(result, {
      appId: 'wx-release',
      envVersion: 'release',
      version: '1.2.10',
      rawVersion: '1.2.10',
      versionStatus: 'valid',
      versionError: null
    });
  });

  await test('02 trial and develop force business version to null', async () => {
    for (const envVersion of ['trial', 'develop']) {
      const result = resolveRuntimeContext({
        miniProgram: { appId: 'wx-non-release', envVersion, version: '9.9.9' }
      });
      assert.strictEqual(result.version, null);
      assert.strictEqual(result.versionStatus, 'not_applicable');
    }
  });

  await test('03 versions compare by integer segments', async () => {
    assert.strictEqual(compareVersions('1.2.10', '1.2.9'), 1);
    assert.strictEqual(isVersionAtLeast('1.2.10', '1.2.9'), true);
  });

  await test('04 1.10.0 is greater than 1.9.9', async () => {
    assert.strictEqual(compareVersions('1.10.0', '1.9.9'), 1);
  });

  await test('05 trailing zero segments are equal', async () => {
    assert.strictEqual(compareVersions('1.0', '1.0.0'), 0);
  });

  await test('06 invalid release version safely degrades to null', async () => {
    assert.strictEqual(compareVersions('1.x', '1.0'), null);
    assert.strictEqual(isVersionAtLeast('1.x', '1.0'), null);
    const result = resolveRuntimeContext({
      miniProgram: { appId: 'wx-release', envVersion: 'release', version: '1.x' }
    });
    assert.strictEqual(result.version, null);
    assert.strictEqual(result.versionError, ERROR_CODES.INVALID_RUNTIME_VERSION);
  });

  await test('07 bootstrap calls only announcement cloud function', async () => {
    const harness = createHarness();
    const result = await harness.service.bootstrapAnnouncements();
    assert.strictEqual(result.source, 'network');
    assert.strictEqual(result.latestAnnouncement._id, 'latest');
    assert.strictEqual(harness.calls.length, 1);
    assert.deepStrictEqual(harness.calls[0], {
      name: 'announcement',
      data: { action: 'bootstrap', envVersion: 'release', version: '2.10.0' }
    });
  });

  await test('08 cache key isolates app environment version and teacher session', async () => {
    const harness = createHarness();
    const first = harness.service.getCacheKey();
    assert.ok(first.startsWith(`${CACHE_PREFIX}wx-stage3-test_release_2.10.0_`));
    assert.ok(!first.includes('teacher-stage3-a'));
    harness.setContext(runtime({ version: '2.10.1', rawVersion: '2.10.1' }));
    const second = harness.service.getCacheKey();
    harness.setSession({ accountId: 'teacher-stage3-b', generation: 2 });
    const third = harness.service.getCacheKey();
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(second, third);
  });

  await test('09 five minute cache is stored independently', async () => {
    const harness = createHarness();
    await harness.service.bootstrapAnnouncements();
    assert.strictEqual(harness.storage.size, 1);
    const [key, record] = Array.from(harness.storage.entries())[0];
    assert.ok(key.startsWith(CACHE_PREFIX));
    assert.strictEqual(record.cachedAt, NOW);
    assert.strictEqual(record.payload.latestAnnouncement._id, 'latest');
    assert.strictEqual(CACHE_TTL_MS, 300000);
  });

  await test('10 TTL hit returns cache before delayed background refresh', async () => {
    const refresh = deferred();
    const harness = createHarness({
      handler: async (request, count) => {
        if (count === 1) return success(bootstrapData());
        return refresh.promise;
      }
    });
    await harness.service.bootstrapAnnouncements();
    harness.setNow(NOW + CACHE_TTL_MS - 1);
    const cached = await harness.service.bootstrapAnnouncements();
    assert.strictEqual(cached.source, 'cache');
    assert.strictEqual(cached.backgroundRefreshStarted, true);
    assert.strictEqual(harness.calls.length, 2);
    refresh.resolve(success(bootstrapData({ latestAnnouncement: { _id: 'refreshed' } })));
    await harness.service.refreshAnnouncements();
  });

  await test('11 background refresh updates cache', async () => {
    const refresh = deferred();
    const harness = createHarness({
      handler: async (request, count) => (
        count === 1
          ? success(bootstrapData())
          : refresh.promise
      )
    });
    await harness.service.bootstrapAnnouncements();
    await harness.service.bootstrapAnnouncements();
    refresh.resolve(success(bootstrapData({ latestAnnouncement: { _id: 'new-latest' } })));
    await harness.service.refreshAnnouncements();
    const record = harness.storage.get(harness.service.getCacheKey());
    assert.strictEqual(record.payload.latestAnnouncement._id, 'new-latest');
  });

  await test('12 simultaneous bootstrap requests share one cloud flight', async () => {
    const network = deferred();
    const harness = createHarness({ handler: async () => network.promise });
    const first = harness.service.bootstrapAnnouncements();
    const second = harness.service.bootstrapAnnouncements();
    assert.strictEqual(harness.calls.length, 1);
    network.resolve(success(bootstrapData()));
    const results = await Promise.all([first, second]);
    assert.strictEqual(results[0].source, 'network');
    assert.strictEqual(results[1].source, 'network');
  });

  await test('13 failed flight is cleared for a later retry', async () => {
    let shouldFail = true;
    const harness = createHarness({
      handler: async () => {
        if (shouldFail) throw new Error('offline');
        return success(bootstrapData());
      }
    });
    await assert.rejects(
      harness.service.refreshAnnouncements(),
      (error) => error.code === ERROR_CODES.CLOUD_FUNCTION_FAILED
    );
    shouldFail = false;
    const result = await harness.service.refreshAnnouncements();
    assert.strictEqual(result.source, 'network');
    assert.strictEqual(harness.calls.length, 2);
  });

  await test('14 network failure with expired cache returns stale cache', async () => {
    let offline = false;
    const harness = createHarness({
      handler: async () => {
        if (offline) throw new Error('offline');
        return success(bootstrapData());
      }
    });
    await harness.service.bootstrapAnnouncements();
    harness.setNow(NOW + CACHE_TTL_MS + 1);
    offline = true;
    const result = await harness.service.bootstrapAnnouncements();
    assert.strictEqual(result.source, 'stale-cache');
    assert.strictEqual(result.degraded, true);
    assert.strictEqual(result.latestAnnouncement._id, 'latest');
  });

  await test('15 network failure without cache returns empty state', async () => {
    const harness = createHarness({ handler: async () => { throw new Error('offline'); } });
    const result = await harness.service.bootstrapAnnouncements();
    assert.strictEqual(result.source, 'empty');
    assert.strictEqual(result.degraded, true);
    assert.strictEqual(result.latestAnnouncement, null);
    assert.strictEqual(result.majorPopupCandidate, null);
  });

  await test('16 invalid release version is sent as null without blocking bootstrap', async () => {
    const harness = createHarness({
      context: runtime({
        version: null,
        rawVersion: 'bad-version',
        versionStatus: 'invalid',
        versionError: ERROR_CODES.INVALID_RUNTIME_VERSION
      })
    });
    const result = await harness.service.bootstrapAnnouncements();
    assert.strictEqual(result.runtimeContext.versionError, ERROR_CODES.INVALID_RUNTIME_VERSION);
    assert.strictEqual(harness.calls[0].data.version, null);
  });

  await test('17 cached or network major candidate cannot directly authorize display', async () => {
    const harness = createHarness({
      handler: async () => success(bootstrapData({
        majorCandidate: { _id: 'major', priority: 'major' }
      }))
    });
    const first = await harness.service.bootstrapAnnouncements();
    const second = await harness.service.bootstrapAnnouncements();
    assert.strictEqual(first.majorPopupCandidate._id, 'major');
    assert.strictEqual(first.canShowMajorPopup, false);
    assert.strictEqual(second.canShowMajorPopup, false);
  });

  await test('18 claim true is the only result that may display popup', async () => {
    const harness = createHarness({
      handler: async (request) => success({
        claimed: true,
        readState: { popupShownAt: '2026-09-01T00:00:00.000Z' }
      })
    });
    const result = await harness.service.claimMajorPopup('major');
    assert.strictEqual(result.claimed, true);
    assert.strictEqual(result.canShow, true);
    assert.strictEqual(harness.calls[0].data.action, 'claimMajorPopup');
  });

  await test('19 claim false never authorizes popup display', async () => {
    const harness = createHarness({
      handler: async () => success({ claimed: false, readState: { popupShownAt: 'earlier' } })
    });
    const result = await harness.service.claimMajorPopup('major');
    assert.strictEqual(result.claimed, false);
    assert.strictEqual(result.canShow, false);
  });

  await test('20 markRead uses minimal cloud function request', async () => {
    const harness = createHarness({
      handler: async () => success({ readState: { readAt: 'now' } })
    });
    const result = await harness.service.markRead('latest');
    assert.strictEqual(result.readState.readAt, 'now');
    assert.deepStrictEqual(harness.calls[0].data, {
      action: 'markRead',
      envVersion: 'release',
      version: '2.10.0',
      announcementId: 'latest'
    });
  });

  await test('21 acknowledgePopup uses cloud function and returns server state', async () => {
    const harness = createHarness({
      handler: async () => success({ readState: { popupAcknowledgedAt: 'now' } })
    });
    const result = await harness.service.acknowledgePopup('major');
    assert.strictEqual(result.readState.popupAcknowledgedAt, 'now');
    assert.strictEqual(harness.calls[0].data.action, 'acknowledgePopup');
  });

  await test('22 successful read action updates independent bootstrap cache', async () => {
    const harness = createHarness({
      handler: async (request) => {
        if (request.data.action === 'bootstrap') return success(bootstrapData());
        return success({ readState: { readAt: 'server-read' } });
      }
    });
    await harness.service.bootstrapAnnouncements();
    await harness.service.markRead('latest');
    const record = harness.storage.get(harness.service.getCacheKey());
    assert.strictEqual(record.payload.latestReadState.readAt, 'server-read');
  });

  await test('23 failed read action does not forge cached success', async () => {
    const harness = createHarness({
      handler: async (request) => {
        if (request.data.action === 'bootstrap') return success(bootstrapData());
        throw new Error('offline');
      }
    });
    await harness.service.bootstrapAnnouncements();
    await assert.rejects(harness.service.markRead('latest'));
    const record = harness.storage.get(harness.service.getCacheKey());
    assert.strictEqual(record.payload.latestReadState, null);
  });

  await test('24 listHistory uses server fixed page size and numeric cursor', async () => {
    const harness = createHarness({
      handler: async () => success({ page: 2, pageSize: 20, hasMore: true, items: [{ id: 1 }] })
    });
    const result = await harness.service.listHistory({ cursor: 2, pageSize: 99 });
    assert.deepStrictEqual(harness.calls[0].data, {
      action: 'listHistory',
      envVersion: 'release',
      version: '2.10.0',
      page: 2
    });
    assert.strictEqual(result.pageSize, HISTORY_PAGE_SIZE);
    assert.strictEqual(result.cursor, 3);
  });

  await test('25 getDetail uses announcement function and normalizes state', async () => {
    const harness = createHarness({
      handler: async () => success({
        announcement: { _id: 'detail' },
        readState: { readAt: null }
      })
    });
    const result = await harness.service.getDetail('detail');
    assert.strictEqual(result.announcement._id, 'detail');
    assert.strictEqual(harness.calls[0].data.action, 'getDetail');
    assert.strictEqual(harness.calls[0].data.announcementId, 'detail');
  });

  await test('26 backend not found becomes ANNOUNCEMENT_NOT_FOUND', async () => {
    const harness = createHarness({ handler: async () => failure('NOT_FOUND') });
    await assert.rejects(
      harness.service.getDetail('missing'),
      (error) => error.code === ERROR_CODES.ANNOUNCEMENT_NOT_FOUND
    );
  });

  await test('27 announcement_detail maps to semantic internal action only', async () => {
    const result = resolveAnnouncementAction({
      type: 'navigate',
      target: 'announcement_detail',
      params: { announcementId: 'detail', source: 'history' }
    });
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.internalAction, 'openAnnouncementDetail');
    assert.strictEqual(result.route, null);
  });

  await test('28 wordbook_management maps to fixed existing route', async () => {
    const result = resolveAnnouncementAction({
      type: 'navigate',
      target: 'wordbook_management',
      params: { mode: 'manage' }
    });
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.route, '/subpages/wordbook/wordbook');
  });

  await test('29 membership is explicitly unavailable and falls back to detail', async () => {
    const result = resolveAnnouncementAction({
      type: 'navigate',
      target: 'membership',
      params: {}
    });
    assert.strictEqual(result.available, false);
    assert.strictEqual(result.code, ACTION_UNAVAILABLE);
    assert.strictEqual(result.fallbackToDetail, true);
    assert.strictEqual(result.route, null);
  });

  await test('30 URL-like and unknown action targets are rejected', async () => {
    for (const target of ['https://evil.example', '/pages/hidden', 'unknown']) {
      assert.throws(
        () => resolveAnnouncementAction({ type: 'navigate', target, params: {} }),
        (error) => error.code === ACTION_UNAVAILABLE
      );
    }
  });

  await test('31 complex or non-whitelisted params are rejected', async () => {
    assert.throws(() => resolveAnnouncementAction({
      type: 'navigate',
      target: 'wordbook_management',
      params: { url: 'https://evil.example' }
    }));
    assert.throws(() => resolveAnnouncementAction({
      type: 'navigate',
      target: 'announcement_detail',
      params: { announcementId: { nested: true } }
    }));
  });

  await test('32 client service has no direct database path', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'announcement-service.js'),
      'utf8'
    );
    assert.ok(!/wx\s*\.\s*cloud\s*\.\s*database\s*\(/.test(source));
    assert.ok(!/\.collection\s*\(/.test(source));
  });

  await test('33 client service imports no learning sync or queue machinery', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'announcement-service.js'),
      'utf8'
    );
    assert.ok(!/require\([^)]*(cloud-sync|pending|generation)[^)]*\)/.test(source));
    assert.ok(!/data-backup-service/.test(source));
  });

  await test('34 bootstrap与5分钟缓存保留latestIsNew', async () => {
    const harness = createHarness();
    const network = await harness.service.bootstrapAnnouncements();
    const record = harness.storage.get(harness.service.getCacheKey());
    const cached = await harness.service.bootstrapAnnouncements();
    assert.strictEqual(network.latestIsNew, true);
    assert.strictEqual(record.payload.latestIsNew, true);
    assert.strictEqual(cached.latestIsNew, true);
  });

  await test('35 markRead成功后缓存latestIsNew变false', async () => {
    const harness = createHarness({
      handler: async (request) => (
        request.data.action === 'bootstrap'
          ? success(bootstrapData())
          : success({ readState: { readAt: 'server-read' } })
      )
    });
    await harness.service.bootstrapAnnouncements();
    await harness.service.markRead('latest');
    const record = harness.storage.get(harness.service.getCacheKey());
    assert.strictEqual(record.payload.latestIsNew, false);
  });

  await test('36 markRead失败不伪造latestIsNew=false', async () => {
    const harness = createHarness({
      handler: async (request) => {
        if (request.data.action === 'bootstrap') return success(bootstrapData());
        throw new Error('offline');
      }
    });
    await harness.service.bootstrapAnnouncements();
    await assert.rejects(harness.service.markRead('latest'));
    const record = harness.storage.get(harness.service.getCacheKey());
    assert.strictEqual(record.payload.latestIsNew, true);
  });

  await test('37 Major claim仅写popupShown时不改变NEW', async () => {
    const harness = createHarness({
      handler: async (request) => {
        if (request.data.action === 'bootstrap') {
          return success(bootstrapData({
            latestAnnouncement: { _id: 'major', title: 'Major' },
            majorCandidate: { _id: 'major', title: 'Major' }
          }));
        }
        return success({ claimed: true, readState: { readAt: null, popupShownAt: 'server-shown' } });
      }
    });
    await harness.service.bootstrapAnnouncements();
    await harness.service.claimMajorPopup('major');
    const record = harness.storage.get(harness.service.getCacheKey());
    assert.strictEqual(record.payload.latestIsNew, true);
  });

  await test('38 popupAcknowledged但readAt为空仍保持NEW', async () => {
    const harness = createHarness({
      handler: async (request) => {
        if (request.data.action === 'bootstrap') {
          return success(bootstrapData({
            latestAnnouncement: { _id: 'major', title: 'Major' },
            majorCandidate: { _id: 'major', title: 'Major' }
          }));
        }
        return success({ readState: { readAt: null, popupAcknowledgedAt: 'server-ack' } });
      }
    });
    await harness.service.bootstrapAnnouncements();
    await harness.service.acknowledgePopup('major');
    const record = harness.storage.get(harness.service.getCacheKey());
    assert.strictEqual(record.payload.latestIsNew, true);
  });

  console.log(`announcement-stage3: PASS (${checks} checks)`);
})().catch((error) => {
  console.error('announcement-stage3: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
