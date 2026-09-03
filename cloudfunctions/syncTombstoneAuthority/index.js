'use strict';

const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const command = db.command;

const COLLECTION_NAME = 'sync_tombstones';
const SCHEMA_VERSION = 1;
const PAGE_SIZE = 100;
const MAX_ENTITY_LOOKUPS = 100;
const ENTITY_TYPES = Object.freeze({
  LEARNING_RECORD: 'learning_record',
  STUDENT: 'student'
});
const VALID_ENTITY_TYPES = new Set(Object.values(ENTITY_TYPES));

const normalizeIdentifier = (value) => String(
  value === undefined || value === null ? '' : value
).trim();

const normalizeEntityType = (value) => {
  const entityType = normalizeIdentifier(value);
  return VALID_ENTITY_TYPES.has(entityType) ? entityType : '';
};

const normalizeEntityDescriptor = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const entityType = normalizeEntityType(source.entityType || source.type);
  const entityId = normalizeIdentifier(source.entityId || source.id);
  if (!entityType || !entityId) return null;
  const descriptor = { entityType, entityId };
  const studentId = normalizeIdentifier(source.studentId || source.student_id);
  const wordbookId = normalizeIdentifier(source.wordbookId || source.wordbook_id);
  if (studentId) descriptor.studentId = studentId;
  if (wordbookId) descriptor.wordbookId = wordbookId;
  return descriptor;
};

const buildTombstoneDocId = (openid, entityType, entityId) => {
  const payload = [
    normalizeIdentifier(openid),
    normalizeEntityType(entityType),
    normalizeIdentifier(entityId)
  ].join('\u0000');
  return 'tmb_' + crypto.createHash('sha256').update(payload).digest('hex');
};

const isNotFoundError = (error) => {
  if (!error) return false;
  if (error.errCode === -1) return true;
  return /not\s*found|not\s*exist|does\s*not\s*exist/i.test(
    String(error.errMsg || error.message || '')
  );
};

