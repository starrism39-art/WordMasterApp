'use strict';

const ACTION_UNAVAILABLE = 'ACTION_UNAVAILABLE';
const ALLOWED_TARGETS = Object.freeze([
  'announcement_detail',
  'wordbook_management',
  'membership'
]);

const TARGET_PARAM_KEYS = Object.freeze({
  announcement_detail: new Set(['announcementId', 'source']),
  wordbook_management: new Set(['wordbookId', 'mode', 'source']),
  membership: new Set(['plan', 'source'])
});

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isSafeValue = (value) => (
  typeof value === 'string'
  || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value))
);

class AnnouncementActionError extends Error {
  constructor(message = ACTION_UNAVAILABLE) {
    super(message);
    this.name = 'AnnouncementActionError';
    this.code = ACTION_UNAVAILABLE;
  }
}

const sanitizeParams = (target, params) => {
  if (!isPlainObject(params)) throw new AnnouncementActionError();
  const allowedKeys = TARGET_PARAM_KEYS[target];
  const entries = Object.entries(params);
  if (!allowedKeys || entries.length > 10) throw new AnnouncementActionError();

  return entries.reduce((result, [key, value]) => {
    if (
      !allowedKeys.has(key)
      || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)
      || !isSafeValue(value)
      || (typeof value === 'string' && value.length > 200)
    ) {
      throw new AnnouncementActionError();
    }
    result[key] = value;
    return result;
  }, {});
};

const resolveAnnouncementAction = (action) => {
  if (
    !isPlainObject(action)
    || action.type !== 'navigate'
    || !ALLOWED_TARGETS.includes(action.target)
    || Object.keys(action).some((key) => !['type', 'target', 'params'].includes(key))
  ) {
    throw new AnnouncementActionError();
  }

  const params = sanitizeParams(action.target, action.params);
  if (action.target === 'announcement_detail') {
    return {
      available: true,
      target: action.target,
      internalAction: 'openAnnouncementDetail',
      route: null,
      params,
      fallbackToDetail: false
    };
  }

  if (action.target === 'wordbook_management') {
    return {
      available: true,
      target: action.target,
      internalAction: 'openWordbookManagement',
      route: '/subpages/wordbook/wordbook',
      params,
      fallbackToDetail: false
    };
  }

  return {
    available: false,
    target: action.target,
    internalAction: null,
    route: null,
    params,
    code: ACTION_UNAVAILABLE,
    fallbackToDetail: true
  };
};

module.exports = {
  ACTION_UNAVAILABLE,
  ALLOWED_TARGETS,
  AnnouncementActionError,
  sanitizeParams,
  resolveAnnouncementAction
};
