'use strict';

let currentAccountId = null;
let generation = 0;
let initialized = false;

function normalizeAccountId(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function readStoredAccountId() {
  try {
    return normalizeAccountId(wx.getStorageSync('openid'));
  } catch (error) {
    return '';
  }
}

function observeStoredAccount() {
  const storedAccountId = readStoredAccountId();
  if (!initialized || storedAccountId !== currentAccountId) {
    currentAccountId = storedAccountId;
    generation += 1;
    initialized = true;
  }
  return { accountId: currentAccountId, generation };
}

function establishAccountSession(accountId) {
  const normalized = normalizeAccountId(accountId);
  const observed = observeStoredAccount();
  if (observed.accountId !== normalized) {
    currentAccountId = normalized;
    generation += 1;
    initialized = true;
  }
  return { accountId: currentAccountId, generation };
}

function captureAccountSession(expectedAccountId) {
  const observed = observeStoredAccount();
  const expected = normalizeAccountId(expectedAccountId);
  return {
    accountId: expected || observed.accountId,
    generation: observed.generation
  };
}

function isAccountSessionCurrent(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const observed = observeStoredAccount();
  return observed.accountId === normalizeAccountId(snapshot.accountId)
    && observed.generation === snapshot.generation;
}

function invalidateAccountSession() {
  observeStoredAccount();
  currentAccountId = '';
  generation += 1;
  initialized = true;
  return { accountId: currentAccountId, generation };
}

module.exports = {
  captureAccountSession,
  establishAccountSession,
  invalidateAccountSession,
  isAccountSessionCurrent,
  normalizeAccountId
};