const readDocumentIfPresent = async (collectionName, docId) => {
  try {
    const result = await db.collection(collectionName).doc(docId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
};

const assertOwnedByCaller = (document, callerOpenid) => {
  if (!document) return false;
  const owner = normalizeIdentifier(
    document.teacher_id || document.teacherId || document._openid
  );
  if (!owner || owner !== callerOpenid) {
    const error = new Error('entity ownership mismatch');
    error.code = 'ownership_mismatch';
    throw error;
  }
  return true;
};

const createOrRefreshTombstone = async (descriptor, callerOpenid) => {
  const docId = buildTombstoneDocId(
    callerOpenid,
    descriptor.entityType,
    descriptor.entityId
  );
  const existing = await readDocumentIfPresent(COLLECTION_NAME, docId);
  if (existing) assertOwnedByCaller(existing, callerOpenid);

  const deletedAt = existing && existing.deletedAt
    ? existing.deletedAt
    : db.serverDate();
  await db.collection(COLLECTION_NAME).doc(docId).set({
    data: {
      entityType: descriptor.entityType,
      entityId: descriptor.entityId,
      ...(descriptor.studentId ? { studentId: descriptor.studentId } : {}),
      ...(descriptor.wordbookId ? { wordbookId: descriptor.wordbookId } : {}),
      teacher_id: callerOpenid,
      deletedAt,
      updatedAt: db.serverDate(),
      schemaVersion: SCHEMA_VERSION,
      source: 'Stage1C tombstone'
    }
  });
  return { docId, existed: !!existing };
};

const removeOwnedByQuery = async (collectionName, condition) => {
  const result = await db.collection(collectionName).where(condition).remove();
  return Number(result && result.stats && result.stats.removed) || 0;
};

const removeOwnedDocById = async (collectionName, docId, callerOpenid) => {
  if (!docId) return 0;
  const existing = await readDocumentIfPresent(collectionName, docId);
  if (!existing) return 0;
  assertOwnedByCaller(existing, callerOpenid);
  const result = await db.collection(collectionName).doc(docId).remove();
  return Number(result && result.stats && result.stats.removed) || 0;
};

const buildLearningRecordCleanupConditions = (descriptor, callerOpenid) => {
  const entityId = normalizeIdentifier(descriptor && descriptor.entityId);
  if (!entityId || !callerOpenid) return [];
  const conditions = [];
  ['id', 'recordId', 'record_id'].forEach((identityField) => {
    conditions.push({ teacher_id: callerOpenid, [identityField]: entityId });
    conditions.push({ _openid: callerOpenid, [identityField]: entityId });
  });
  return conditions;
};

const cleanupLearningRecord = async (descriptor, callerOpenid) => {
  let removed = 0;
  const conditions = buildLearningRecordCleanupConditions(descriptor, callerOpenid);
  for (const condition of conditions) {
    removed += await removeOwnedByQuery('learning_records', condition);
  }
  return removed;
};

const cleanupStudent = async (descriptor, callerOpenid) => {
  let removed = 0;
  removed += await removeOwnedByQuery('students', {
    teacher_id: callerOpenid,
    student_id: descriptor.entityId
  });
  removed += await removeOwnedByQuery('students', {
    _openid: callerOpenid,
    student_id: descriptor.entityId
  });
  if (removed === 0) {
    removed += await removeOwnedDocById('students', descriptor.entityId, callerOpenid);
  }
  return removed;
};

const cleanupRawEntity = async (descriptor, callerOpenid) => {
  if (descriptor.entityType === ENTITY_TYPES.LEARNING_RECORD) {
    return cleanupLearningRecord(descriptor, callerOpenid);
  }
  if (descriptor.entityType === ENTITY_TYPES.STUDENT) {
    return cleanupStudent(descriptor, callerOpenid);
  }
  throw new Error('unsupported entity type');
};

const serializeTombstone = (document) => ({
  entityType: document.entityType,
  entityId: document.entityId,
  ...(document.studentId ? { studentId: document.studentId } : {}),
  ...(document.wordbookId ? { wordbookId: document.wordbookId } : {}),
  deletedAt: document.deletedAt,
  schemaVersion: Number(document.schemaVersion) || SCHEMA_VERSION
});

const readAllCallerTombstones = async (callerOpenid) => {
  const items = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await db.collection(COLLECTION_NAME)
      .where({ teacher_id: callerOpenid })
      .orderBy('_id', 'asc')
      .skip(offset)
      .limit(PAGE_SIZE)
      .get();
    const page = result && Array.isArray(result.data) ? result.data : [];
    items.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return items;
};

const readSelectedCallerTombstones = async (callerOpenid, descriptors) => {
  const docIds = Array.from(new Set(descriptors.map((descriptor) => (
    buildTombstoneDocId(callerOpenid, descriptor.entityType, descriptor.entityId)
  ))));
  const items = [];
  for (let offset = 0; offset < docIds.length; offset += 20) {
    const ids = docIds.slice(offset, offset + 20);
    const result = await db.collection(COLLECTION_NAME).where({
      _id: command.in(ids),
      teacher_id: callerOpenid
    }).get();
    if (result && Array.isArray(result.data)) items.push(...result.data);
  }
  return items;
};

const listTombstones = async (event, callerOpenid) => {
  const requested = Array.isArray(event && event.entities)
    ? event.entities.map(normalizeEntityDescriptor).filter(Boolean)
    : null;
  if (requested && requested.length > MAX_ENTITY_LOOKUPS) {
    return { success: false, error: 'too_many_entities', max: MAX_ENTITY_LOOKUPS };
  }
  const documents = requested
    ? await readSelectedCallerTombstones(callerOpenid, requested)
    : await readAllCallerTombstones(callerOpenid);
  return {
    success: true,
    schemaVersion: SCHEMA_VERSION,
    tombstones: documents.map(serializeTombstone)
  };
};

const deleteEntity = async (event, callerOpenid) => {
  const descriptor = normalizeEntityDescriptor(event);
  if (!descriptor) return { success: false, error: 'invalid_entity' };

  let tombstone;
  try {
    tombstone = await createOrRefreshTombstone(descriptor, callerOpenid);
  } catch (error) {
    console.error('[syncTombstoneAuthority] tombstone write failed:', error);
    return {
      success: false,
      error: error && (error.code || error.message)
        ? (error.code || error.message)
        : 'tombstone_write_failed',
      phase: 'tombstone'
    };
  }

  let removed = 0;
  let cleanupPending = false;
  let cleanupError = '';
  try {
    removed = await cleanupRawEntity(descriptor, callerOpenid);
  } catch (error) {
    cleanupPending = true;
    cleanupError = error && (error.code || error.message)
      ? String(error.code || error.message)
      : 'raw_cleanup_failed';
    console.warn('[syncTombstoneAuthority] raw cleanup deferred:', cleanupError);
  }

  return {
    success: true,
    tombstoneCreated: true,
    tombstoneExisted: tombstone.existed,
    entityType: descriptor.entityType,
    entityId: descriptor.entityId,
    removed,
    cleanupPending,
    ...(cleanupError ? { cleanupError } : {})
  };
};

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = normalizeIdentifier(wxContext && wxContext.OPENID);
  if (!callerOpenid) return { success: false, error: 'missing_caller_openid' };

  if (event && event.action === 'list') {
    return listTombstones(event, callerOpenid);
  }
  if (event && event.action === 'deleteEntity') {
    return deleteEntity(event, callerOpenid);
  }
  if (event && event.action === 'capabilities') {
    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      entityTypes: Array.from(VALID_ENTITY_TYPES),
      maxEntityLookups: MAX_ENTITY_LOOKUPS
    };
  }
  return { success: false, error: 'unsupported_action' };
};

exports._test = {
  ENTITY_TYPES,
  buildTombstoneDocId,
  buildLearningRecordCleanupConditions,
  normalizeEntityDescriptor,
  normalizeIdentifier
};
