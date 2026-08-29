'use strict';

const toText = (value) => (
  String(value === undefined || value === null ? '' : value)
);

const normalizeDisplayText = (value) => (
  toText(value)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
);

const normalizeWordbookName = (value) => (
  normalizeDisplayText(value).toLowerCase()
);

module.exports = {
  normalizeDisplayText,
  normalizeWordbookName
};
