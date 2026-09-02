'use strict';

const {
  ACTIONS,
  ERROR_CODES,
  ALLOWED_ACTION_TARGETS,
  ENV_VERSIONS
} = require('./model');

const PAGE_SIZE = 20;
const MAX_PAGE = 100;
const SCAN_BATCH_SIZE = 100;
const MAX_SCAN = 5000;
const ALLOWED_TYPES = new Set(['version_update', 'system', 'wordbook', 'activity', 'membership']);
const ALLOWED_PRIORITIES = new Set(['normal', 'important', 'major']);
const ALLOWED_AUDIENCES = new Set(['all', 'teachers']);
const ALLOWED_CHANNELS = new Set(['all', ...ENV_VERSIONS]);
const ALLOWED_TARGETS = new Set(ALLOWED_ACTION_TARGETS);
const ANNOUNCEMENT_FIELDS = new Set([
  '_id', 'type', 'priority', 'status', 'title', 'summary', 'content', 'audience',
  'channel', 'minVersion', 'bindVersion', 'popup', 'action', 'publishTime',
  'endTime', 'createdAt', 'updatedAt'
]);

const normalizeText = (value) => String(value === undefined || value === null ? '' : value).trim();

const failure = (error) => ({ success: false, error });
const success = (data) => ({ success: true, data });

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const parseVersion = (value) => {
  const text = normalizeText(value);
  if (!/^\d+(?:\.\d+)*$/.test(text)) return null;
  const parts = text.split('.').map((part) => Number(part));
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) return null;
  return { text, parts };
};

const compareVersions = (left, right) => {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (!parsedLeft || !parsedRight) return null;
  const length = Math.max(parsedLeft.parts.length, parsedRight.parts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = parsedLeft.parts[index] || 0;
    const rightPart = parsedRight.parts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
};

const toDate = (value) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const isValidAction = (action) => {
  if (action === null) return true;
  if (!isPlainObject(action)) return false;
  if (Object.keys(action).some((key) => !['type', 'target', 'params'].includes(key))) return false;
  if (action.type !== 'navigate' || !ALLOWED_TARGETS.has(action.target)) return false;
  if (!isPlainObject(action.params) || Object.keys(action.params).length > 10) return false;
  return Object.entries(action.params).every(([key, value]) => (
    /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)
    && !['__proto__', 'prototype', 'constructor'].includes(key)
    && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    && (typeof value !== 'string' || value.length <= 200)
    && (typeof value !== 'number' || Number.isFinite(value))
  ));
};

const hasValidAnnouncementShape = (announcement) => (
  isPlainObject(announcement)
  && Object.keys(announcement).every((key) => ANNOUNCEMENT_FIELDS.has(key))
  && Object.keys(announcement).length === ANNOUNCEMENT_FIELDS.size
  && normalizeText(announcement._id).length > 0
  && ALLOWED_TYPES.has(announcement.type)
  && ALLOWED_PRIORITIES.has(announcement.priority)
  && ['draft', 'published', 'archived'].includes(announcement.status)
  && typeof announcement.title === 'string'
  && typeof announcement.summary === 'string'
  && typeof announcement.content === 'string'
  && ALLOWED_AUDIENCES.has(announcement.audience)
  && ALLOWED_CHANNELS.has(announcement.channel)
  && (announcement.minVersion === null || Boolean(parseVersion(announcement.minVersion)))
  && (announcement.bindVersion === null || Boolean(parseVersion(announcement.bindVersion)))
  && typeof announcement.popup === 'boolean'
  && isValidAction(announcement.action)
  && Boolean(toDate(announcement.publishTime))
  && (announcement.endTime === null || Boolean(toDate(announcement.endTime)))
  && Boolean(toDate(announcement.createdAt))
  && Boolean(toDate(announcement.updatedAt))
);

const normalizeRuntime = (event) => {
  const requestedEnv = normalizeText(event && event.envVersion);
  const envVersion = ENV_VERSIONS.includes(requestedEnv) ? requestedEnv : 'develop';
  const parsed = envVersion === 'release' ? parseVersion(event && event.version) : null;
  return {
    envVersion,
    version: parsed ? parsed.text : null
  };
};

