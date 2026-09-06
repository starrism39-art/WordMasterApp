'use strict';

// Exercise the production upload/retry/Full Pull paths; no live cloud access.
const assert = require('assert');
const clone = value => JSON.parse(JSON.stringify(value));
const owner = 'stage1f-owner';
const student = { id: 'stage1f-student', student_id: 'stage1f-student', teacher_id: owner };
const storage = { openid: owner, currentUser: { id: owner }, students: [student] };
const documents = new Map();
let tombstones = [];
let writable = true;
let failStorageKey = '';
const writes = [];
const list = name => name === 'teachers' ? [{ teacher_id: owner, userRole: 'external', memberLevel: 'free' }]
  : name === 'students' ? [student]
    : name === 'learning_records' ? [...documents.values()] : [];
const db = { collection(name) { return {
  where(condition) {
    const rows = list(name).filter(row => Object.keys(condition).every(key => row[key] === condition[key]));
    let offset = 0, limit = 20;
    const query = {
      count: async () => ({ total: rows.length }),
      orderBy() { return query; },
      skip(value) { offset = value; return query; },
      limit(value) { limit = value; return query; },
      get: async () => ({ data: clone(rows.slice(offset, offset + limit)) })
    };
    return query;
  },
  doc(id) { return {
    get: async () => {
      if (documents.has(id)) return { data: clone(documents.get(id)) };
      throw { errCode: -1, errMsg: 'document not found' };
    },
    set: async ({ data }) => {
      if (name === 'students') return { ok: true };
      assert.strictEqual(name, 'learning_records');
      assert.ok(!('_id' in data) && !('_openid' in data), 'system fields must not be written');
      if (!writable) throw new Error('offline');
      writes.push(clone(data));
      documents.set(id, { ...clone(data), _id: id, _openid: owner });
      return { ok: true };
    }
  }; }
}; } };
global.wx = {
  cloud: {
    init() {}, database: () => db,
    callFunction: async ({ name, data }) => {
      assert.strictEqual(name, 'syncTombstoneAuthority');
      assert.strictEqual(data.action, 'list');
      return { result: { success: true, tombstones: clone(tombstones.filter(item =>
        !data.entities || data.entities.some(entity => entity.entityId === item.entityId))) } };
    }
  },
  getStorageSync: key => storage[key] === undefined ? undefined : clone(storage[key]),
  setStorageSync: (key, value) => { if (key === failStorageKey) throw new Error('storage full'); storage[key] = clone(value); },
  removeStorageSync: key => { delete storage[key]; },
  getDeviceInfo: () => ({ platform: 'android' }),
  getLaunchOptionsSync: () => ({ query: {} }),
  showToast() {}
};
global.getApp = () => ({ globalData: { cloudReadOnly: false }, ensureUserPermissions: user => user, emit() {} });
const { syncLearningRecord, retryPendingSyncs, syncAllLocalLearningRecords } = require('../utils/cloud-sync');
const { syncDataFromCloud, migrateLocalDataToCloud } = require('../utils/cloud-migration');
const identity = require('../utils/legacy-record-identity');
const base = { studentId: student.id, wordbookId: 'stage1f-book', teacher_id: owner,
  timestamp: 1700000000000, totalWords: 1, wordsSnapshot: [{ wordId: 'legacy-word', word: 'legacy' }] };
