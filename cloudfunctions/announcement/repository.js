'use strict';

const crypto = require('crypto');
const { COLLECTIONS } = require('./model');

const stableReadId = (openid, announcementId) => (
  crypto.createHash('sha256').update(`${openid}:${announcementId}`, 'utf8').digest('hex').slice(0, 32)
);

const withoutDocumentId = (document) => {
  const data = { ...document };
  delete data._id;
  return data;
};

const getDocument = (result) => {
  if (!result) return null;
  if (Array.isArray(result.data)) return result.data[0] || null;
  return result.data || null;
};

const isNotFound = (error) => {
  const message = [error && error.errCode, error && error.errMsg, error && error.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return message.includes('not found') || message.includes('not exist') || message.includes('-1');
};

const readDocument = async (documentReference) => {
  try {
    return getDocument(await documentReference.get());
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

const createReadState = ({ id, openid, announcementId, version, envVersion, now }) => ({
  _id: id,
  teacher_id: openid,
  announcement_id: announcementId,
  readAt: null,
  popupShownAt: null,
  popupAcknowledgedAt: null,
  version,
  envVersion,
  createdAt: now,
  updatedAt: now
});

const createCloudRepository = (db) => {
  const command = db.command;

  const findActiveTeacher = async (openid) => {
    const result = await db.collection(COLLECTIONS.TEACHERS)
      .where({ teacher_id: openid })
      .limit(1)
      .get();
    const teacher = getDocument(result);
    return teacher && (!teacher.status || teacher.status === 'active') ? teacher : null;
  };

  const listPublished = async (offset, limit) => {
    const result = await db.collection(COLLECTIONS.ANNOUNCEMENTS)
      .where({ status: 'published' })
      .orderBy('publishTime', 'desc')
      .skip(offset)
      .limit(limit)
      .get();
    return Array.isArray(result.data) ? result.data : [];
  };

  const listMajorCandidates = async (runtime) => {
    const channels = ['all', runtime.envVersion];
    const bindVersions = runtime.envVersion === 'release'
      ? [null, runtime.version].filter((value, index, values) => values.indexOf(value) === index)
      : [null];
    const queries = [];
    for (const channel of channels) {
      for (const bindVersion of bindVersions) {
        queries.push(
          db.collection(COLLECTIONS.ANNOUNCEMENTS)
            .where({
              status: 'published',
              type: 'version_update',
              priority: 'major',
              channel,
              bindVersion
            })
            .orderBy('publishTime', 'desc')
            .limit(20)
            .get()
        );
      }
    }
    const results = await Promise.all(queries);
    const byId = new Map();
    results.forEach((result) => {
      (Array.isArray(result.data) ? result.data : []).forEach((item) => byId.set(item._id, item));
    });
    return [...byId.values()];
  };

  const getAnnouncement = async (announcementId) => (
    readDocument(db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId))
  );

  const getReads = async (openid, announcementIds) => {
    if (!announcementIds.length) return [];
    const result = await db.collection(COLLECTIONS.ANNOUNCEMENT_READS)
      .where({
        teacher_id: openid,
        announcement_id: command.in(announcementIds)
      })
      .limit(100)
      .get();
    return Array.isArray(result.data) ? result.data : [];
  };

  const claimMajorPopup = async ({ openid, announcementId, version, envVersion, now }) => (
    db.runTransaction(async (transaction) => {
      const id = stableReadId(openid, announcementId);
      const reference = transaction.collection(COLLECTIONS.ANNOUNCEMENT_READS).doc(id);
      const existing = await readDocument(reference);
      if (existing && existing.popupShownAt) return { claimed: false, readState: existing };

      if (!existing) {
        const created = createReadState({ id, openid, announcementId, version, envVersion, now });
        created.popupShownAt = now;
        await reference.set({ data: withoutDocumentId(created) });
        return { claimed: true, readState: created };
      }

      const updates = { popupShownAt: now, version, envVersion, updatedAt: now };
      await reference.update({ data: updates });
      return { claimed: true, readState: { ...existing, ...updates } };
    })
  );

  const markRead = async ({ openid, announcementId, version, envVersion, now }) => (
    db.runTransaction(async (transaction) => {
      const id = stableReadId(openid, announcementId);
      const reference = transaction.collection(COLLECTIONS.ANNOUNCEMENT_READS).doc(id);
      const existing = await readDocument(reference);
      if (!existing) {
        const created = createReadState({ id, openid, announcementId, version, envVersion, now });
        created.readAt = now;
        await reference.set({ data: withoutDocumentId(created) });
        return created;
      }
      if (existing.readAt) return existing;
      const updates = { readAt: now, version, envVersion, updatedAt: now };
      await reference.update({ data: updates });
      return { ...existing, ...updates };
    })
  );

  const acknowledgePopup = async ({ openid, announcementId, version, envVersion, now }) => (
    db.runTransaction(async (transaction) => {
      const id = stableReadId(openid, announcementId);
      const reference = transaction.collection(COLLECTIONS.ANNOUNCEMENT_READS).doc(id);
      const existing = await readDocument(reference);
      if (!existing || !existing.popupShownAt) return { acknowledged: false, readState: existing };
      if (existing.popupAcknowledgedAt && existing.readAt) {
        return { acknowledged: true, readState: existing };
      }
      const updates = {
        readAt: existing.readAt || now,
        popupAcknowledgedAt: existing.popupAcknowledgedAt || now,
        version,
        envVersion,
        updatedAt: now
      };
      await reference.update({ data: updates });
      return { acknowledged: true, readState: { ...existing, ...updates } };
    })
  );

  return {
    findActiveTeacher,
    listPublished,
    listMajorCandidates,
    getAnnouncement,
    getReads,
    claimMajorPopup,
    markRead,
    acknowledgePopup
  };
};

module.exports = {
  stableReadId,
  withoutDocumentId,
  createCloudRepository
};
