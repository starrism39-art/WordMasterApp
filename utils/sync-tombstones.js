'use strict';

const TOMBSTONE_FUNCTION_NAME = 'syncTombstoneAuthority';
const TOMBSTONE_SCHEMA_VERSION = 1;
const MAX_LOOKUP_BATCH_SIZE = 100;
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

const buildTombstoneKey = (entityType, entityId) => {
  const normalizedType = normalizeEntityType(entityType);
  const normalizedId = normalizeIdentifier(entityId);
  return normalizedType && normalizedId
    ? normalizedType + '::' + normalizedId
    : '';
};

const normalizeEntityDescriptor = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const entityType = normalizeEntityType(source.entityType || source.type);
  const entityId = normalizeIdentifier(
    source.entityId || source.id || (
      entityType === ENTITY_TYPES.STUDENT
        ? source.studentId || source.student_id
        : source.recordId || source.record_id
    )
  );
  if (!entityType || !entityId) return null;

  const descriptor = { entityType, entityId };
  const studentId = normalizeIdentifier(source.studentId || source.student_id);
  const wordbookId = normalizeIdentifier(source.wordbookId || source.wordbook_id);
  if (studentId) descriptor.studentId = studentId;
  if (wordbookId) descriptor.wordbookId = wordbookId;
  return descriptor;
};

const descriptorForLearningRecord = (record) => normalizeEntityDescriptor({
  entityType: ENTITY_TYPES.LEARNING_RECORD,
  entityId: record && (record.id || record.recordId || record.record_id || record._id),
  studentId: record && (record.studentId || record.student_id || record.userId),
  wordbookId: record && (record.wordbookId || record.wordbook_id)
});

const descriptorForStudent = (student) => normalizeEntityDescriptor({
  entityType: ENTITY_TYPES.STUDENT,
  entityId: student && (student.id || student.studentId || student.student_id || student._id),
  studentId: student && (student.id || student.studentId || student.student_id || student._id)
});

const normalizeTombstone = (value) => {
  const descriptor = normalizeEntityDescriptor(value);
  if (!descriptor) return null;
  return {
    ...descriptor,
    deletedAt: value && value.deletedAt,
    schemaVersion: Number(value && value.schemaVersion) || TOMBSTONE_SCHEMA_VERSION
  };
};

const createTombstoneMap = (values) => {
  const result = new Map();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const tombstone = normalizeTombstone(value);
    if (!tombstone) return;
    result.set(buildTombstoneKey(tombstone.entityType, tombstone.entityId), tombstone);
  });
  return result;
};

const mergeTombstoneMaps = (target, source) => {
  const output = target instanceof Map ? target : new Map();
  if (source instanceof Map) {
    source.forEach((value, key) => output.set(key, value));
  }
  return output;
};

const hasTombstone = (tombstoneMap, entityType, entityId) => (
  tombstoneMap instanceof Map && tombstoneMap.has(buildTombstoneKey(entityType, entityId))
);

const getCloudFunctionCaller = (options = {}) => {
  if (typeof options.callFunction === 'function') return options.callFunction;
  if (
    typeof wx !== 'undefined' &&
    wx.cloud &&
    typeof wx.cloud.callFunction === 'function'
  ) {
    return wx.cloud.callFunction.bind(wx.cloud);
  }
  return null;
};

const callTombstoneAuthority = async (data, options = {}) => {
  const callFunction = getCloudFunctionCaller(options);
  if (!callFunction) {
    const unavailable = new Error('tombstone authority unavailable');
    unavailable.code = 'tombstone_authority_unavailable';
    throw unavailable;
  }

  const response = await callFunction({
    name: TOMBSTONE_FUNCTION_NAME,
    data,
    config: options.envId ? { env: options.envId } : undefined
  });
  const result = response && response.result;
  if (!result || result.success !== true) {
    const error = new Error(
      result && (result.error || result.message)
        ? (result.error || result.message)
        : 'tombstone authority request failed'
    );
    error.code = result && result.error ? result.error : 'tombstone_authority_failed';
    error.result = result || null;
    throw error;
  }
  return result;
};

const uniqueDescriptors = (values) => {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const descriptor = normalizeEntityDescriptor(value);
    if (!descriptor) return;
    const key = buildTombstoneKey(descriptor.entityType, descriptor.entityId);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(descriptor);
  });
  return result;
};

const loadTombstoneMap = async (entities, options = {}) => {
  const loadAll = entities === undefined || entities === null;
  const descriptors = loadAll ? null : uniqueDescriptors(entities);
  if (!loadAll && descriptors.length === 0) return new Map();

  const batches = loadAll
    ? [null]
    : Array.from(
      { length: Math.ceil(descriptors.length / MAX_LOOKUP_BATCH_SIZE) },
      (_, index) => descriptors.slice(
        index * MAX_LOOKUP_BATCH_SIZE,
        (index + 1) * MAX_LOOKUP_BATCH_SIZE
      )
    );
  const tombstoneMap = new Map();
  for (const batch of batches) {
    const result = await callTombstoneAuthority({
      action: 'list',
      ...(batch ? { entities: batch } : {})
    }, options);
    mergeTombstoneMaps(tombstoneMap, createTombstoneMap(result.tombstones));
  }
  return tombstoneMap;
};

const isEntityTombstoned = async (entity, options = {}) => {
  const descriptor = normalizeEntityDescriptor(entity);
  if (!descriptor) return false;
  const tombstoneMap = await loadTombstoneMap([descriptor], options);
  return hasTombstone(tombstoneMap, descriptor.entityType, descriptor.entityId);
};

const deleteEntityWithTombstone = async (entity, options = {}) => {
  const descriptor = normalizeEntityDescriptor(entity);
  if (!descriptor) {
    const invalid = new Error('invalid tombstone entity descriptor');
    invalid.code = 'invalid_entity';
    throw invalid;
  }
  const result = await callTombstoneAuthority({
    action: 'deleteEntity',
    ...descriptor
  }, options);
  if (result.tombstoneCreated !== true) {
    const missing = new Error('tombstone was not confirmed');
    missing.code = 'tombstone_not_confirmed';
    missing.result = result;
    throw missing;
  }
  return result;
};

module.exports = {
  ENTITY_TYPES,
  MAX_LOOKUP_BATCH_SIZE,
  TOMBSTONE_FUNCTION_NAME,
  TOMBSTONE_SCHEMA_VERSION,
  buildTombstoneKey,
  createTombstoneMap,
  deleteEntityWithTombstone,
  descriptorForLearningRecord,
  descriptorForStudent,
  hasTombstone,
  isEntityTombstoned,
  loadTombstoneMap,
  normalizeEntityDescriptor,
  normalizeIdentifier
};