const reset = () => {
  documents.clear(); writes.length = 0; tombstones = []; writable = true; failStorageKey = '';
  for (const key of Object.keys(storage)) delete storage[key];
  Object.assign(storage, { openid: owner, currentUser: { id: owner }, students: [student],
    learningRecords: [], learningProgress: {}, wordMastery: {} });
};
const cases = [];
for (const alias of ['recordId', 'record_id', '_id']) {
  cases.push([`${alias}: upload and offline retry preserve historical identity`, async () => {
    const record = { ...base, [alias]: 'legacy-event' };
    if (alias === '_id') documents.set('legacy-event', { ...clone(record), _openid: owner });
    writable = false;
    await syncLearningRecord(record);
    const pending = Object.values(storage.pendingLearningRecordSync || {});
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].id, 'legacy-event');
    writable = true;
    await retryPendingSyncs();
    await syncLearningRecord(record);
    assert.strictEqual(documents.size, 1);
    assert.strictEqual(writes[0].id || [...documents.values()][0]._id, 'legacy-event');
  }]);
  cases.push([`${alias}: Full Pull preserves local historical record`, async () => {
    storage.learningRecords = [{ ...base, [alias]: 'legacy-event' }];
    const result = await syncDataFromCloud(owner);
    assert.strictEqual(result.success, true);
    assert.strictEqual(storage.learningRecords.length, 1);
    assert.strictEqual(storage.learningRecords[0].id, 'legacy-event');
  }]);
}
cases.push(['Full Pull applies logical-ID tombstone before cloud document-ID fallback', async () => {
  documents.set('physical-doc', { ...base, _id: 'physical-doc', recordId: 'deleted-event' });
  tombstones = [{ entityType: 'learning_record', entityId: 'deleted-event', deletedAt: 1700000000001 }];
  const result = await syncDataFromCloud(owner);
  assert.strictEqual(result.success, true);
  assert.strictEqual(storage.learningRecords.length, 0, 'deleted legacy event must not resurrect');
}]);
cases.push(['Full Pull does not silently discard records with no identity', async () => {
  storage.learningRecords = [clone(base), { ...clone(base), wordsSnapshot: [{ word: 'another' }] }];
  const before = clone(storage.learningRecords);
  assert.strictEqual((await syncDataFromCloud(owner)).success, true);
  assert.strictEqual(storage.learningRecords.length, 2);
  assert.deepStrictEqual(storage.learningRecords.map(row => row.wordsSnapshot), before.map(row => row.wordsSnapshot));
}]);
cases.push(['Empty historical IDs are preserved without adding a duplicate placeholder', async () => {
  storage.learningRecords = [{ ...clone(base), id: '' }, { ...clone(base), id: '' }];
  assert.strictEqual((await syncDataFromCloud(owner)).success, true);
  assert.strictEqual(storage.learningRecords.length, 2);
}]);
cases.push(['No identity evidence: two old records stay local and never share an upload document', async () => {
  const first = clone(base);
  const second = { ...clone(base), wordsSnapshot: [{ wordId: 'another-word', word: 'another' }] };
  storage.learningRecords = [first, second];
  assert.strictEqual((await syncLearningRecord(first)).reason, 'legacy_identity_quarantined');
  assert.strictEqual((await syncLearningRecord(second)).reason, 'legacy_identity_quarantined');
  assert.strictEqual(documents.size, 0, 'no evidence means no guessed identity or cloud write');
  assert.strictEqual(storage.learningRecords.length, 2);
}]);
const quarantineLocal = () => {
  storage.learningRecords = [clone(base)];
  identity.prepareStoredLegacyRecords(owner);
  return storage.learningRecords[0][identity.REF_FIELD];
};
const evidenceFor = (overrides = {}) => ({ accountId: owner, studentId: student.id, wordbookId: base.wordbookId,
  kind: 'independent-event', source: 'independent-event-receipt', reference: 'verified-import-receipt-1',
  sourceEventId: 'ba876abc-e094-404c-9001-111111111111', noPreviousIdentity: true, ...overrides });