const passesAudienceChannelVersion = (announcement, runtime, enforceBindVersion) => {
  if (!['all', 'teachers'].includes(announcement.audience)) return false;
  if (announcement.channel !== 'all' && announcement.channel !== runtime.envVersion) return false;

  if (runtime.envVersion !== 'release') {
    return announcement.bindVersion === null && announcement.minVersion === null;
  }

  if (announcement.minVersion !== null) {
    const comparison = compareVersions(runtime.version, announcement.minVersion);
    if (comparison === null || comparison < 0) return false;
  }

  if (announcement.bindVersion !== null && runtime.version === null) return false;

  if (enforceBindVersion && announcement.bindVersion !== null) {
    return compareVersions(runtime.version, announcement.bindVersion) === 0;
  }

  return true;
};

const isVisiblePublished = (announcement, runtime, options = {}) => {
  if (!hasValidAnnouncementShape(announcement) || announcement.status !== 'published') return false;
  if (!passesAudienceChannelVersion(announcement, runtime, Boolean(options.enforceBindVersion))) return false;
  const now = options.now || new Date();
  const publishTime = toDate(announcement.publishTime);
  if (publishTime > now) return false;
  if (!options.requireCurrent) return true;

  const endTime = announcement.endTime === null ? null : toDate(announcement.endTime);
  return publishTime <= now && (!endTime || endTime > now);
};

const isMajorPopupCandidate = (announcement, runtime, now) => (
  isVisiblePublished(announcement, runtime, {
    requireCurrent: true,
    enforceBindVersion: true,
    now
  })
  && announcement.type === 'version_update'
  && announcement.priority === 'major'
  && announcement.popup === true
);

const projectReadState = (readState) => {
  if (!readState) return null;
  return {
    readAt: readState.readAt || null,
    popupShownAt: readState.popupShownAt || null,
    popupAcknowledgedAt: readState.popupAcknowledgedAt || null,
    version: readState.version || null,
    envVersion: readState.envVersion
  };
};

