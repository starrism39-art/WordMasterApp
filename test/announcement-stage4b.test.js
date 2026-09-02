'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const indexModule = path.join(projectRoot, 'pages', 'index', 'index.js');
const serviceModule = path.join(projectRoot, 'utils', 'announcement-service.js');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const announcement = (id, overrides = {}) => ({
  _id: id,
  type: 'system',
  priority: 'normal',
  title: `公告 ${id}`,
  summary: '摘要',
  publishTime: '2026-09-01T00:00:00.000Z',
  ...overrides
});

const createServiceMock = (overrides = {}) => ({
  bootstrapAnnouncements: async () => ({
    source: 'network',
    degraded: false,
    latestAnnouncement: null,
    latestReadState: null,
    majorPopupCandidate: null
  }),
  claimMajorPopup: async () => ({ claimed: false, readState: null }),
  markRead: async () => ({ readState: { readAt: 'server' } }),
  acknowledgePopup: async () => ({
    readState: { readAt: 'server', popupAcknowledgedAt: 'server' }
  }),
  ...overrides
});

const captureIndex = (serviceOverrides = {}) => {
  const resolvedIndex = require.resolve(indexModule);
  const resolvedService = require.resolve(serviceModule);
  const previousService = require.cache[resolvedService];
  const previousPage = global.Page;
  let definition;

  require.cache[resolvedService] = {
    id: resolvedService,
    filename: resolvedService,
    loaded: true,
    exports: createServiceMock(serviceOverrides),
    children: [],
    paths: []
  };
  global.Page = (value) => { definition = value; };
  delete require.cache[resolvedIndex];
  const helpers = require(resolvedIndex);
  delete require.cache[resolvedIndex];

  if (previousService) require.cache[resolvedService] = previousService;
  else delete require.cache[resolvedService];
  if (previousPage === undefined) delete global.Page;
  else global.Page = previousPage;

  return { definition, helpers };
};

const createPage = (captured, dataOverrides = {}) => ({
  ...captured.definition,
  data: { ...captured.definition.data, ...dataOverrides },
  _announcementActive: true,
  setData(patch) {
    this.data = { ...this.data, ...patch };
  }
});

