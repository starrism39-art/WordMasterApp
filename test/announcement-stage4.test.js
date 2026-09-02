'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const servicePath = path.join(projectRoot, 'utils', 'announcement-service.js');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const captureDefinition = (kind, modulePath, serviceMock) => {
  const resolvedModule = require.resolve(modulePath);
  const resolvedService = require.resolve(servicePath);
  const previousService = require.cache[resolvedService];
  const previousGlobal = global[kind];
  let definition;

  if (serviceMock) {
    require.cache[resolvedService] = {
      id: resolvedService,
      filename: resolvedService,
      loaded: true,
      exports: serviceMock,
      children: [],
      paths: []
    };
  }

  global[kind] = (value) => { definition = value; };
  delete require.cache[resolvedModule];
  const helpers = require(resolvedModule);
  delete require.cache[resolvedModule];

  if (previousService) require.cache[resolvedService] = previousService;
  else delete require.cache[resolvedService];
  if (previousGlobal === undefined) delete global[kind];
  else global[kind] = previousGlobal;

  return { definition, helpers };
};

const createPage = (definition, dataOverrides = {}) => {
  const page = {
    ...definition,
    data: { ...definition.data, ...dataOverrides },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    }
  };
  return page;
};

const fixture = (id, overrides = {}, readState = null) => ({
  announcement: {
    _id: id,
    type: 'system',
    priority: 'normal',
    title: `公告 ${id}`,
    summary: '摘要',
    content: '正文',
    publishTime: '2026-09-01T00:00:00.000Z',
    ...overrides
  },
  readState
});

const cardModule = path.join(projectRoot, 'components', 'announcement-card', 'announcement-card.js');
const popupModule = path.join(projectRoot, 'components', 'announcement-popup', 'announcement-popup.js');
const centerModule = path.join(projectRoot, 'subpages', 'announcement-center', 'announcement-center.js');
const detailModule = path.join(projectRoot, 'subpages', 'announcement-detail', 'announcement-detail.js');

const cardCaptured = captureDefinition('Component', cardModule);
const popupCaptured = captureDefinition('Component', popupModule);
const centerCaptured = captureDefinition('Page', centerModule);
const detailCaptured = captureDefinition('Page', detailModule);

Object.entries({
  version_update: '版本更新',
  system: '系统公告',
  wordbook: '新词书',
  activity: '活动',
  membership: '会员相关'
}).forEach(([type, label]) => {
  test(`card maps ${type} label`, () => {
    const view = cardCaptured.helpers.normalizeCardEntry(fixture('a', { type }));
    assert.strictEqual(view.typeLabel, label);
  });
});

test('card keeps major priority semantic', () => {
  const view = cardCaptured.helpers.normalizeCardEntry(fixture('a', { priority: 'major' }));
  assert.strictEqual(view.priority, 'major');
  assert.strictEqual(view.priorityLabel, '重大');
});

test('card supports normal important and major priorities', () => {
  const normalize = cardCaptured.helpers.normalizeCardEntry;
  assert.strictEqual(normalize(fixture('n', { priority: 'normal' })).priority, 'normal');
  assert.strictEqual(normalize(fixture('i', { priority: 'important' })).priorityLabel, '重要');
  assert.strictEqual(normalize(fixture('m', { priority: 'major' })).priorityLabel, '重大');
});

test('card clamps long titles and summaries', () => {
  const styles = fs.readFileSync(path.join(path.dirname(cardModule), 'announcement-card.wxss'), 'utf8');
  assert.ok(styles.includes('.announcement-card__title'));
  assert.ok(styles.match(/-webkit-line-clamp:\s*2/g).length >= 2);
});

test('card read state removes unread marker', () => {
  const view = cardCaptured.helpers.normalizeCardEntry(fixture('a', {}, { readAt: 'server' }));
  assert.strictEqual(view.read, true);
  assert.strictEqual(view.showUnreadDot, false);
});

test('card only renders explicit NEW signal', () => {
  const explicit = fixture('a');
  explicit.isNew = true;
  assert.strictEqual(cardCaptured.helpers.normalizeCardEntry(explicit).showNew, true);
  assert.strictEqual(cardCaptured.helpers.normalizeCardEntry(fixture('b')).showNew, false);
});

test('card read state suppresses explicit NEW', () => {
  const entry = fixture('a', {}, { readAt: 'server' });
  entry.isNew = true;
  assert.strictEqual(cardCaptured.helpers.normalizeCardEntry(entry).showNew, false);
});

