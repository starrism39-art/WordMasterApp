'use strict';

const COLLECTIONS = Object.freeze({
  TEACHER_WORDBOOKS: 'teacher_wordbooks',
  TEACHER_WORDBOOK_VERSIONS: 'teacher_wordbook_versions'
});

const TEACHER_WORDBOOK_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  DISABLED: 'disabled'
});

const TEACHER_WORDBOOK_VERSION_STATUS = Object.freeze({
  PUBLISHED: 'published'
});

const UPLOAD_STATUS = Object.freeze({
  CREATED: 'created',
  UPLOADED: 'uploaded',
  PARSING: 'parsing',
  PREVIEW_READY: 'preview_ready',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed'
});

const UPLOAD_OPERATION_TYPE = Object.freeze({
  INITIAL_PUBLISH: 'initial_publish',
  VERSION_UPDATE: 'version_update'
});

const SOURCE_TYPE = 'teacher_custom';
const SCHEMA_VERSION = 1;

const ERROR_CODES = Object.freeze({
  UNAUTHORIZED: 'UNAUTHORIZED',
  TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
});

const FEATURES = Object.freeze([
  'teacher_wordbook_foundation',
  'teacher_wordbook_create_draft',
  'teacher_wordbook_upload_preview_publish',
  'teacher_wordbook_learning_read',
  'teacher_wordbook_version_update',
  'teacher_wordbook_disable'
]);

module.exports = {
  COLLECTIONS,
  TEACHER_WORDBOOK_STATUS,
  TEACHER_WORDBOOK_VERSION_STATUS,
  UPLOAD_STATUS,
  UPLOAD_OPERATION_TYPE,
  SOURCE_TYPE,
  SCHEMA_VERSION,
  ERROR_CODES,
  FEATURES
};