const withWx = async (wxMock, fn) => {
  const previousWx = global.wx;
  global.wx = wxMock;
  try {
    return await fn();
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
};

test('01 no announcement keeps homepage placeholder-free', async () => {
  const captured = captureIndex();
  const page = createPage(captured);
  await page.loadHomepageAnnouncements();
  assert.strictEqual(page.data.homeAnnouncementEntry, null);
});

['normal', 'important', 'major'].forEach((priority, index) => {
  test(`${String(index + 2).padStart(2, '0')} ${priority} latest announcement is passed to AnnouncementCard`, async () => {
    const latest = announcement(priority, { priority });
    const captured = captureIndex({
      bootstrapAnnouncements: async () => ({
        source: 'network',
        latestAnnouncement: latest,
        latestReadState: null,
        majorPopupCandidate: null
      })
    });
    const page = createPage(captured);
    await page.loadHomepageAnnouncements();
    assert.strictEqual(page.data.homeAnnouncementEntry.announcement.priority, priority);
  });
});

test('05 explicit NEW is passed through without unread inference', async () => {
  const captured = captureIndex();
  const explicit = captured.helpers.createHomeAnnouncementEntry({
    latestAnnouncement: announcement('new'),
    latestReadState: null,
    latestIsNew: true
  });
  const implicit = captured.helpers.createHomeAnnouncementEntry({
    latestAnnouncement: announcement('unread'),
    latestReadState: null
  });
  assert.strictEqual(explicit.isNew, true);
  assert.strictEqual(implicit.isNew, false);
});

test('06 successful markRead keeps card and applies official read state', async () => {
  const latest = announcement('read-me', { isNew: true });
  const captured = captureIndex({
    markRead: async () => ({ readState: { readAt: 'official-time' } })
  });
  const page = createPage(captured, {
    homeAnnouncementEntry: { announcement: latest, readState: null, isNew: true }
  });
  let navigated = '';
  await withWx({ navigateTo: ({ url }) => { navigated = url; } }, async () => {
    await page.onHomeAnnouncementDetail({ detail: { announcementId: 'read-me' } });
  });
  assert.strictEqual(page.data.homeAnnouncementEntry.announcement._id, 'read-me');
  assert.strictEqual(page.data.homeAnnouncementEntry.readState.readAt, 'official-time');
  assert.ok(navigated.includes('id=read-me'));
});

test('07 failed markRead neither navigates nor forges read state', async () => {
  const latest = announcement('read-fail');
  const captured = captureIndex({ markRead: async () => { throw new Error('network'); } });
  const page = createPage(captured, {
    homeAnnouncementEntry: { announcement: latest, readState: null, isNew: true }
  });
  let navigated = false;
  let toasted = false;
  await withWx({
    navigateTo: () => { navigated = true; },
    showToast: () => { toasted = true; }
  }, async () => {
    await page.onHomeAnnouncementDetail({ detail: { announcementId: 'read-fail' } });
  });
  assert.strictEqual(page.data.homeAnnouncementEntry.readState, null);
  assert.strictEqual(navigated, false);
  assert.strictEqual(toasted, false);
});

test('08 bootstrap failure is fail-soft and preserves current homepage data', async () => {
  const existing = { announcement: announcement('existing'), readState: null };
  const captured = captureIndex({
    bootstrapAnnouncements: async () => { throw new Error('network'); }
  });
  const page = createPage(captured, { homeAnnouncementEntry: existing });
  let toasted = false;
  await withWx({ showToast: () => { toasted = true; } }, async () => {
    await page.loadHomepageAnnouncements();
  });
  assert.strictEqual(page.data.homeAnnouncementEntry, existing);
  assert.strictEqual(toasted, false);
});

test('09 cache bootstrap result is immediately usable', async () => {
  const captured = captureIndex({
    bootstrapAnnouncements: async () => ({
      source: 'cache',
      latestAnnouncement: announcement('cached'),
      latestReadState: { readAt: null },
      majorPopupCandidate: null
    })
  });
  const page = createPage(captured);
  await page.loadHomepageAnnouncements();
  assert.strictEqual(page.data.homeAnnouncementEntry.announcement._id, 'cached');
});

test('10 major popup appears only after claim true', async () => {
  const major = announcement('major-true', { priority: 'major', type: 'version_update' });
  const captured = captureIndex({
    bootstrapAnnouncements: async () => ({
      source: 'network', latestAnnouncement: major, latestReadState: null,
      majorPopupCandidate: major
    }),
    claimMajorPopup: async () => ({ claimed: true, readState: { popupShownAt: 'server' } })
  });
  const page = createPage(captured);
  await page.loadHomepageAnnouncements();
  assert.strictEqual(page.data.majorAnnouncementVisible, true);
  assert.strictEqual(page.data.majorAnnouncement._id, 'major-true');
});

test('11 claim false never displays the major popup', async () => {
  const major = announcement('major-false', { priority: 'major' });
  const captured = captureIndex({
    bootstrapAnnouncements: async () => ({
      source: 'network', latestAnnouncement: major, latestReadState: null,
      majorPopupCandidate: major
    }),
    claimMajorPopup: async () => ({ claimed: false, readState: { popupShownAt: 'earlier' } })
  });
  const page = createPage(captured);
  await page.loadHomepageAnnouncements();
  assert.strictEqual(page.data.majorAnnouncementVisible, false);
});

test('12 the same major does not reappear when the server rejects the second claim', async () => {
  const major = announcement('major-once', { priority: 'major' });
  let claims = 0;
  const captured = captureIndex({
    bootstrapAnnouncements: async () => ({
      source: 'network', latestAnnouncement: major, latestReadState: null,
      majorPopupCandidate: major
    }),
    claimMajorPopup: async () => {
      claims += 1;
      return { claimed: claims === 1, readState: { popupShownAt: 'server' } };
    }
  });
  const page = createPage(captured);
  await page.loadHomepageAnnouncements();
  assert.strictEqual(page.data.majorAnnouncementVisible, true);
  page.setData({ majorAnnouncementVisible: false });
  await page.loadHomepageAnnouncements();
  assert.strictEqual(page.data.majorAnnouncementVisible, false);
  assert.strictEqual(claims, 2);
});

test('13 acknowledge success closes popup and updates the matching card', async () => {
  const major = announcement('major-ack', { priority: 'major', isNew: true });
  const captured = captureIndex({
    acknowledgePopup: async () => ({
      readState: { readAt: 'server', popupAcknowledgedAt: 'server' }
    })
  });
  const page = createPage(captured, {
    majorAnnouncementVisible: true,
    majorAnnouncement: major,
    homeAnnouncementEntry: { announcement: major, readState: null, isNew: true }
  });
  await page.onMajorAnnouncementAcknowledge({ detail: { announcementId: 'major-ack' } });
  assert.strictEqual(page.data.majorAnnouncementVisible, false);
  assert.strictEqual(page.data.homeAnnouncementEntry.readState.popupAcknowledgedAt, 'server');
});

test('14 acknowledge failure keeps popup and does not forge state', async () => {
  const major = announcement('major-ack-fail', { priority: 'major' });
  const captured = captureIndex({
    acknowledgePopup: async () => { throw new Error('network'); }
  });
  const page = createPage(captured, {
    majorAnnouncementVisible: true,
    majorAnnouncement: major,
    majorAnnouncementReadState: null
  });
  let toasted = false;
  await withWx({ showToast: () => { toasted = true; } }, async () => {
    await page.onMajorAnnouncementAcknowledge({ detail: { announcementId: 'major-ack-fail' } });
  });
  assert.strictEqual(page.data.majorAnnouncementVisible, true);
  assert.strictEqual(page.data.majorAnnouncementReadState, null);
  assert.strictEqual(toasted, false);
});

test('15 popup detail uses the fixed trusted detail route', async () => {
  const major = announcement('major detail');
  const captured = captureIndex();
  const page = createPage(captured, {
    majorAnnouncementVisible: true,
    majorAnnouncement: major
  });
  let url = '';
  await withWx({ navigateTo: (options) => { url = options.url; } }, async () => {
    page.onMajorAnnouncementDetail({ detail: { announcementId: 'major detail' } });
  });
  assert.strictEqual(page.data.majorAnnouncementVisible, false);
  assert.strictEqual(url, '/subpages/announcement-detail/announcement-detail?id=major%20detail');
});

test('16 popup detail navigation failure restores the claimed popup', async () => {
  const major = announcement('major-restore');
  const captured = captureIndex();
  const page = createPage(captured, {
    majorAnnouncementVisible: true,
    majorAnnouncement: major
  });
  await withWx({ navigateTo: ({ fail }) => fail() }, async () => {
    page.onMajorAnnouncementDetail({ detail: { announcementId: 'major-restore' } });
  });
  assert.strictEqual(page.data.majorAnnouncementVisible, true);
});

test('17 empty degraded bootstrap preserves the existing cache-backed card', async () => {
  const existing = { announcement: announcement('stale-cache'), readState: null };
  const captured = captureIndex({
    bootstrapAnnouncements: async () => ({
      source: 'empty', degraded: true, latestAnnouncement: null,
      latestReadState: null, majorPopupCandidate: null
    })
  });
  const page = createPage(captured, { homeAnnouncementEntry: existing });
  await page.loadHomepageAnnouncements();
  assert.strictEqual(page.data.homeAnnouncementEntry, existing);
});

test('18 homepage announcement initialization is non-blocking', () => {
  const captured = captureIndex();
  const source = captured.definition.onLoad.toString();
  assert.ok(source.includes('this.refreshHomepageAnnouncements()'));
  assert.ok(!source.includes('await this.refreshHomepageAnnouncements'));
});

test('19 existing learning and sync lifecycle entry points remain intact', () => {
  const captured = captureIndex();
  ['scheduleHomepageDataRefresh', 'refreshAfterCloudSync', 'goToLearning', 'refreshPage']
    .forEach((method) => assert.strictEqual(typeof captured.definition[method], 'function'));
  const source = captured.definition.onLoad.toString();
  assert.ok(source.indexOf('consumeStartupSyncNotice') < source.indexOf('refreshHomepageAnnouncements'));
});

test('20 WXML places the card after quick actions and before recent records', () => {
  const wxml = fs.readFileSync(path.join(projectRoot, 'pages', 'index', 'index.wxml'), 'utf8');
  const quick = wxml.indexOf('class="quick-actions card"');
  const card = wxml.indexOf('class="home-announcement-section"');
  const records = wxml.indexOf('class="records-section"');
  assert.ok(quick < card && card < records);
  assert.ok(wxml.includes('wx:if="{{homeAnnouncementEntry}}"'));
});

test('21 homepage registers and reuses both Stage4A components', () => {
  const json = JSON.parse(fs.readFileSync(path.join(projectRoot, 'pages', 'index', 'index.json'), 'utf8'));
  assert.strictEqual(json.usingComponents['announcement-card'], '/components/announcement-card/announcement-card');
  assert.strictEqual(json.usingComponents['announcement-popup'], '/components/announcement-popup/announcement-popup');
});

test('22 homepage announcement code never accesses the database directly', () => {
  const source = fs.readFileSync(indexModule, 'utf8');
  const start = source.indexOf('refreshHomepageAnnouncements:');
  const end = source.indexOf('// 根据学生名字生成头像文本');
  const announcementSection = source.slice(start, end);
  assert.ok(!announcementSection.includes('.database('));
  assert.ok(!announcementSection.includes('wx.cloud'));
  assert.ok(!announcementSection.includes('showToast'));
});

test('23 onShow skips the immediate duplicate bootstrap but refreshes on later returns', async () => {
  let calls = 0;
  const captured = captureIndex({
    bootstrapAnnouncements: async () => {
      calls += 1;
      return { source: 'network', latestAnnouncement: null, majorPopupCandidate: null };
    }
  });
  const page = createPage(captured, { currentStudent: null });
  page._skipNextAnnouncementOnShow = true;
  page.cancelScheduledHomepageRefresh = () => {};
  page.resolveCurrentStudentWithFallback = () => null;
  const previousGetApp = global.getApp;
  global.getApp = () => ({ globalData: {} });
  try {
    page.onShow();
    assert.strictEqual(calls, 0);
    page.onShow();
    await page._announcementBootstrapPromise;
    assert.strictEqual(calls, 1);
  } finally {
    if (previousGetApp === undefined) delete global.getApp;
    else global.getApp = previousGetApp;
  }
});

(async () => {
  let passed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      passed += 1;
    } catch (error) {
      console.error(`FAIL ${item.name}`);
      throw error;
    }
  }
  console.log(`announcement-stage4b: PASS (${passed} checks)`);
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