test('card supports home placement', () => {
  assert.strictEqual(cardCaptured.helpers.normalizeCardEntry(fixture('a'), 'home').placement, 'home');
});

test('card ignores invalid publish date', () => {
  assert.strictEqual(cardCaptured.helpers.formatPublishDate('not-a-date'), '');
});

test('card emits detail with trusted announcement id', () => {
  let event;
  const context = {
    data: { view: { id: 'trusted-id' } },
    properties: { entry: fixture('trusted-id') },
    triggerEvent(name, detail) { event = { name, detail }; }
  };
  cardCaptured.definition.methods.onDetailTap.call(context);
  assert.strictEqual(event.name, 'detail');
  assert.strictEqual(event.detail.announcementId, 'trusted-id');
});

test('popup limits highlight presentation to four items', () => {
  const view = popupCaptured.helpers.normalizePopup({
    _id: 'major',
    highlights: ['一', '二', '三', '四', '五']
  });
  assert.strictEqual(view.highlights.length, 4);
});

test('popup accepts explicit presentation highlights', () => {
  const items = popupCaptured.helpers.normalizeHighlights({}, [{ title: '学习界面', summary: '更清晰' }]);
  assert.deepStrictEqual(items[0], { title: '学习界面', description: '更清晰', icon: '1' });
});

test('popup emits detail and acknowledge only', () => {
  const events = [];
  const context = {
    data: { view: { id: 'major' } },
    triggerEvent(name, detail) { events.push({ name, detail }); }
  };
  popupCaptured.definition.methods.onDetailTap.call(context);
  popupCaptured.definition.methods.onAcknowledgeTap.call(context);
  assert.deepStrictEqual(events.map((entry) => entry.name), ['detail', 'acknowledge']);
});

test('popup contains no service or claim decision', () => {
  const source = fs.readFileSync(popupModule, 'utf8');
  assert.ok(!source.includes('announcement-service'));
  assert.ok(!source.includes('claimMajorPopup'));
  assert.ok(!source.includes('acknowledgePopup'));
});

test('history merge deduplicates by announcement id', () => {
  const merged = centerCaptured.helpers.mergeHistoryItems(
    [fixture('a'), fixture('b')],
    [fixture('b', { title: '更新后的 B' }), fixture('c')]
  );
  assert.deepStrictEqual(merged.map(centerCaptured.helpers.getAnnouncementId), ['a', 'b', 'c']);
  assert.strictEqual(merged[1].announcement.title, '更新后的 B');
});

test('unread filter consumes server readState', () => {
  assert.strictEqual(centerCaptured.helpers.isUnreadEntry(fixture('a')), true);
  assert.strictEqual(centerCaptured.helpers.isUnreadEntry(fixture('b', {}, { readAt: 'server' })), false);
});

test('read-state update only changes matching item', () => {
  const updated = centerCaptured.helpers.applyReadState(
    [fixture('a'), fixture('b')],
    'b',
    { readAt: 'server' }
  );
  assert.strictEqual(updated[0].readState, null);
  assert.strictEqual(updated[1].readState.readAt, 'server');
});

test('center initial load uses Stage3 listHistory cursor', async () => {
  const calls = [];
  const captured = captureDefinition('Page', centerModule, {
    listHistory: async (options) => {
      calls.push(options);
      return { items: [fixture('a')], hasMore: false, cursor: null };
    },
    markRead: async () => ({ readState: { readAt: 'server' } })
  });
  const page = createPage(captured.definition);
  await page.loadInitial();
  assert.deepStrictEqual(calls, [{ cursor: 1 }]);
  assert.strictEqual(page.data.visibleItems.length, 1);
});

test('unread tab exhausts every history page before filtering', async () => {
  const cursors = [];
  const captured = captureDefinition('Page', centerModule, {
    listHistory: async ({ cursor }) => {
      cursors.push(cursor);
      if (cursor === 1) return { items: [fixture('read', {}, { readAt: 'server' })], hasMore: true, cursor: 2 };
      return { items: [fixture('unread')], hasMore: false, cursor: null };
    },
    markRead: async () => ({ readState: { readAt: 'server' } })
  });
  const page = createPage(captured.definition, { activeTab: 'unread' });
  await page.loadInitial();
  assert.deepStrictEqual(cursors, [1, 2]);
  assert.deepStrictEqual(page.data.visibleItems.map(captured.helpers.getAnnouncementId), ['unread']);
});