const createAnnouncementService = ({ repository, getOpenid, clock = () => new Date() }) => {
  if (!repository || typeof getOpenid !== 'function') throw new Error('announcement_service_dependencies_missing');

  const authorize = async () => {
    const openid = normalizeText(getOpenid());
    if (!openid) return { response: failure(ERROR_CODES.UNAUTHORIZED) };
    const teacher = await repository.findActiveTeacher(openid);
    if (!teacher) return { response: failure(ERROR_CODES.TEACHER_NOT_FOUND) };
    return { openid };
  };

  const getVisibleAnnouncement = async (announcementId, runtime, options = {}) => {
    const normalizedId = normalizeText(announcementId);
    if (!normalizedId) return null;
    const announcement = await repository.getAnnouncement(normalizedId);
    return isVisiblePublished(announcement, runtime, options) ? announcement : null;
  };

  const bootstrap = async (openid, runtime, now) => {
    let latest = null;
    for (let offset = 0; offset < MAX_SCAN && !latest; offset += SCAN_BATCH_SIZE) {
      const batch = await repository.listPublished(offset, SCAN_BATCH_SIZE);
      latest = batch.find((item) => isVisiblePublished(item, runtime, {
        requireCurrent: true,
        enforceBindVersion: true,
        now
      })) || null;
      if (batch.length < SCAN_BATCH_SIZE) break;
    }

    const majorOptions = await repository.listMajorCandidates(runtime);
    const majorCandidate = majorOptions
      .filter((item) => isMajorPopupCandidate(item, runtime, now))
      .sort((left, right) => toDate(right.publishTime) - toDate(left.publishTime))[0] || null;

    const ids = [...new Set([latest && latest._id, majorCandidate && majorCandidate._id].filter(Boolean))];
    const reads = await repository.getReads(openid, ids);
    const readMap = new Map(reads.map((item) => [item.announcement_id, item]));
    const latestReadState = projectReadState(latest && readMap.get(latest._id));

    return success({
      latestAnnouncement: latest,
      latestReadState,
      latestIsNew: Boolean(latest && (!latestReadState || !latestReadState.readAt)),
      majorCandidate,
      majorReadState: projectReadState(majorCandidate && readMap.get(majorCandidate._id))
    });
  };

  const listHistory = async (openid, runtime, event, now) => {
    const requestedPage = Number(event && event.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, MAX_PAGE)
      : 1;
    const visibleNeeded = page * PAGE_SIZE + 1;
    const visible = [];

    for (let offset = 0; offset < MAX_SCAN && visible.length < visibleNeeded; offset += SCAN_BATCH_SIZE) {
      const batch = await repository.listPublished(offset, SCAN_BATCH_SIZE);
      visible.push(...batch.filter((item) => isVisiblePublished(item, runtime, { now })));
      if (batch.length < SCAN_BATCH_SIZE) break;
    }

    const start = (page - 1) * PAGE_SIZE;
    const announcements = visible.slice(start, start + PAGE_SIZE);
    const reads = await repository.getReads(openid, announcements.map((item) => item._id));
    const readMap = new Map(reads.map((item) => [item.announcement_id, item]));

    return success({
      page,
      pageSize: PAGE_SIZE,
      hasMore: visible.length > start + PAGE_SIZE,
      items: announcements.map((announcement) => ({
        announcement,
        readState: projectReadState(readMap.get(announcement._id))
      }))
    });
  };

  const getDetail = async (openid, runtime, event, now) => {
    const announcement = await getVisibleAnnouncement(event && event.announcementId, runtime, { now });
    if (!announcement) return failure(ERROR_CODES.NOT_FOUND);
    const reads = await repository.getReads(openid, [announcement._id]);
    return success({ announcement, readState: projectReadState(reads[0]) });
  };

  const claimMajorPopup = async (openid, runtime, event, now) => {
    const announcement = await getVisibleAnnouncement(event && event.announcementId, runtime, {
      requireCurrent: true,
      enforceBindVersion: true,
      now
    });
    if (!announcement || !isMajorPopupCandidate(announcement, runtime, now)) {
      return failure(ERROR_CODES.NOT_FOUND);
    }
    const result = await repository.claimMajorPopup({
      openid,
      announcementId: announcement._id,
      version: runtime.version,
      envVersion: runtime.envVersion,
      now
    });
    return success({ claimed: result.claimed, readState: projectReadState(result.readState) });
  };

  const markRead = async (openid, runtime, event, now) => {
    const announcement = await getVisibleAnnouncement(event && event.announcementId, runtime, { now });
    if (!announcement) return failure(ERROR_CODES.NOT_FOUND);
    const readState = await repository.markRead({
      openid,
      announcementId: announcement._id,
      version: runtime.version,
      envVersion: runtime.envVersion,
      now
    });
    return success({ readState: projectReadState(readState) });
  };

  const acknowledgePopup = async (openid, runtime, event, now) => {
    const announcement = await getVisibleAnnouncement(event && event.announcementId, runtime, {
      requireCurrent: true,
      enforceBindVersion: true,
      now
    });
    if (!announcement || !isMajorPopupCandidate(announcement, runtime, now)) {
      return failure(ERROR_CODES.NOT_FOUND);
    }
    const result = await repository.acknowledgePopup({
      openid,
      announcementId: announcement._id,
      version: runtime.version,
      envVersion: runtime.envVersion,
      now
    });
    if (!result.acknowledged) return failure(ERROR_CODES.POPUP_NOT_CLAIMED);
    return success({ readState: projectReadState(result.readState) });
  };

  const main = async (event = {}) => {
    try {
      const auth = await authorize();
      if (auth.response) return auth.response;
      const runtime = normalizeRuntime(event);
      const now = clock();

      switch (event.action) {
        case ACTIONS.BOOTSTRAP:
          return bootstrap(auth.openid, runtime, now);
        case ACTIONS.LIST_HISTORY:
          return listHistory(auth.openid, runtime, event, now);
        case ACTIONS.GET_DETAIL:
          return getDetail(auth.openid, runtime, event, now);
        case ACTIONS.CLAIM_MAJOR_POPUP:
          return claimMajorPopup(auth.openid, runtime, event, now);
        case ACTIONS.MARK_READ:
          return markRead(auth.openid, runtime, event, now);
        case ACTIONS.ACKNOWLEDGE_POPUP:
          return acknowledgePopup(auth.openid, runtime, event, now);
        default:
          return failure(ERROR_CODES.INVALID_ACTION);
      }
    } catch (error) {
      console.error('[announcement] action failed', {
        action: event && event.action,
        message: error && error.message
      });
      return failure(ERROR_CODES.INTERNAL_ERROR);
    }
  };

  return { main };
};

module.exports = {
  PAGE_SIZE,
  parseVersion,
  compareVersions,
  isValidAction,
  hasValidAnnouncementShape,
  normalizeRuntime,
  isVisiblePublished,
  isMajorPopupCandidate,
  createAnnouncementService
};
