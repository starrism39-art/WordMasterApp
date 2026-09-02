'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  PAGE_SIZE,
  compareVersions,
  createAnnouncementService
} = require('../cloudfunctions/announcement/service');
const { stableReadId, withoutDocumentId } = require('../cloudfunctions/announcement/repository');

const NOW = new Date('2026-09-01T04:00:00.000Z');

const announcement = (overrides = {}) => ({
  _id: overrides._id || 'announcement-default',
  type: 'system',
  priority: 'normal',
  status: 'published',
  title: '公告系统Stage2专用测试数据',
  summary: '测试摘要',
  content: '测试正文',
  audience: 'teachers',
  channel: 'all',
  minVersion: null,
  bindVersion: null,
  popup: false,
  action: null,
  publishTime: new Date('2026-09-01T03:00:00.000Z'),
  endTime: null,
  createdAt: new Date('2026-09-01T02:00:00.000Z'),
  updatedAt: new Date('2026-09-01T02:00:00.000Z'),
  ...overrides
});

class MemoryRepository {
  constructor({ announcements = [], teachers = [{ teacher_id: 'teacher-a', status: 'active' }] } = {}) {
    this.announcements = announcements;
    this.teachers = teachers;
    this.reads = new Map();
    this.getReadsCalls = 0;
    this.touched = new Set();
    this.lock = Promise.resolve();
  }

  async findActiveTeacher(openid) {
    this.touched.add('teachers');
    return this.teachers.find((item) => (
      item.teacher_id === openid && (!item.status || item.status === 'active')
    )) || null;
  }

  async listPublished(offset, limit) {
    this.touched.add('announcements');
    return this.announcements
      .filter((item) => item.status === 'published')
      .sort((left, right) => new Date(right.publishTime) - new Date(left.publishTime))
      .slice(offset, offset + limit);
  }

  async listMajorCandidates() {
    this.touched.add('announcements');
    return this.announcements.filter((item) => item.type === 'version_update' && item.priority === 'major');
  }

  async getAnnouncement(id) {
    this.touched.add('announcements');
    return this.announcements.find((item) => item._id === id) || null;
  }

  async getReads(openid, ids) {
    this.touched.add('announcement_reads');
    this.getReadsCalls += 1;
    return [...this.reads.values()].filter((item) => item.teacher_id === openid && ids.includes(item.announcement_id));
  }

  exclusive(operation) {
    const result = this.lock.then(operation, operation);
    this.lock = result.then(() => undefined, () => undefined);
    return result;
  }

  baseRead({ openid, announcementId, version, envVersion, now }) {
    const id = stableReadId(openid, announcementId);
    return {
      _id: id,
      teacher_id: openid,
      announcement_id: announcementId,
      readAt: null,
      popupShownAt: null,
      popupAcknowledgedAt: null,
      version,
      envVersion,
      createdAt: now,
      updatedAt: now
    };
  }

  async claimMajorPopup(input) {
    this.touched.add('announcement_reads');
    return this.exclusive(async () => {
      const id = stableReadId(input.openid, input.announcementId);
      const existing = this.reads.get(id);
      if (existing && existing.popupShownAt) return { claimed: false, readState: existing };
      const readState = existing || this.baseRead(input);
      readState.popupShownAt = input.now;
      readState.version = input.version;
      readState.envVersion = input.envVersion;
      readState.updatedAt = input.now;
      this.reads.set(id, readState);
      return { claimed: true, readState };
    });
  }

  async markRead(input) {
    this.touched.add('announcement_reads');
    return this.exclusive(async () => {
      const id = stableReadId(input.openid, input.announcementId);
      const readState = this.reads.get(id) || this.baseRead(input);
      readState.readAt = readState.readAt || input.now;
      readState.version = input.version;
      readState.envVersion = input.envVersion;
      readState.updatedAt = input.now;
      this.reads.set(id, readState);
      return readState;
    });
  }

  async acknowledgePopup(input) {
    this.touched.add('announcement_reads');
    return this.exclusive(async () => {
      const id = stableReadId(input.openid, input.announcementId);
      const readState = this.reads.get(id);
      if (!readState || !readState.popupShownAt) return { acknowledged: false, readState };
      readState.readAt = readState.readAt || input.now;
      readState.popupAcknowledgedAt = readState.popupAcknowledgedAt || input.now;
      readState.version = input.version;
      readState.envVersion = input.envVersion;
      readState.updatedAt = input.now;
      return { acknowledged: true, readState };
    });
  }
}