test('center accepts read state only after markRead success', async () => {
  const captured = captureDefinition('Page', centerModule, {
    listHistory: async () => ({ items: [], hasMore: false, cursor: null }),
    markRead: async () => ({ readState: { readAt: 'official-server-time' } })
  });
  const navigations = [];
  const oldWx = global.wx;
  global.wx = { navigateTo: (options) => navigations.push(options.url), showToast() {} };
  const page = createPage(captured.definition, { allItems: [fixture('a')], visibleItems: [fixture('a')] });
  await page.onAnnouncementDetail({ detail: { announcementId: 'a' } });
  assert.strictEqual(page.data.allItems[0].readState.readAt, 'official-server-time');
  assert.strictEqual(navigations.length, 1);
  global.wx = oldWx;
});

test('center does not navigate or forge read state after markRead failure', async () => {
  const captured = captureDefinition('Page', centerModule, {
    listHistory: async () => ({ items: [], hasMore: false, cursor: null }),
    markRead: async () => { throw new Error('network'); }
  });
  let navigated = false;
  let toasted = false;
  const oldWx = global.wx;
  global.wx = { navigateTo: () => { navigated = true; }, showToast: () => { toasted = true; } };
  const page = createPage(captured.definition, { allItems: [fixture('a')], visibleItems: [fixture('a')] });
  await page.onAnnouncementDetail({ detail: { announcementId: 'a' } });
  assert.strictEqual(page.data.allItems[0].readState, null);
  assert.strictEqual(navigated, false);
  assert.strictEqual(toasted, true);
  global.wx = oldWx;
});

test('center rejects invalid continuing cursor', async () => {
  const captured = captureDefinition('Page', centerModule, {
    listHistory: async () => ({ items: [], hasMore: true, cursor: null }),
    markRead: async () => ({ readState: null })
  });
  const page = createPage(captured.definition, { loading: false });
  await assert.rejects(() => page.loadNextPage(), /ANNOUNCEMENT_CURSOR_INVALID/);
});

test('center shares an in-flight page request without cursor races', async () => {
  let release;
  let calls = 0;
  const captured = captureDefinition('Page', centerModule, {
    listHistory: async () => {
      calls += 1;
      await new Promise((resolve) => { release = resolve; });
      return { items: [fixture('a')], hasMore: false, cursor: null };
    },
    markRead: async () => ({ readState: null })
  });
  const page = createPage(captured.definition, { loading: false });
  const first = page.loadNextPage();
  const second = page.loadNextPage();
  release();
  await Promise.all([first, second]);
  assert.strictEqual(calls, 1);
  assert.strictEqual(page.data.allItems.length, 1);
});

test('center has loading empty error and pagination states', () => {
  const wxml = fs.readFileSync(path.join(path.dirname(centerModule), 'announcement-center.wxml'), 'utf8');
  ['loading', '没有未读公告', 'onRetry', 'loadingMore', 'hasMore'].forEach((token) => assert.ok(wxml.includes(token)));
  assert.ok(fs.readFileSync(centerModule, 'utf8').includes('onReachBottom'));
});

test('center never accesses CloudBase database directly', () => {
  const source = fs.readFileSync(centerModule, 'utf8');
  assert.ok(!source.includes('.database('));
  assert.ok(!source.includes('wx.cloud'));
  assert.ok(source.includes('announcement-service'));
});

test('detail normalizes type title and publish date', () => {
  const view = detailCaptured.helpers.normalizeDetail(fixture('a', { type: 'version_update' }).announcement);
  assert.strictEqual(view.typeLabel, '版本更新');
  assert.strictEqual(view.title, '公告 a');
  assert.ok(view.publishDate.includes('2026'));
});

test('detail preserves explicit structured content blocks', () => {
  const blocks = detailCaptured.helpers.normalizeContentBlocks({
    contentBlocks: [{ title: '一、升级', body: '体验更清晰' }]
  });
  assert.deepStrictEqual(blocks, [{ title: '一、升级', body: '体验更清晰' }]);
});

test('detail splits plain content only by paragraph boundaries', () => {
  const blocks = detailCaptured.helpers.normalizeContentBlocks({ content: '第一段\n\n第二段' });
  assert.deepStrictEqual(blocks.map((item) => item.body), ['第一段', '第二段']);
});

