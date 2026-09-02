'use strict';

const COLLECTIONS = Object.freeze({
  ANNOUNCEMENTS: 'announcements',
  ANNOUNCEMENT_READS: 'announcement_reads',
  TEACHERS: 'teachers'
});

const ACTIONS = Object.freeze({
  BOOTSTRAP: 'bootstrap',
  LIST_HISTORY: 'listHistory',
  GET_DETAIL: 'getDetail',
  CLAIM_MAJOR_POPUP: 'claimMajorPopup',
  MARK_READ: 'markRead',
  ACKNOWLEDGE_POPUP: 'acknowledgePopup'
});

const ERROR_CODES = Object.freeze({
  UNAUTHORIZED: 'UNAUTHORIZED',
  TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  NOT_FOUND: 'NOT_FOUND',
  POPUP_NOT_CLAIMED: 'POPUP_NOT_CLAIMED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
});

const ALLOWED_ACTION_TARGETS = Object.freeze([
  'announcement_detail',
  'wordbook_management',
  'membership'
]);

const ENV_VERSIONS = Object.freeze(['develop', 'trial', 'release']);

module.exports = {
  COLLECTIONS,
  ACTIONS,
  ERROR_CODES,
  ALLOWED_ACTION_TARGETS,
  ENV_VERSIONS
};
