'use strict';

const ENV_VERSIONS = Object.freeze(['develop', 'trial', 'release']);
const INVALID_RUNTIME_VERSION = 'INVALID_RUNTIME_VERSION';

const normalizeText = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

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

const isVersionAtLeast = (current, minimum) => {
  const comparison = compareVersions(current, minimum);
  return comparison === null ? null : comparison >= 0;
};

const resolveRuntimeContext = (accountInfo = {}) => {
  const miniProgram = accountInfo && accountInfo.miniProgram
    ? accountInfo.miniProgram
    : {};
  const appId = normalizeText(miniProgram.appId);
  const requestedEnvVersion = normalizeText(miniProgram.envVersion);
  const envVersion = ENV_VERSIONS.includes(requestedEnvVersion)
    ? requestedEnvVersion
    : 'develop';
  const rawVersion = normalizeText(miniProgram.version);

  if (envVersion !== 'release') {
    return {
      appId,
      envVersion,
      version: null,
      rawVersion,
      versionStatus: 'not_applicable',
      versionError: null
    };
  }

  const parsed = parseVersion(rawVersion);
  return {
    appId,
    envVersion,
    version: parsed ? parsed.text : null,
    rawVersion,
    versionStatus: parsed ? 'valid' : 'invalid',
    versionError: parsed ? null : INVALID_RUNTIME_VERSION
  };
};

const getRuntimeContext = (getAccountInfo) => {
  const reader = getAccountInfo || (() => {
    if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
      return {};
    }
    return wx.getAccountInfoSync();
  });

  try {
    return resolveRuntimeContext(reader() || {});
  } catch (error) {
    return resolveRuntimeContext({});
  }
};

module.exports = {
  ENV_VERSIONS,
  INVALID_RUNTIME_VERSION,
  parseVersion,
  compareVersions,
  isVersionAtLeast,
  resolveRuntimeContext,
  getRuntimeContext
};
