'use strict';

const MIGRATION_STATE_KEY = 'cloudMigrationStateByOpenId';
const LEGACY_MIGRATION_KEY = 'hasMigratedToCloud';

function normalizeOpenId(openid) {
  return String(openid || '').trim();
}

function readMigrationState() {
  const value = wx.getStorageSync(MIGRATION_STATE_KEY);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
}

function getMigrationEntry(openid) {
  const normalizedOpenId = normalizeOpenId(openid);
  if (!normalizedOpenId) return null;
  const entry = readMigrationState()[normalizedOpenId];
  return entry && entry.completed === true ? entry : null;
}

function hasCompletedMigration(openid, options) {
  const normalizedOpenId = normalizeOpenId(openid);
  if (!normalizedOpenId) return false;

  const state = readMigrationState();
  if (state[normalizedOpenId] && state[normalizedOpenId].completed === true) {
    return true;
  }

  const allowLegacyMarker = !options || options.allowLegacyMarker !== false;
  const cachedOpenId = normalizeOpenId(wx.getStorageSync('openid'));
  return !!(
    allowLegacyMarker &&
    Object.keys(state).length === 0 &&
    cachedOpenId === normalizedOpenId &&
    wx.getStorageSync(LEGACY_MIGRATION_KEY)
  );
}

function markMigrationComplete(openid, source) {
  const normalizedOpenId = normalizeOpenId(openid);
  if (!normalizedOpenId) return null;

  const state = readMigrationState();
  const entry = {
    completed: true,
    source: source || 'legacy_migration',
    completedAt: Date.now()
  };
  state[normalizedOpenId] = entry;
  wx.setStorageSync(MIGRATION_STATE_KEY, state);

  // Retain the old boolean for compatibility with older released clients.
  wx.setStorageSync(LEGACY_MIGRATION_KEY, true);
  return entry;
}

module.exports = {
  MIGRATION_STATE_KEY,
  getMigrationEntry,
  hasCompletedMigration,
  markMigrationComplete
};
