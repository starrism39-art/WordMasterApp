'use strict';

// Local-only evidence journal. Normal records never enter this module's
// preparation path. Neither content similarity nor cloud absence is evidence.
const { descriptorForLearningRecord } = require('./sync-tombstones');
const JOURNAL_KEY = 'legacyLearningRecordIdentityV1';
const REF_FIELD = '_legacySyncRef';
const STATE_FIELD = '_legacySyncState';
const DOC_FIELD = '_legacyCloudDocumentId';
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => String(value == null ? '' : value).trim();
// Explicit document provenance only. Normal logical-ID records do not gain
// this marker; no query/content matching is used to guess a document link.
const getLegacyCloudDocumentId = record => {
  if (!record || typeof record !== 'object') return '';
  if (record[DOC_FIELD]) return text(record[DOC_FIELD]);
  const logicalId = record.id || record.recordId;
  return record._id && (!logicalId || text(logicalId) === text(record._id)) ? text(record._id) : '';
};
let sequence = 0;
const newRef = () => `lr_${Date.now().toString(36)}_${(++sequence).toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
const scopeOf = (record, accountId) => ({
  accountId: text(accountId),
  studentId: text(record.studentId || record.student_id || record.userId),
  wordbookId: text(record.wordbookId || record.wordbook_id)
});
const sameScope = (a, b) => ['accountId', 'studentId', 'wordbookId'].every(key => a[key] === b[key]);
const deferRecord = (record, reason, error) => {
  record[STATE_FIELD] = { status: 'quarantined', reason,
    recovery: 'Keep the original locally; resume only after scope and durable event identity are proven.' };
  return { record, ready: false, reason, ...(error ? { error } : {}) };
};
const assertAccount = accountId => {
  if (!accountId || text(wx.getStorageSync('openid')) !== accountId) throw new Error('legacy_account_session_changed');
};
const readJournal = () => {
  const value = wx.getStorageSync(JOURNAL_KEY);
  if (!value) return { version: 1, entries: [] };
  if (value.version !== 1 || !Array.isArray(value.entries)) throw new Error('legacy_journal_invalid');
  return clone(value);
};
const saveJournal = (journal, accountId) => {
  assertAccount(accountId);
  wx.setStorageSync(JOURNAL_KEY, journal);
  if (JSON.stringify(wx.getStorageSync(JOURNAL_KEY)) !== JSON.stringify(journal)) {
    throw new Error('legacy_journal_not_persisted');
  }
};

// A structured pending key is an existing identity mapping, not a fingerprint.
const idFromPendingKey = (key, record, accountId) => {
  try {
    const suffix = '__account__';
    const index = String(key).indexOf(suffix);
    if (index >= 0 && String(key).slice(index + suffix.length) !== accountId) return '';
    const parts = JSON.parse(index >= 0 ? String(key).slice(0, index) : key);
    const scope = scopeOf(record, accountId);
    if (!Array.isArray(parts) || parts.length !== 3 ||
        text(parts[0]) !== scope.studentId || text(parts[1]) !== scope.wordbookId) return '';
    return text(parts[2]);
  } catch (_) { return ''; }
};

const prepareLegacyRecord = (record, { accountId, pendingKey } = {}) => {
  // This gate must precede all journal/storage access.
  if (descriptorForLearningRecord(record)) return { record, ready: true, normal: true };
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { record, ready: false, reason: 'legacy_record_invalid' };
  }
  const scope = scopeOf(record, accountId);
  try {
    assertAccount(scope.accountId);
    const owner = text(record.accountId || record.teacher_id || record.teacherId || record.ownerId || record._openid);
    if (owner && owner !== scope.accountId) {
      return { record, ready: false, reason: 'legacy_foreign_owner' };
    }
    const students = wx.getStorageSync('students') || [];
    const studentOwners = (Array.isArray(students) ? students : []).filter(item =>
      text(item.id || item.student_id) === scope.studentId).map(item =>
      text(item.teacher_id || item.accountId || item.ownerId)).filter(Boolean);
    if ((!owner && !studentOwners.includes(scope.accountId)) ||
        studentOwners.some(value => value !== scope.accountId) || !scope.studentId || !scope.wordbookId) {
      return deferRecord(record, 'legacy_scope_unproven');
    }
    const journal = readJournal();
    let entry = record[REF_FIELD] && journal.entries.find(item => item.ref === record[REF_FIELD]);
    if (record[REF_FIELD] && (!entry || !sameScope(entry, scope))) {
      return deferRecord(record, 'legacy_reference_scope_mismatch');
    }
    const pendingId = pendingKey && idFromPendingKey(pendingKey, record, scope.accountId);
    if (!entry && pendingId) {
      entry = journal.entries.find(item => sameScope(item, scope) && item.evidence &&
        item.evidence.source === 'pending-key' && item.evidence.reference === String(pendingKey));
    }
    if (!entry) {
      let ref = newRef();
      while (journal.entries.some(item => item.ref === ref)) ref = newRef();
      entry = { ...scope, ref, original: clone(record), status: 'quarantined',
        reason: 'missing_reliable_event_identity',
        recovery: 'Requires an explicit old-ID mapping or verified independent-event receipt; never infer from content.' };
      journal.entries.push(entry);
      saveJournal(journal, scope.accountId);
      // This is a local journal reference, NOT a recordId. It is never uploaded.
      record[REF_FIELD] = ref;
    }
    if (!entry.recordId && pendingId) {
      entry.recordId = pendingId;
      entry.status = 'recovered';
      entry.reason = 'structured_pending_key';
      entry.evidence = { kind: 'old-id', source: 'pending-key', reference: String(pendingKey) };
      saveJournal(journal, scope.accountId);
    }
    if (entry.recordId) {
      const resolved = { ...record, id: entry.recordId };
      delete resolved[STATE_FIELD];
      return { record: resolved, ready: true, legacy: true };
    }
    return { ...deferRecord(record, 'legacy_identity_quarantined'), ref: entry.ref };
  } catch (error) {
    return deferRecord(record, 'legacy_identity_storage_unavailable', error);
  }
};

/**
 * Trusted local recovery/import boundary, not a page/cloud/debug endpoint.
 * Caller must supply a verified, explicit mapping to this journal ref. Never
 * call this from record contents, a matching word/date, or a cloud-not-found.
 * There is no automatic independent-event evidence producer in the old data.
 */
const bindLegacyIdentityEvidence = (ref, evidence) => {
  const accountId = text(evidence && evidence.accountId);
  assertAccount(accountId);
  const journal = readJournal();
  const entry = journal.entries.find(item => item.ref === ref);
  if (!entry || !sameScope(entry, {
    accountId, studentId: text(evidence.studentId), wordbookId: text(evidence.wordbookId)
  })) throw new Error('legacy_evidence_scope_mismatch');
  const localRecords = wx.getStorageSync('learningRecords') || [];
  const sources = (Array.isArray(localRecords) ? localRecords : []).filter(record => record[REF_FIELD] === ref);
  if (sources.length !== 1 || !sameScope(scopeOf(sources[0], accountId), entry)) {
    throw new Error('legacy_source_not_durably_bound');
  }
  const sourceOwner = text(sources[0].accountId || sources[0].teacher_id || sources[0].teacherId || sources[0].ownerId || sources[0]._openid);
  if (sourceOwner && sourceOwner !== accountId) throw new Error('legacy_evidence_scope_mismatch');
  if (!text(evidence.reference) || !['migration-map', 'cloud-document-link', 'independent-event-receipt'].includes(evidence.source)) {
    throw new Error('legacy_evidence_unproven');
  }
  const recovered = evidence.kind === 'old-id' && text(evidence.recordId);
  const independent = evidence.kind === 'independent-event' &&
    evidence.source === 'independent-event-receipt' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text(evidence.sourceEventId)) &&
    evidence.noPreviousIdentity === true;
  if (!recovered && !independent) throw new Error('legacy_evidence_unproven');
  const duplicate = journal.entries.find(item => item.ref !== ref && item.accountId === accountId &&
    item.evidence && item.evidence.source === evidence.source &&
    (item.evidence.reference === evidence.reference || (independent &&
      item.evidence.sourceEventId === evidence.sourceEventId)));
  if (duplicate) throw new Error('legacy_evidence_already_bound');
  if (entry.recordId) {
    if ((recovered && entry.recordId !== recovered) ||
        entry.evidence.source !== evidence.source || entry.evidence.reference !== evidence.reference ||
        (independent && entry.evidence.sourceEventId !== evidence.sourceEventId)) {
      throw new Error('legacy_identity_already_bound');
    }
    return entry.recordId;
  }
  // A verified receipt's immutable, globally unique event UUID, NOT record
  // contents or this device's random journal ref. The same proven event on a
  // second device therefore uses the same ID without a shared local journal.
  entry.recordId = recovered || `legacy_event_${evidence.sourceEventId}`;
  entry.status = recovered ? 'recovered' : 'synthetic';
  entry.reason = recovered ? 'verified_old_id_mapping' : 'verified_independent_event';
  entry.evidence = clone(evidence);
  // ID and its evidence are one durable write, before any caller can upload.
  saveJournal(journal, accountId);
  return entry.recordId;
};

// Iterate actual stored objects: the index/object association is explicit,
// never reconstructed by comparing record contents. Persist local refs before
// returning anything eligible for upload. Normal-only storage is not written.
const prepareStoredLegacyRecords = accountId => {
  const records = wx.getStorageSync('learningRecords') || [];
  if (!Array.isArray(records)) return [];
  if (!records.some(record => record && !descriptorForLearningRecord(record))) return records;
  const before = JSON.stringify(records);
  const prepared = records.map(record => {
    if (!record || descriptorForLearningRecord(record)) return record;
    const result = prepareLegacyRecord(record, { accountId });
    return result.ready ? result.record : record;
  });
  if (JSON.stringify(prepared) !== before) {
    try {
      assertAccount(text(accountId));
      wx.setStorageSync('learningRecords', prepared);
      if (JSON.stringify(wx.getStorageSync('learningRecords')) !== JSON.stringify(prepared)) {
        throw new Error('legacy_source_not_persisted');
      }
    } catch (error) {
      console.warn('[legacy-identity] local binding unavailable; legacy upload deferred:', error.message);
      return JSON.parse(before);
    }
  }
  return prepared;
};

const getLegacyIdentityStatus = accountId => {
  const entries = readJournal().entries.filter(item => item.accountId === text(accountId));
  const local = wx.getStorageSync('learningRecords') || [];
  const unbound = (Array.isArray(local) ? local : []).filter(record => record &&
    !descriptorForLearningRecord(record) && !entries.some(item => item.ref === record[REF_FIELD]) &&
    text(record.accountId || record.teacher_id || record.teacherId || record.ownerId || record._openid) === text(accountId));
  const unboundStatus = unbound.map(record => ({ ref: null, status: 'quarantined',
    reason: 'scope_or_local_identity_binding_unproven',
    recovery: 'Original remains local; establish scope and a durable evidence binding before upload.',
    studentId: scopeOf(record, accountId).studentId, wordbookId: scopeOf(record, accountId).wordbookId }));
  return { recovered: entries.filter(item => item.status === 'recovered').length,
    synthetic: entries.filter(item => item.status === 'synthetic').length,
    quarantined: entries.filter(item => item.status === 'quarantined').length + unbound.length,
    entries: entries.map(({ ref, status, reason, recovery, studentId, wordbookId }) =>
      ({ ref, status, reason, recovery, studentId, wordbookId })).concat(unboundStatus) };
};

module.exports = { JOURNAL_KEY, REF_FIELD, STATE_FIELD, DOC_FIELD, getLegacyCloudDocumentId,
  prepareLegacyRecord, prepareStoredLegacyRecords, bindLegacyIdentityEvidence, getLegacyIdentityStatus };
