'use strict';

/**
 * Cloud function: syncMasteryAtom
 *
 * Safely merges changed word-mastery records for the current WeChat caller.
 * Existing legacy scoped records without _openid are adopted only when their
 * stored identity matches the caller and the requested student/book/word.
 */
const cloud = require('wx-server-sdk');
const {
  mergeWordMasteryRecord,
  resolveUpdatedAt
} = require('./sync-merge');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MAX_BATCH_SIZE = 20;
const PROTECTED_FIELDS = new Set([
  '_id',
  '_openid',
  'teacher_id',
  'teacherId',
  'student_id',
  'studentId',
  'wordbook_id',
  'wordbookId',
  'word_id',
  'wordId',
  '__proto__',
  'constructor',
  'prototype'
]);

const normalizeIdentifier = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

const buildScopedDocId = (openid, ...parts) => {
  const safe = (value) => normalizeIdentifier(value)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  return [safe(openid), ...parts.map(safe)].filter(Boolean).join('__').slice(0, 500);
};

const isNotFoundError = (error) => {
  if (!error) return false;
  if (error.errCode === -1) return true;
  const message = String(error.errMsg || error.message || '');
  return /not\s*found|not\s*exist|does\s*not\s*exist/i.test(message);
};

const makeSyncError = (code, message) => {
  const error = new Error(message || code);
  error.code = code;
  return error;
};

const getRecordIdentifiers = (record) => ({
  studentId: normalizeIdentifier(record && (record.studentId || record.student_id)),
  wordbookId: normalizeIdentifier(record && (record.wordbookId || record.wordbook_id)),
  wordId: normalizeIdentifier(record && (record.wordId || record.word_id))
});

const stripProtectedFields = (record) => {
  const clean = {};
  Object.keys(record || {}).forEach((key) => {
    if (!PROTECTED_FIELDS.has(key)) {
      clean[key] = record[key];
    }
  });
  return clean;
};

const assertExistingIdentity = (
  existing,
  callerOpenid,
  studentId,
  wordbookId,
  wordId
) => {
  if (!existing) return;

  const existingOpenid = normalizeIdentifier(existing._openid);
  const existingTeacherId = normalizeIdentifier(existing.teacher_id || existing.teacherId);
  if (
    (existingOpenid && existingOpenid !== callerOpenid)
    || (existingTeacherId && existingTeacherId !== callerOpenid)
  ) {
    throw makeSyncError('ownership_mismatch');
  }

  const existingStudentId = normalizeIdentifier(existing.student_id || existing.studentId);
  const existingWordbookId = normalizeIdentifier(existing.wordbook_id || existing.wordbookId);
  const existingWordId = normalizeIdentifier(existing.word_id || existing.wordId);
  if (
    (existingStudentId && existingStudentId !== studentId)
    || (existingWordbookId && existingWordbookId !== wordbookId)
    || (existingWordId && existingWordId !== wordId)
  ) {
    throw makeSyncError('identity_mismatch');
  }
};

const readExisting = async (transaction, docId) => {
  try {
    const result = await transaction.collection('word_mastery').doc(docId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

const syncOneRecord = async (record, callerOpenid) => {
  const { studentId, wordbookId, wordId } = getRecordIdentifiers(record);
  if (!studentId || !wordbookId || !wordId) {
    return {
      wordId: wordId || 'unknown',
      ok: false,
      error: 'missing_identifiers'
    };
  }

  const docId = buildScopedDocId(
    callerOpenid,
    'mastery',
    studentId,
    wordbookId,
    wordId
  );
  const incomingData = stripProtectedFields(record);

  try {
    const transactionResult = await db.runTransaction(async (transaction) => {
      const existing = await readExisting(transaction, docId);
      assertExistingIdentity(
        existing,
        callerOpenid,
        studentId,
        wordbookId,
        wordId
      );

      const merged = mergeWordMasteryRecord(existing || {}, incomingData);
      const {
        _id: ignoredId,
        _openid: ignoredOpenid,
        ...safeMerged
      } = merged;
      const mergedUpdatedAt = resolveUpdatedAt(safeMerged);
      const incomingUpdatedAt = resolveUpdatedAt(incomingData);
      const updatedAt = Math.max(mergedUpdatedAt, incomingUpdatedAt) || Date.now();
      const writeData = {
        ...safeMerged,
        _openid: callerOpenid,
        teacher_id: callerOpenid,
        student_id: studentId,
        wordbook_id: wordbookId,
        word_id: wordId,
        updatedAt
      };

      await transaction.collection('word_mastery').doc(docId).set({
        data: writeData
      });

      return {
        wordId,
        ok: true,
        adoptedLegacyOwnership: !!existing && !normalizeIdentifier(existing._openid)
      };
    });

    return (
      transactionResult
      && transactionResult.result
      && typeof transactionResult.result === 'object'
    )
      ? transactionResult.result
      : {
        wordId,
        ok: true
      };
  } catch (error) {
    console.error('[syncMasteryAtom] record sync failed:', wordId, error);
    return {
      wordId,
      ok: false,
      error: error && (error.code || error.message)
        ? (error.code || error.message)
        : 'unknown'
    };
  }
};

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = normalizeIdentifier(wxContext && wxContext.OPENID);
  const records = event && event.records;

  if (!callerOpenid) {
    return { success: false, error: 'missing_caller_openid' };
  }
  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: 'empty_records' };
  }
  if (records.length > MAX_BATCH_SIZE) {
    return {
      success: false,
      error: 'batch_too_large',
      maxBatchSize: MAX_BATCH_SIZE
    };
  }

  const results = [];
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      results.push({
        wordId: 'unknown',
        ok: false,
        error: 'invalid_record'
      });
      continue;
    }
    results.push(await syncOneRecord(record, callerOpenid));
  }

  const failed = results.filter((result) => !result.ok).length;
  return {
    success: failed === 0,
    total: results.length,
    succeeded: results.length - failed,
    failed,
    results
  };
};

exports._test = {
  MAX_BATCH_SIZE,
  assertExistingIdentity,
  buildScopedDocId,
  getRecordIdentifiers,
  stripProtectedFields
};
