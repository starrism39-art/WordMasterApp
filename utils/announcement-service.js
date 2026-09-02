'use strict';

const { captureAccountSession } = require('./account-session');
const {
  getRuntimeContext,
  INVALID_RUNTIME_VERSION
} = require('./announcement-version');
const {
  ACTION_UNAVAILABLE,
  resolveAnnouncementAction
} = require('./announcement-action-registry');

const CACHE_PREFIX = 'announcement_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_PAGE_SIZE = 20;

const ERROR_CODES = Object.freeze({
  ANNOUNCEMENT_UNAVAILABLE: 'ANNOUNCEMENT_UNAVAILABLE',
  INVALID_RUNTIME_VERSION,
  ANNOUNCEMENT_NOT_FOUND: 'ANNOUNCEMENT_NOT_FOUND',
  ACTION_UNAVAILABLE,
  CLOUD_FUNCTION_FAILED: 'CLOUD_FUNCTION_FAILED'
});

const normalizeText = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

const isPlainObject = (value) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
);

class AnnouncementError extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = 'AnnouncementError';
    this.code = code;
    if (options.serverCode) this.serverCode = options.serverCode;
    if (options.cause) this.cause = options.cause;
  }
}

const hashSessionScope = (value) => {
  const text = normalizeText(value) || 'anonymous';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const safeKeyPart = (value, fallback) => {
  const text = normalizeText(value) || fallback;
  return encodeURIComponent(text);
};

const buildCacheKey = (runtimeContext, sessionSnapshot = {}) => (
  `${CACHE_PREFIX}${safeKeyPart(runtimeContext.appId, 'unknown')}`
  + `_${safeKeyPart(runtimeContext.envVersion, 'develop')}`
  + `_${safeKeyPart(runtimeContext.version, 'none')}`
  + `_${hashSessionScope(sessionSnapshot.accountId)}`
);

const normalizeReadState = (value) => (isPlainObject(value) ? value : null);

const normalizeBootstrapPayload = (value = {}) => ({
  latestAnnouncement: isPlainObject(value.latestAnnouncement) ? value.latestAnnouncement : null,
  latestReadState: normalizeReadState(value.latestReadState),
  latestIsNew: value.latestIsNew === true,
  majorPopupCandidate: isPlainObject(value.majorPopupCandidate)
    ? value.majorPopupCandidate
    : (isPlainObject(value.majorCandidate) ? value.majorCandidate : null),
  majorReadState: normalizeReadState(value.majorReadState),
  canShowMajorPopup: false
});

const toPublicBootstrap = (payload, runtimeContext, metadata = {}) => ({
  ...normalizeBootstrapPayload(payload),
  runtimeContext,
  source: metadata.source || 'network',
  degraded: Boolean(metadata.degraded),
  backgroundRefreshStarted: Boolean(metadata.backgroundRefreshStarted)
});

const createEmptyBootstrap = (runtimeContext) => toPublicBootstrap({}, runtimeContext, {
  source: 'empty',
  degraded: true
});

const mapServerError = (serverCode) => (
  serverCode === 'NOT_FOUND'
    ? ERROR_CODES.ANNOUNCEMENT_NOT_FOUND
    : ERROR_CODES.ANNOUNCEMENT_UNAVAILABLE
);

const createAnnouncementService = (options = {}) => {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const getContext = typeof options.getRuntimeContext === 'function'
    ? options.getRuntimeContext
    : getRuntimeContext;
  const getSession = typeof options.getSessionSnapshot === 'function'
    ? options.getSessionSnapshot
    : () => captureAccountSession();
  const invokeCloud = typeof options.callFunction === 'function'
    ? options.callFunction
    : (request) => {
      if (
        typeof wx === 'undefined'
        || !wx.cloud
        || typeof wx.cloud.callFunction !== 'function'
      ) {
        return Promise.reject(new AnnouncementError(ERROR_CODES.ANNOUNCEMENT_UNAVAILABLE));
      }
      return wx.cloud.callFunction(request);
    };
  const getStorage = typeof options.getStorageSync === 'function'
    ? options.getStorageSync
    : (key) => {
      if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null;
      return wx.getStorageSync(key);
    };
  const setStorage = typeof options.setStorageSync === 'function'
    ? options.setStorageSync
    : (key, value) => {
      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync(key, value);
      }
    };

  const flights = new Map();

  const nowMs = () => {
    const value = now();
    if (value instanceof Date) return value.getTime();
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Date.now();
  };

  const getCurrentScope = () => ({
    runtimeContext: getContext(),
    sessionSnapshot: getSession()
  });

  const readCacheRecord = (runtimeContext, sessionSnapshot) => {
    try {
      const value = getStorage(buildCacheKey(runtimeContext, sessionSnapshot));
      if (!isPlainObject(value) || !Number.isFinite(Number(value.cachedAt))) return null;
      return {
        cachedAt: Number(value.cachedAt),
        payload: normalizeBootstrapPayload(value.payload)
      };
    } catch (error) {
      return null;
    }
  };

  const writeCacheRecord = (runtimeContext, sessionSnapshot, payload, cachedAt = nowMs()) => {
    const record = {
      cachedAt,
      payload: normalizeBootstrapPayload(payload)
    };
    try {
      setStorage(buildCacheKey(runtimeContext, sessionSnapshot), record);
    } catch (error) {
      return false;
    }
    return true;
  };

  const runtimeData = (runtimeContext) => ({
    envVersion: runtimeContext.envVersion,
    version: runtimeContext.version
  });

  const callAnnouncement = async (action, data, runtimeContext) => {
    let response;
    try {
      response = await invokeCloud({
        name: 'announcement',
        data: {
          action,
          ...runtimeData(runtimeContext),
          ...data
        }
      });
    } catch (error) {
      if (error instanceof AnnouncementError) throw error;
      throw new AnnouncementError(ERROR_CODES.CLOUD_FUNCTION_FAILED, { cause: error });
    }

    const result = response && response.result ? response.result : response;
    if (!result || result.success !== true || !isPlainObject(result.data)) {
      const serverCode = result && normalizeText(result.error);
      throw new AnnouncementError(mapServerError(serverCode), { serverCode });
    }
    return result.data;
  };

  const flightKey = (runtimeContext, sessionSnapshot) => (
    `${buildCacheKey(runtimeContext, sessionSnapshot)}_${Number(sessionSnapshot.generation) || 0}`
  );

  const refreshAnnouncements = (scope = {}) => {
    const currentScope = scope.runtimeContext && scope.sessionSnapshot
      ? scope
      : getCurrentScope();
    const { runtimeContext, sessionSnapshot } = currentScope;
    const key = flightKey(runtimeContext, sessionSnapshot);
    if (flights.has(key)) return flights.get(key);

    const flight = (async () => {
      const data = await callAnnouncement('bootstrap', {}, runtimeContext);
      const payload = normalizeBootstrapPayload(data);
      writeCacheRecord(runtimeContext, sessionSnapshot, payload);
      return toPublicBootstrap(payload, runtimeContext, { source: 'network' });
    })();

    flights.set(key, flight);
    flight.then(
      () => { if (flights.get(key) === flight) flights.delete(key); },
      () => { if (flights.get(key) === flight) flights.delete(key); }
    );
    return flight;
  };

  const bootstrapAnnouncements = async ({ forceRefresh = false } = {}) => {
    const scope = getCurrentScope();
    const cache = readCacheRecord(scope.runtimeContext, scope.sessionSnapshot);
    const cacheAge = cache ? nowMs() - cache.cachedAt : Infinity;

    if (!forceRefresh && cache && cacheAge >= 0 && cacheAge < CACHE_TTL_MS) {
      refreshAnnouncements(scope).catch(() => {});
      return toPublicBootstrap(cache.payload, scope.runtimeContext, {
        source: 'cache',
        backgroundRefreshStarted: true
      });
    }

    try {
      return await refreshAnnouncements(scope);
    } catch (error) {
      if (cache) {
        return toPublicBootstrap(cache.payload, scope.runtimeContext, {
          source: 'stale-cache',
          degraded: true
        });
      }
      return createEmptyBootstrap(scope.runtimeContext);
    }
  };

  const updateCachedReadState = (announcementId, readState, scope) => {
    const record = readCacheRecord(scope.runtimeContext, scope.sessionSnapshot);
    if (!record) return;

    const payload = { ...record.payload };
    if (
      payload.latestAnnouncement
      && payload.latestAnnouncement._id === announcementId
    ) {
      const normalizedReadState = normalizeReadState(readState);
      payload.latestReadState = normalizedReadState;
      payload.latestIsNew = Boolean(!normalizedReadState || !normalizedReadState.readAt);
    }
    if (
      payload.majorPopupCandidate
      && payload.majorPopupCandidate._id === announcementId
    ) {
      payload.majorReadState = normalizeReadState(readState);
    }
    writeCacheRecord(
      scope.runtimeContext,
      scope.sessionSnapshot,
      payload,
      record.cachedAt
    );
  };

  const requireAnnouncementId = (announcementId) => {
    const normalized = normalizeText(announcementId);
    if (!normalized) throw new AnnouncementError(ERROR_CODES.ANNOUNCEMENT_NOT_FOUND);
    return normalized;
  };

  const claimMajorPopup = async (announcementId) => {
    const normalizedId = requireAnnouncementId(announcementId);
    const scope = getCurrentScope();
    const data = await callAnnouncement(
      'claimMajorPopup',
      { announcementId: normalizedId },
      scope.runtimeContext
    );
    updateCachedReadState(normalizedId, data.readState, scope);
    const claimed = data.claimed === true;
    return {
      claimed,
      canShow: claimed,
      readState: normalizeReadState(data.readState)
    };
  };

  const markRead = async (announcementId) => {
    const normalizedId = requireAnnouncementId(announcementId);
    const scope = getCurrentScope();
    const data = await callAnnouncement(
      'markRead',
      { announcementId: normalizedId },
      scope.runtimeContext
    );
    updateCachedReadState(normalizedId, data.readState, scope);
    return { readState: normalizeReadState(data.readState) };
  };

  const acknowledgePopup = async (announcementId) => {
    const normalizedId = requireAnnouncementId(announcementId);
    const scope = getCurrentScope();
    const data = await callAnnouncement(
      'acknowledgePopup',
      { announcementId: normalizedId },
      scope.runtimeContext
    );
    updateCachedReadState(normalizedId, data.readState, scope);
    return { readState: normalizeReadState(data.readState) };
  };

  const listHistory = async (options = {}) => {
    const requestedPage = Number(
      options.page === undefined ? options.cursor : options.page
    );
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const { runtimeContext } = getCurrentScope();
    const data = await callAnnouncement('listHistory', { page }, runtimeContext);
    const resultPage = Number.isSafeInteger(Number(data.page)) ? Number(data.page) : page;
    const hasMore = data.hasMore === true;
    return {
      page: resultPage,
      pageSize: HISTORY_PAGE_SIZE,
      hasMore,
      cursor: hasMore ? resultPage + 1 : null,
      items: Array.isArray(data.items) ? data.items : []
    };
  };

  const getDetail = async (announcementId) => {
    const normalizedId = requireAnnouncementId(announcementId);
    const { runtimeContext } = getCurrentScope();
    const data = await callAnnouncement(
      'getDetail',
      { announcementId: normalizedId },
      runtimeContext
    );
    return {
      announcement: isPlainObject(data.announcement) ? data.announcement : null,
      readState: normalizeReadState(data.readState)
    };
  };

  return {
    bootstrapAnnouncements,
    refreshAnnouncements,
    claimMajorPopup,
    markRead,
    acknowledgePopup,
    listHistory,
    getDetail,
    resolveAnnouncementAction,
    getRuntimeContext: () => getCurrentScope().runtimeContext,
    getCacheKey: () => {
      const scope = getCurrentScope();
      return buildCacheKey(scope.runtimeContext, scope.sessionSnapshot);
    }
  };
};

const defaultService = createAnnouncementService();

module.exports = {
  CACHE_PREFIX,
  CACHE_TTL_MS,
  HISTORY_PAGE_SIZE,
  ERROR_CODES,
  AnnouncementError,
  buildCacheKey,
  normalizeBootstrapPayload,
  createAnnouncementService,
  bootstrapAnnouncements: defaultService.bootstrapAnnouncements,
  refreshAnnouncements: defaultService.refreshAnnouncements,
  claimMajorPopup: defaultService.claimMajorPopup,
  markRead: defaultService.markRead,
  acknowledgePopup: defaultService.acknowledgePopup,
  listHistory: defaultService.listHistory,
  getDetail: defaultService.getDetail,
  resolveAnnouncementAction
};