const harness = ({ announcements = [], openid = 'teacher-a', teachers } = {}) => {
  const repository = new MemoryRepository({ announcements, teachers });
  const service = createAnnouncementService({
    repository,
    getOpenid: () => openid,
    clock: () => new Date(NOW)
  });
  return { repository, main: service.main };
};

const testResults = [];
const test = async (name, operation) => {
  await operation();
  testResults.push(name);
};

(async () => {
  await test('01 OPENID教师身份识别', async () => {
    const missing = harness({ openid: '', announcements: [announcement()] });
    assert.strictEqual((await missing.main({ action: 'bootstrap', teacherId: 'teacher-a' })).error, 'UNAUTHORIZED');
    const inactive = harness({ announcements: [announcement()], teachers: [{ teacher_id: 'teacher-a', status: 'disabled' }] });
    assert.strictEqual((await inactive.main({ action: 'bootstrap' })).error, 'TEACHER_NOT_FOUND');
    const legacy = harness({ announcements: [announcement()], teachers: [{ teacher_id: 'teacher-a' }] });
    assert.strictEqual((await legacy.main({ action: 'bootstrap', envVersion: 'develop' })).success, true);
  });

  await test('02 draft不返回', async () => {
    const { main } = harness({ announcements: [announcement({ status: 'draft' })] });
    assert.strictEqual((await main({ action: 'bootstrap', envVersion: 'develop' })).data.latestAnnouncement, null);
  });

  await test('03 archived不返回', async () => {
    const item = announcement({ status: 'archived' });
    const { main } = harness({ announcements: [item] });
    assert.strictEqual((await main({ action: 'listHistory', envVersion: 'develop' })).data.items.length, 0);
    assert.strictEqual((await main({ action: 'getDetail', announcementId: item._id, envVersion: 'develop' })).error, 'NOT_FOUND');
  });

  await test('04 未到publishTime不返回', async () => {
    const future = announcement({ publishTime: new Date('2026-09-02T00:00:00.000Z') });
    const { main } = harness({ announcements: [future] });
    assert.strictEqual((await main({ action: 'bootstrap', envVersion: 'develop' })).data.latestAnnouncement, null);
    assert.strictEqual((await main({ action: 'listHistory', envVersion: 'develop' })).data.items.length, 0);
    assert.strictEqual((await main({ action: 'getDetail', announcementId: future._id, envVersion: 'develop' })).error, 'NOT_FOUND');
  });

  await test('05 过期首页隐藏历史保留', async () => {
    const expired = announcement({ endTime: new Date('2026-08-31T00:00:00.000Z') });
    const { main } = harness({ announcements: [expired] });
    assert.strictEqual((await main({ action: 'bootstrap', envVersion: 'develop' })).data.latestAnnouncement, null);
    assert.strictEqual((await main({ action: 'listHistory', envVersion: 'develop' })).data.items[0].announcement._id, expired._id);
  });

  await test('06 audience teachers正确', async () => {
    const all = announcement({ _id: 'all-audience', audience: 'all' });
    const teachers = announcement({ _id: 'teachers-audience', publishTime: new Date('2026-09-01T03:30:00Z') });
    const { main } = harness({ announcements: [all, teachers] });
    const result = await main({ action: 'listHistory', envVersion: 'develop' });
    assert.deepStrictEqual(result.data.items.map((item) => item.announcement._id), ['teachers-audience', 'all-audience']);
  });

  await test('07 channel过滤', async () => {
    const release = announcement({ _id: 'release-only', channel: 'release' });
    const develop = announcement({ _id: 'develop-only', channel: 'develop' });
    const { main } = harness({ announcements: [release, develop] });
    const result = await main({ action: 'listHistory', envVersion: 'develop' });
    assert.deepStrictEqual(result.data.items.map((item) => item.announcement._id), ['develop-only']);
  });

  await test('08 release bindVersion精确匹配', async () => {
    const bound = announcement({ _id: 'bound', channel: 'release', bindVersion: '2.10.0' });
    const { main } = harness({ announcements: [bound] });
    assert.strictEqual((await main({ action: 'bootstrap', envVersion: 'release', version: '2.9.9' })).data.latestAnnouncement, null);
    assert.strictEqual((await main({ action: 'bootstrap', envVersion: 'release', version: '2.10.0' })).data.latestAnnouncement._id, 'bound');
  });

  await test('09 minVersion逐段整数比较', async () => {
    assert.strictEqual(compareVersions('2.10.0', '2.9.9'), 1);
    assert.strictEqual(compareVersions('2.0', '2.0.0'), 0);
    assert.strictEqual(compareVersions('2.x', '2.0'), null);
    const item = announcement({ channel: 'release', minVersion: '2.10.0' });
    const { main } = harness({ announcements: [item] });
    assert.strictEqual((await main({ action: 'bootstrap', envVersion: 'release', version: '2.9.9' })).data.latestAnnouncement, null);
  });

  await test('10 trial/develop不使用绑定版本', async () => {
    const bound = announcement({ bindVersion: '1.0.0', channel: 'all' });
    const { main } = harness({ announcements: [bound] });
    for (const envVersion of ['trial', 'develop']) {
      assert.strictEqual((await main({ action: 'bootstrap', envVersion, version: '1.0.0' })).data.latestAnnouncement, null);
    }
  });

  await test('11 bootstrap返回最新且不抢占弹窗', async () => {
    const older = announcement({ _id: 'older', publishTime: new Date('2026-09-01T02:00:00Z') });
    const latest = announcement({ _id: 'latest', publishTime: new Date('2026-09-01T03:30:00Z') });
    const major = announcement({
      _id: 'major', type: 'version_update', priority: 'major', popup: true,
      publishTime: new Date('2026-09-01T03:15:00Z')
    });
    const { main, repository } = harness({ announcements: [older, latest, major] });
    const result = await main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestAnnouncement._id, 'latest');
    assert.strictEqual(result.data.majorCandidate._id, 'major');
    assert.strictEqual(repository.reads.size, 0);
  });

  await test('12 claimMajorPopup第一次成功', async () => {
    const major = announcement({ _id: 'major', type: 'version_update', priority: 'major', popup: true });
    const { main } = harness({ announcements: [major] });
    assert.strictEqual((await main({ action: 'claimMajorPopup', announcementId: 'major', envVersion: 'develop' })).data.claimed, true);
  });

  await test('13 第二设备并发claim只有一次成功', async () => {
    const major = announcement({ _id: 'major', type: 'version_update', priority: 'major', popup: true });
    const { main } = harness({ announcements: [major] });
    const results = await Promise.all([
      main({ action: 'claimMajorPopup', announcementId: 'major', envVersion: 'develop' }),
      main({ action: 'claimMajorPopup', announcementId: 'major', envVersion: 'develop' })
    ]);
    assert.deepStrictEqual(results.map((item) => item.data.claimed).sort(), [false, true]);
  });

  await test('14 claim重复调用幂等', async () => {
    const major = announcement({ _id: 'major', type: 'version_update', priority: 'major', popup: true });
    const { main, repository } = harness({ announcements: [major] });
    await main({ action: 'claimMajorPopup', announcementId: 'major', envVersion: 'develop' });
    const second = await main({ action: 'claimMajorPopup', announcementId: 'major', envVersion: 'develop' });
    assert.strictEqual(second.data.claimed, false);
    assert.strictEqual(repository.reads.size, 1);
  });

  await test('15 markRead幂等且不写ack', async () => {
    const item = announcement({ _id: 'readable' });
    const { main, repository } = harness({ announcements: [item] });
    const first = await main({ action: 'markRead', announcementId: 'readable', envVersion: 'develop' });
    const second = await main({ action: 'markRead', announcementId: 'readable', envVersion: 'develop' });
    assert.deepStrictEqual(second.data.readState.readAt, first.data.readState.readAt);
    assert.strictEqual(second.data.readState.popupAcknowledgedAt, null);
    assert.strictEqual(repository.reads.size, 1);
  });

  await test('16 acknowledgePopup写read与ack且要求先claim', async () => {
    const major = announcement({ _id: 'major', type: 'version_update', priority: 'major', popup: true });
    const { main, repository } = harness({ announcements: [major] });
    assert.strictEqual((await main({ action: 'acknowledgePopup', announcementId: 'major', envVersion: 'develop' })).error, 'POPUP_NOT_CLAIMED');
    await main({ action: 'claimMajorPopup', announcementId: 'major', envVersion: 'develop' });
    const result = await main({ action: 'acknowledgePopup', announcementId: 'major', envVersion: 'develop' });
    assert.ok(result.data.readState.readAt instanceof Date);
    assert.ok(result.data.readState.popupAcknowledgedAt instanceof Date);
    const saved = [...repository.reads.values()][0];
    assert.deepStrictEqual(Object.keys(saved).sort(), [
      '_id', 'teacher_id', 'announcement_id', 'readAt', 'popupShownAt',
      'popupAcknowledgedAt', 'version', 'envVersion', 'createdAt', 'updatedAt'
    ].sort());
    const writeData = withoutDocumentId(saved);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(writeData, '_id'), false);
    assert.strictEqual(saved._id, stableReadId('teacher-a', 'major'));
  });

  await test('17 listHistory每页20条', async () => {
    const items = Array.from({ length: 25 }, (_, index) => announcement({
      _id: `history-${String(index).padStart(2, '0')}`,
      publishTime: new Date(NOW.getTime() - index * 1000)
    }));
    const { main } = harness({ announcements: items });
    const first = await main({ action: 'listHistory', page: 1, envVersion: 'develop' });
    const second = await main({ action: 'listHistory', page: 2, envVersion: 'develop' });
    assert.strictEqual(first.data.pageSize, PAGE_SIZE);
    assert.strictEqual(first.data.items.length, 20);
    assert.strictEqual(first.data.hasMore, true);
    assert.strictEqual(second.data.items.length, 5);
    assert.strictEqual(second.data.hasMore, false);
  });

  await test('18 listHistory批量读取状态避免N+1', async () => {
    const items = Array.from({ length: 10 }, (_, index) => announcement({ _id: `read-${index}` }));
    const { main, repository } = harness({ announcements: items });
    await repository.markRead({ openid: 'teacher-a', announcementId: 'read-3', version: null, envVersion: 'develop', now: NOW });
    const result = await main({ action: 'listHistory', envVersion: 'develop' });
    assert.strictEqual(repository.getReadsCalls, 1);
    assert.ok(result.data.items.find((entry) => entry.announcement._id === 'read-3').readState.readAt);
  });

  await test('19 getDetail仅允许可见published并隐藏无权信息', async () => {
    const releaseOnly = announcement({ _id: 'secret', channel: 'release' });
    const expired = announcement({ _id: 'expired', endTime: new Date('2026-08-01T00:00:00Z') });
    const { main } = harness({ announcements: [releaseOnly, expired] });
    assert.deepStrictEqual(await main({ action: 'getDetail', announcementId: 'secret', envVersion: 'develop' }), { success: false, error: 'NOT_FOUND' });
    assert.strictEqual((await main({ action: 'getDetail', announcementId: 'expired', envVersion: 'develop' })).data.announcement._id, 'expired');
  });

  await test('20 action target非法拒绝', async () => {
    const unsafe = announcement({
      _id: 'unsafe',
      action: { type: 'navigate', target: 'https://evil.example', params: {} }
    });
    const { main } = harness({ announcements: [unsafe] });
    assert.strictEqual((await main({ action: 'getDetail', announcementId: 'unsafe', envVersion: 'develop' })).error, 'NOT_FOUND');
  });

  await test('21 客户端身份与时间戳伪造无效', async () => {
    const item = announcement({ _id: 'forgery-check' });
    const { main, repository } = harness({ announcements: [item] });
    const forged = '2000-01-01T00:00:00.000Z';
    await main({
      action: 'markRead', announcementId: 'forgery-check', envVersion: 'develop',
      teacherId: 'victim', openid: 'victim', readAt: forged, popupShownAt: forged,
      popupAcknowledgedAt: forged
    });
    const saved = [...repository.reads.values()][0];
    assert.strictEqual(saved.teacher_id, 'teacher-a');
    assert.notStrictEqual(saved.readAt.toISOString(), forged);
    assert.strictEqual(saved.popupShownAt, null);
    assert.strictEqual(saved.popupAcknowledgedAt, null);
  });

  await test('22 公告服务与学习数据彻底隔离', async () => {
    const item = announcement({ _id: 'isolated' });
    const { main, repository } = harness({ announcements: [item] });
    await main({ action: 'markRead', announcementId: 'isolated', envVersion: 'develop' });
    assert.deepStrictEqual([...repository.touched].sort(), ['announcement_reads', 'announcements', 'teachers']);
    const productionSource = ['index.js', 'model.js', 'repository.js', 'service.js']
      .map((file) => fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'announcement', file), 'utf8'))
      .join('\n');
    for (const forbidden of ['learning_records', 'learning_progress', 'word_mastery', 'cloud-sync', 'pending', 'generation']) {
      assert.strictEqual(productionSource.includes(forbidden), false, forbidden);
    }
  });

  await test('23 bootstrap无read文档时latestIsNew为true', async () => {
    const item = announcement({ _id: 'new-without-read' });
    const { main } = harness({ announcements: [item] });
    const result = await main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, true);
  });

  await test('24 bootstrap有read文档但readAt为空时latestIsNew为true', async () => {
    const item = announcement({ _id: 'new-empty-read-at' });
    const { main, repository } = harness({ announcements: [item] });
    const readState = repository.baseRead({
      openid: 'teacher-a', announcementId: item._id, version: null,
      envVersion: 'develop', now: NOW
    });
    readState.popupShownAt = NOW;
    readState.popupAcknowledgedAt = NOW;
    repository.reads.set(readState._id, readState);
    const result = await main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, true);
  });

  await test('25 bootstrap有readAt时latestIsNew为false', async () => {
    const item = announcement({ _id: 'already-read' });
    const { main, repository } = harness({ announcements: [item] });
    await repository.markRead({
      openid: 'teacher-a', announcementId: item._id, version: null,
      envVersion: 'develop', now: NOW
    });
    const result = await main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, false);
  });

  await test('26 bootstrap无最新公告时latestIsNew为false', async () => {
    const { main } = harness();
    const result = await main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestIsNew, false);
  });

  await test('27 latestIsNew按可信OPENID隔离老师且忽略客户端伪造', async () => {
    const item = announcement({ _id: 'teacher-isolation' });
    const repository = new MemoryRepository({
      announcements: [item],
      teachers: [
        { teacher_id: 'teacher-a', status: 'active' },
        { teacher_id: 'teacher-b', status: 'active' }
      ]
    });
    await repository.markRead({
      openid: 'teacher-a', announcementId: item._id, version: null,
      envVersion: 'develop', now: NOW
    });
    const serviceA = createAnnouncementService({ repository, getOpenid: () => 'teacher-a', clock: () => NOW });
    const serviceB = createAnnouncementService({ repository, getOpenid: () => 'teacher-b', clock: () => NOW });
    const resultA = await serviceA.main({ action: 'bootstrap', envVersion: 'develop', teacherId: 'teacher-b' });
    const resultB = await serviceB.main({ action: 'bootstrap', envVersion: 'develop', teacherId: 'teacher-a' });
    assert.strictEqual(resultA.data.latestIsNew, false);
    assert.strictEqual(resultB.data.latestIsNew, true);
  });

  await test('28 Major弹窗字段在readAt为空时不改变NEW', async () => {
    const major = announcement({
      _id: 'major-new-independent', type: 'version_update', priority: 'major', popup: true
    });
    const { main } = harness({ announcements: [major] });
    await main({ action: 'claimMajorPopup', announcementId: major._id, envVersion: 'develop' });
    const result = await main({ action: 'bootstrap', envVersion: 'develop' });
    assert.strictEqual(result.data.latestReadState.readAt, null);
    assert.ok(result.data.latestReadState.popupShownAt);
    assert.strictEqual(result.data.latestIsNew, true);
  });

  console.log(`announcement-stage2: PASS (${testResults.length} checks)`);
})().catch((error) => {
  console.error('announcement-stage2: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
