'use strict';

const assert = require('assert');

const { createAnnouncementService: createServerService } = require('../cloudfunctions/announcement/service');
const {
  createAnnouncementService: createClientService,
  normalizeBootstrapPayload
} = require('../utils/announcement-service');

const NOW = new Date('2026-09-02T04:00:00.000Z');
const latest = {
  _id: 'stage4c-latest', type: 'system', priority: 'normal', status: 'published',
  title: '公告系统Stage4C NEW测试', summary: 'NEW契约测试', content: '测试正文',
  audience: 'teachers', channel: 'all', minVersion: null, bindVersion: null,
  popup: false, action: null, publishTime: new Date('2026-09-02T03:00:00.000Z'),
  endTime: null, createdAt: new Date('2026-09-02T02:00:00.000Z'),
  updatedAt: new Date('2026-09-02T02:00:00.000Z')
};

const createServerHarness = ({ openid = 'teacher-a', readStates = [], announcements = [latest] } = {}) => {
  const repository = {
    findActiveTeacher: async (teacherId) => (
      ['teacher-a', 'teacher-b'].includes(teacherId) ? { teacher_id: teacherId, status: 'active' } : null
    ),
    listPublished: async (offset, limit) => announcements.slice(offset, offset + limit),
    listMajorCandidates: async () => [],
    getReads: async (teacherId, ids) => readStates.filter((state) => (
      state.teacher_id === teacherId && ids.includes(state.announcement_id)
    ))
  };
  return createServerService({ repository, getOpenid: () => openid, clock: () => NOW });
};

const success = (data) => ({ result: { success: true, data } });

const createClientHarness = ({ handler } = {}) => {
  const storage = new Map();
  const service = createClientService({
    now: () => NOW.getTime(),
    getRuntimeContext: () => ({
      appId: 'wx-stage4c', envVersion: 'develop', version: null,
      rawVersion: null, versionStatus: 'unavailable', versionError: null
    }),
    getSessionSnapshot: () => ({ accountId: 'teacher-a', generation: 1 }),
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    callFunction: handler || (async (request) => (
      request.data.action === 'bootstrap'
        ? success({ latestAnnouncement: latest, latestReadState: null, latestIsNew: true })
        : success({ readState: { readAt: NOW.toISOString() } })
    ))
  });
  return { service, storage };
};

let checks = 0;
const test = async (name, fn) => {
  await fn();
  checks += 1;
  return name;
};

(async () => {
  await test('01 最新公告无read文档时为NEW', async () => {
    const result = await createServerHarness().main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, true);
  });

  await test('02 read文档存在但readAt为空时为NEW', async () => {
    const result = await createServerHarness({ readStates: [{
      teacher_id: 'teacher-a', announcement_id: latest._id, readAt: null,
      popupShownAt: null, popupAcknowledgedAt: null, envVersion: 'develop'
    }] }).main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, true);
  });

  await test('03 readAt存在时不为NEW', async () => {
    const result = await createServerHarness({ readStates: [{
      teacher_id: 'teacher-a', announcement_id: latest._id, readAt: NOW,
      popupShownAt: null, popupAcknowledgedAt: null, envVersion: 'develop'
    }] }).main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, false);
  });

  await test('04 无最新公告时不为NEW', async () => {
    const result = await createServerHarness({ announcements: [] }).main({
      action: 'bootstrap', envVersion: 'develop'
    });
    assert.strictEqual(result.data.latestIsNew, false);
  });

  await test('05 老师A已读状态独立', async () => {
    const result = await createServerHarness({ readStates: [{
      teacher_id: 'teacher-a', announcement_id: latest._id, readAt: NOW,
      popupShownAt: null, popupAcknowledgedAt: null, envVersion: 'develop'
    }] }).main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, false);
  });

  await test('06 老师B未读状态独立', async () => {
    const result = await createServerHarness({
      openid: 'teacher-b',
      readStates: [{
        teacher_id: 'teacher-a', announcement_id: latest._id, readAt: NOW,
        popupShownAt: null, popupAcknowledgedAt: null, envVersion: 'develop'
      }]
    }).main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, true);
  });

  await test('07 客户端teacherId伪造不能改变可信OPENID结果', async () => {
    const result = await createServerHarness().main({
      action: 'bootstrap', envVersion: 'develop', teacherId: 'teacher-b', readAt: NOW
    });
    assert.strictEqual(result.data.latestIsNew, true);
  });

  await test('08 客户端normalize保留显式latestIsNew', async () => {
    assert.strictEqual(normalizeBootstrapPayload({ latestIsNew: true }).latestIsNew, true);
  });

  await test('09 客户端不从公告静态isNew推断契约', async () => {
    const payload = normalizeBootstrapPayload({ latestAnnouncement: { _id: 'x', isNew: true } });
    assert.strictEqual(payload.latestIsNew, false);
  });

  await test('10 bootstrap网络结果进入独立缓存', async () => {
    const { service, storage } = createClientHarness();
    await service.bootstrapAnnouncements();
    assert.strictEqual(storage.get(service.getCacheKey()).payload.latestIsNew, true);
  });

  await test('11 5分钟缓存读取仍保留NEW', async () => {
    const { service } = createClientHarness();
    await service.bootstrapAnnouncements();
    const result = await service.bootstrapAnnouncements();
    assert.strictEqual(result.latestIsNew, true);
  });

  await test('12 markRead成功后缓存NEW变false', async () => {
    const { service, storage } = createClientHarness();
    await service.bootstrapAnnouncements();
    await service.markRead(latest._id);
    assert.strictEqual(storage.get(service.getCacheKey()).payload.latestIsNew, false);
  });

  await test('13 markRead失败不伪造NEW=false', async () => {
    const { service, storage } = createClientHarness({
      handler: async (request) => {
        if (request.data.action === 'bootstrap') {
          return success({ latestAnnouncement: latest, latestReadState: null, latestIsNew: true });
        }
        throw new Error('offline');
      }
    });
    await service.bootstrapAnnouncements();
    await assert.rejects(service.markRead(latest._id));
    assert.strictEqual(storage.get(service.getCacheKey()).payload.latestIsNew, true);
  });

  await test('14 Major claim只有popupShown时保持NEW', async () => {
    const { service, storage } = createClientHarness({
      handler: async (request) => (
        request.data.action === 'bootstrap'
          ? success({
            latestAnnouncement: latest, latestReadState: null, latestIsNew: true,
            majorCandidate: latest, majorReadState: null
          })
          : success({ claimed: true, readState: { readAt: null, popupShownAt: NOW.toISOString() } })
      )
    });
    await service.bootstrapAnnouncements();
    await service.claimMajorPopup(latest._id);
    assert.strictEqual(storage.get(service.getCacheKey()).payload.latestIsNew, true);
  });

  await test('15 popupAcknowledged但无readAt时保持NEW', async () => {
    const { service, storage } = createClientHarness({
      handler: async (request) => (
        request.data.action === 'bootstrap'
          ? success({
            latestAnnouncement: latest, latestReadState: null, latestIsNew: true,
            majorCandidate: latest, majorReadState: null
          })
          : success({ readState: { readAt: null, popupAcknowledgedAt: NOW.toISOString() } })
      )
    });
    await service.bootstrapAnnouncements();
    await service.acknowledgePopup(latest._id);
    assert.strictEqual(storage.get(service.getCacheKey()).payload.latestIsNew, true);
  });

  console.log(`announcement-stage4c: PASS (${checks} checks)`);
})().catch((error) => {
  console.error('announcement-stage4c: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