cases.push(['Normal records bypass every legacy identity write, even when the journal is unavailable', async () => {
  failStorageKey = identity.JOURNAL_KEY;
  const record = { ...clone(base), id: 'normal-event', recordSchemaVersion: 3 };
  await syncLearningRecord(record);
  assert.strictEqual(documents.size, 1);
  assert.strictEqual(storage[identity.JOURNAL_KEY], undefined);
  assert.strictEqual(writes[0].id, record.id);
  assert.deepStrictEqual(writes[0].wordsSnapshot, record.wordsSnapshot);
}]);
cases.push(['Quarantine is durable, observable, not content-merged and excluded from cloud-derived progress', async () => {
  storage.learningRecords = [clone(base), clone(base)];
  await syncAllLocalLearningRecords();
  const refs = storage.learningRecords.map(record => record[identity.REF_FIELD]);
  assert.strictEqual(new Set(refs).size, 2);
  await syncDataFromCloud(owner);
  await syncAllLocalLearningRecords();
  assert.strictEqual(identity.getLegacyIdentityStatus(owner).quarantined, 2);
  assert.strictEqual(documents.size, 0);
  assert.strictEqual(storage.learningRecords.length, 2);
  assert.deepStrictEqual(storage.learningRecords.map(record => record.wordsSnapshot), [base.wordsSnapshot, base.wordsSnapshot]);
  assert.strictEqual((storage.learningProgress[student.id] || {}).learnedWords || 0, 0);
  assert.ok(identity.getLegacyIdentityStatus(owner).entries.every(entry => entry.reason && entry.recovery));
}]);
cases.push(['Structured same-account pending key recovers old ID, retries idempotently and removes only that slot', async () => {
  const key = JSON.stringify([student.id, base.wordbookId, 'old-pending-id']);
  storage.pendingLearningRecordSync = { [key]: { ...clone(base), accountId: owner }, opaque: { ...clone(base), accountId: owner } };
  writable = false;
  await retryPendingSyncs();
  assert.ok(storage.pendingLearningRecordSync[key]);
  writable = true;
  await retryPendingSyncs();
  await retryPendingSyncs();
  assert.strictEqual(documents.size, 1);
  assert.strictEqual([...documents.values()][0].id, 'old-pending-id');
  assert.ok(storage.pendingLearningRecordSync.opaque);
  assert.ok(!storage.pendingLearningRecordSync[key]);
  assert.strictEqual(identity.getLegacyIdentityStatus(owner).quarantined, 1);
}]);
cases.push(['Quarantined pending and migration do not block a normal record', async () => {
  storage.learningRecords = [clone(base), { ...clone(base), id: 'normal-event' }];
  const result = await migrateLocalDataToCloud({ accountId: owner, suppressToast: true });
  assert.strictEqual(result.success, true);
  assert.strictEqual(documents.size, 1);
  assert.strictEqual([...documents.values()][0].id, 'normal-event');
  assert.strictEqual(storage.learningRecords.length, 2);
  await syncDataFromCloud(owner);
  await syncAllLocalLearningRecords();
  assert.strictEqual(documents.size, 1);
}]);
cases.push(['Synthetic ID requires explicit independent-event provenance, persists first and survives restart/retry/migration/pull', async () => {
  const ref = quarantineLocal();
  assert.throws(() => identity.bindLegacyIdentityEvidence(ref, evidenceFor({ source: 'same-content' })), /unproven/);
  assert.throws(() => identity.bindLegacyIdentityEvidence(ref, evidenceFor({ noPreviousIdentity: false })), /unproven/);
  const id = identity.bindLegacyIdentityEvidence(ref, evidenceFor());
  assert.strictEqual(identity.bindLegacyIdentityEvidence(ref, evidenceFor()), id);
  delete require.cache[require.resolve('../utils/legacy-record-identity')];
  const reloaded = require('../utils/legacy-record-identity');
  assert.strictEqual(reloaded.prepareLegacyRecord(storage.learningRecords[0], { accountId: owner }).record.id, id);
  writable = false;
  await syncAllLocalLearningRecords();
  assert.strictEqual(Object.values(storage.pendingLearningRecordSync)[0].id, id);
  writable = true;
  await retryPendingSyncs();
  await migrateLocalDataToCloud({ accountId: owner, suppressToast: true });
  await syncDataFromCloud(owner);
  await syncAllLocalLearningRecords();
  assert.strictEqual(documents.size, 1);
  assert.strictEqual(storage.learningRecords.length, 1);
  assert.strictEqual(storage.learningRecords[0].id, id);
  assert.ok(writes.every(record => !(identity.REF_FIELD in record)));
  assert.strictEqual(reloaded.getLegacyIdentityStatus(owner).synthetic, 1);
}]);
cases.push(['Synthetic binding rejects undurable local source and failed journal persistence', async () => {
  const detached = clone(base);
  identity.prepareLegacyRecord(detached, { accountId: owner });
  assert.throws(() => identity.bindLegacyIdentityEvidence(detached[identity.REF_FIELD], evidenceFor()), /durably_bound/);
  const ref = quarantineLocal();
  failStorageKey = identity.JOURNAL_KEY;
  assert.throws(() => identity.bindLegacyIdentityEvidence(ref, evidenceFor()), /storage full/);
  await syncLearningRecord(storage.learningRecords[0]);
  assert.strictEqual(documents.size, 0);
  assert.strictEqual(identity.getLegacyIdentityStatus(owner).synthetic, 0);
}]);
cases.push(['Same content with two independently proven events gets distinct IDs; reusing evidence is rejected', async () => {
  storage.learningRecords = [clone(base), clone(base)];
  identity.prepareStoredLegacyRecords(owner);
  const refs = storage.learningRecords.map(record => record[identity.REF_FIELD]);
  const first = identity.bindLegacyIdentityEvidence(refs[0], evidenceFor());
  assert.throws(() => identity.bindLegacyIdentityEvidence(refs[1], evidenceFor()), /already_bound/);
  const second = identity.bindLegacyIdentityEvidence(refs[1], evidenceFor({ reference: 'receipt-2', sourceEventId: 'ba876abc-e094-404c-9001-222222222222' }));
  assert.notStrictEqual(first, second);
  await syncAllLocalLearningRecords();
  assert.strictEqual(documents.size, 2);
}]);
cases.push(['Recovered identity still obeys tombstone in direct upload, pending, migration and Full Pull', async () => {
  const ref = quarantineLocal();
  identity.bindLegacyIdentityEvidence(ref, evidenceFor({ kind: 'old-id', source: 'migration-map', recordId: 'deleted-event' }));
  tombstones = [{ entityType: 'learning_record', entityId: 'deleted-event', deletedAt: 1700000000001 }];
  const saved = clone(storage.learningRecords[0]);
  assert.strictEqual((await syncLearningRecord(saved)).tombstoned, true);
  assert.strictEqual(storage.learningRecords.length, 0);
  storage.learningRecords = [saved];
  storage.pendingLearningRecordSync = { [JSON.stringify([student.id, base.wordbookId, 'deleted-event'])]: { ...clone(base), accountId: owner } };
  await retryPendingSyncs();
  assert.strictEqual(Object.keys(storage.pendingLearningRecordSync || {}).length, 0);
  await migrateLocalDataToCloud({ accountId: owner, suppressToast: true });
  await syncDataFromCloud(owner);
  assert.strictEqual(documents.size, 0);
  assert.strictEqual(storage.learningRecords.length, 0);
}]);
cases.push(['Evidence and pending recovery cannot cross account, student or wordbook boundaries', async () => {
  const ref = quarantineLocal();
  for (const overrides of [{ accountId: 'other-owner' }, { studentId: 'other-student' }, { wordbookId: 'other-book' }]) {
    assert.throws(() => identity.bindLegacyIdentityEvidence(ref, evidenceFor(overrides)), /session_changed|scope_mismatch/);
  }
  storage.pendingLearningRecordSync = {
    [JSON.stringify([student.id, base.wordbookId, 'foreign-event'])]: { ...clone(base), accountId: 'other-owner', teacher_id: 'other-owner' },
    [JSON.stringify([student.id, 'other-book', 'wrong-book'])]: { ...clone(base), accountId: owner }
  };
  await retryPendingSyncs();
  assert.strictEqual(documents.size, 0);
  assert.strictEqual(Object.keys(storage.pendingLearningRecordSync).length, 2);
  assert.strictEqual(identity.getLegacyIdentityStatus('other-owner').recovered, 0);
}]);
cases.push(['Same verified event on independent devices uses the same synthetic ID without a shared journal', async () => {
  const firstRef = quarantineLocal();
  const firstId = identity.bindLegacyIdentityEvidence(firstRef, evidenceFor());
  await syncAllLocalLearningRecords();
  delete storage[identity.JOURNAL_KEY]; // a second isolated client, not a production cache clear
  const secondRef = quarantineLocal();
  assert.notStrictEqual(secondRef, firstRef);
  assert.strictEqual(identity.bindLegacyIdentityEvidence(secondRef, evidenceFor()), firstId);
  await syncAllLocalLearningRecords();
  assert.strictEqual(documents.size, 1);
}]);
cases.push(['Quarantine metadata persistence failure does not block normal pending retry', async () => {
  const key = JSON.stringify([student.id, base.wordbookId, 'normal-event']);
  storage.pendingLearningRecordSync = { opaque: { ...clone(base), accountId: owner },
    [key]: { ...clone(base), accountId: owner, id: 'normal-event' } };
  failStorageKey = 'pendingLearningRecordSync';
  await retryPendingSyncs();
  assert.strictEqual(documents.size, 1);
  assert.strictEqual([...documents.values()][0].id, 'normal-event');
}]);
cases.push(['Incomplete scope is observable and retained, never promoted to a synthetic identity', async () => {
  storage.learningRecords = [{ ...clone(base), wordbookId: '' }];
  await syncAllLocalLearningRecords();
  const status = identity.getLegacyIdentityStatus(owner);
  assert.strictEqual(status.quarantined, 1);
  assert.ok(status.entries[0].reason && status.entries[0].recovery);
  assert.strictEqual(storage.learningRecords[0][identity.STATE_FIELD].reason, 'legacy_scope_unproven');
  assert.strictEqual(documents.size, 0);
  assert.strictEqual(storage.learningRecords.length, 1);
}]);
cases.push(['Acceptance fixture inventory: recovered 1, synthetic 1, deferred 2; normal record unchanged', async () => {
  const normal = { ...clone(base), id: 'normal-event', recordSchemaVersion: 3 };
  storage.learningRecords = [clone(base), clone(base), clone(base), clone(base), normal];
  identity.prepareStoredLegacyRecords(owner);
  const refs = storage.learningRecords.slice(0, 4).map(record => record[identity.REF_FIELD]);
  identity.bindLegacyIdentityEvidence(refs[0], evidenceFor({ kind: 'old-id', source: 'migration-map', recordId: 'recovered-event' }));
  identity.bindLegacyIdentityEvidence(refs[1], evidenceFor());
  await syncAllLocalLearningRecords();
  await syncDataFromCloud(owner);
  const { recovered, synthetic, quarantined } = identity.getLegacyIdentityStatus(owner);
  assert.deepStrictEqual({ recovered, synthetic, quarantined }, { recovered: 1, synthetic: 1, quarantined: 2 });
  assert.strictEqual(documents.size, 3);
  assert.strictEqual(storage.learningRecords.length, 5);
  const savedNormal = storage.learningRecords.find(record => record.id === normal.id);
  assert.strictEqual(savedNormal.recordSchemaVersion, normal.recordSchemaVersion);
  assert.deepStrictEqual(savedNormal.wordsSnapshot, normal.wordsSnapshot);
  assert.ok(storage.learningRecords.filter(record => !record.id).every(record => record.wordsSnapshot[0].word === 'legacy'));
  console.log('Stage1F isolated acceptance fixture:', JSON.stringify({ recovered, synthetic, quarantined, localRecords: 5, normalUnaffected: true }));
}]);
cases.push(['Unattributed legacy objects retain explicit local quarantine reasons without claiming an account', async () => {
  storage.learningRecords = [{ wordsSnapshot: [{ word: 'unknown' }] }];
  await syncAllLocalLearningRecords();
  assert.strictEqual(storage.learningRecords[0][identity.STATE_FIELD].reason, 'legacy_scope_unproven');
  assert.strictEqual(storage.learningRecords[0].id, undefined);
  assert.strictEqual(documents.size, 0);
}]);
cases.push(['Foreign-owned legacy source is preserved byte-for-byte without claiming or mutating its identity', async () => {
  storage.learningRecords = [{ ...clone(base), teacher_id: 'other-owner' }];
  const before = clone(storage.learningRecords);
  await syncAllLocalLearningRecords();
  assert.deepStrictEqual(storage.learningRecords, before);
  assert.strictEqual(identity.getLegacyIdentityStatus(owner).quarantined, 0);
  assert.strictEqual(documents.size, 0);
}]);
cases.push(['Existing physical legacy cloud document is not duplicated by _id recovery', async () => {
  const legacy = { ...clone(base), _id: 'old-physical-document', _openid: owner };
  documents.set(legacy._id, clone(legacy));
  storage.learningRecords = [clone(legacy)];
  await syncLearningRecord(storage.learningRecords[0]);
  await syncDataFromCloud(owner);
  await syncAllLocalLearningRecords();
  assert.strictEqual(documents.size, 1, 'physical document identity must not be wrapped into a second document');
}]);
cases.push(['Physical legacy document provenance survives offline pending and never enters cloud payload', async () => {
  const legacy = { ...clone(base), _id: 'old-physical-document', _openid: owner };
  documents.set(legacy._id, clone(legacy));
  writable = false;
  await syncLearningRecord(legacy);
  assert.strictEqual(Object.values(storage.pendingLearningRecordSync)[0][identity.DOC_FIELD], legacy._id);
  writable = true;
  await retryPendingSyncs();
  assert.strictEqual(documents.size, 1);
  assert.strictEqual(Object.keys(storage.pendingLearningRecordSync || {}).length, 0);
  assert.ok(writes.every(record => !(identity.DOC_FIELD in record) && !(identity.STATE_FIELD in record)));
}]);
cases.push(['Conflicting old cloud document provenance cannot overwrite another owner or event', async () => {
  const legacy = { ...clone(base), _id: 'old-physical-document' };
  documents.set(legacy._id, { ...clone(legacy), teacher_id: 'foreign-owner' });
  const before = clone([...documents.values()]);
  assert.strictEqual((await syncLearningRecord(legacy)).reason, 'legacy_cloud_document_identity_conflict');
  assert.deepStrictEqual([...documents.values()], before);
  assert.strictEqual(writes.length, 0);
}]);
cases.push(['Old record_id plus physical _id stays one document across fresh-client Full Pull and retry', async () => {
  const legacy = { ...clone(base), record_id: 'old-event-id', _id: 'physical-location', _openid: owner };
  documents.set(legacy._id, clone(legacy));
  await syncLearningRecord(legacy);
  assert.strictEqual(documents.size, 1);
  assert.strictEqual(documents.get(legacy._id).record_id, 'old-event-id');
  assert.strictEqual(documents.get(legacy._id).id, undefined);
  storage.learningRecords = []; // separate client with no prior local mapping
  await syncDataFromCloud(owner);
  assert.strictEqual(storage.learningRecords[0].id, 'old-event-id');
  await syncAllLocalLearningRecords();
  assert.strictEqual(documents.size, 1);
}]);
cases.push(['Missing old physical document is not evidence for creating a replacement cloud record', async () => {
  const legacy = { ...clone(base), _id: 'missing-physical-document' };
  storage.learningRecords = [clone(legacy)];
  assert.strictEqual((await syncLearningRecord(legacy)).reason, 'legacy_cloud_document_missing');
  assert.strictEqual(documents.size, 0);
  assert.strictEqual(storage.learningRecords.length, 1);
}]);
(async () => {
  let failures = 0;
  for (const [name, run] of cases) {
    reset();
    try { await run(); console.log('PASS:', name); }
    catch (error) { failures++; console.error('FAIL:', name, error.message); }
  }
  console.log(`Stage1F legacy identity: ${cases.length - failures}/${cases.length}`);
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