test('detail allows registry-approved wordbook route', () => {
  const view = detailCaptured.helpers.buildActionView({
    action: { type: 'navigate', target: 'wordbook_management', params: { wordbookId: 'book-1' } }
  });
  assert.strictEqual(view.route, '/subpages/wordbook/wordbook');
});

test('detail downgrades unavailable membership action', () => {
  const view = detailCaptured.helpers.buildActionView({
    action: { type: 'navigate', target: 'membership', params: { plan: 'pro' } }
  });
  assert.strictEqual(view, null);
});

test('detail rejects unregistered raw route target', () => {
  const view = detailCaptured.helpers.buildActionView({
    action: { type: 'navigate', target: '/pages/evil/index', params: {} }
  });
  assert.strictEqual(view, null);
});

test('detail encodes only registry-sanitized action params', () => {
  const url = detailCaptured.helpers.buildActionUrl({
    route: '/subpages/wordbook/wordbook',
    params: { wordbookId: 'book & one' }
  });
  assert.strictEqual(url, '/subpages/wordbook/wordbook?wordbookId=book%20%26%20one');
});

test('detail calls getDetail then markRead on entry', async () => {
  const calls = [];
  const captured = captureDefinition('Page', detailModule, {
    getDetail: async (id) => {
      calls.push(`get:${id}`);
      return fixture(id);
    },
    markRead: async (id) => {
      calls.push(`read:${id}`);
      return { readState: { readAt: 'server' } };
    },
    resolveAnnouncementAction: () => null
  });
  const oldWx = global.wx;
  global.wx = { showToast() {} };
  const page = createPage(captured.definition, { announcementId: 'a' });
  await page.loadAnnouncement();
  assert.deepStrictEqual(calls, ['get:a', 'read:a']);
  assert.strictEqual(page.data.readState.readAt, 'server');
  global.wx = oldWx;
});

test('detail preserves server read state when markRead fails', async () => {
  const captured = captureDefinition('Page', detailModule, {
    getDetail: async (id) => fixture(id, {}, { readAt: null }),
    markRead: async () => { throw new Error('network'); },
    resolveAnnouncementAction: () => null
  });
  let toasted = false;
  const oldWx = global.wx;
  global.wx = { showToast: () => { toasted = true; } };
  const page = createPage(captured.definition, { announcementId: 'a' });
  await page.loadAnnouncement();
  assert.deepStrictEqual(page.data.readState, { readAt: null });
  assert.strictEqual(toasted, true);
  global.wx = oldWx;
});

test('detail never navigates with raw announcement target', () => {
  const source = fs.readFileSync(detailModule, 'utf8');
  assert.ok(!source.includes('announcement.action.target'));
  assert.ok(source.includes('resolveAnnouncementAction'));
});

test('app registers only the two Stage4A announcement routes', () => {
  const app = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
  const subpages = app.subpackages.find((item) => item.root === 'subpages').pages;
  assert.ok(subpages.includes('announcement-center/announcement-center'));
  assert.ok(subpages.includes('announcement-detail/announcement-detail'));
});

test('Stage4A visual tokens match the approved palette', () => {
  const styleFiles = [
    path.join(projectRoot, 'components', 'announcement-card', 'announcement-card.wxss'),
    path.join(projectRoot, 'components', 'announcement-popup', 'announcement-popup.wxss'),
    path.join(projectRoot, 'subpages', 'announcement-center', 'announcement-center.wxss'),
    path.join(projectRoot, 'subpages', 'announcement-detail', 'announcement-detail.wxss')
  ];
  const styles = styleFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n').toLowerCase();
  ['#f5f7fa', '#ffffff', '#172033', '#7b8594', '#e7ebf0', '#18c77a'].forEach((token) => assert.ok(styles.includes(token)));
});

test('popup has no close icon and keeps required actions', () => {
  const wxml = fs.readFileSync(path.join(path.dirname(popupModule), 'announcement-popup.wxml'), 'utf8');
  assert.ok(!wxml.includes('close'));
  assert.ok(wxml.includes('查看详情'));
  assert.ok(wxml.includes('知道了'));
});

test('component metadata declares native mini-program components', () => {
  ['announcement-card', 'announcement-popup'].forEach((name) => {
    const metadata = JSON.parse(fs.readFileSync(path.join(projectRoot, 'components', name, `${name}.json`), 'utf8'));
    assert.strictEqual(metadata.component, true);
  });
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
  console.log(`announcement-stage4: PASS (${passed} checks)`);
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
