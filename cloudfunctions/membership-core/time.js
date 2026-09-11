'use strict';

const CST_OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
function instant(value, field = 'time') {
  if (!Number.isSafeInteger(value) || value < 0 || value > 253402185599999) throw new Error(`INVALID_${field}`);
  return value;
}
// All persisted times are epoch milliseconds. Calendar arithmetic is always UTC+08:00.
function addMonths(value, months) {
  instant(value);
  if (!Number.isSafeInteger(months) || months < 1 || months > 1200) throw new Error('INVALID_MONTHS');
  const local = new Date(value + CST_OFFSET);
  const target = local.getUTCMonth() + months;
  const year = local.getUTCFullYear() + Math.floor(target / 12);
  const month = target % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return instant(Date.UTC(year, month, Math.min(local.getUTCDate(), lastDay), local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds()) - CST_OFFSET);
}
function validateDuration(duration) {
  if (!duration || typeof duration !== 'object' || Array.isArray(duration)) throw new Error('INVALID_DURATION');
  const keys = Object.keys(duration);
  if (keys.length !== 1 || !['months', 'milliseconds'].includes(keys[0])) throw new Error('INVALID_DURATION');
  const value = duration[keys[0]];
  if (!Number.isSafeInteger(value) || value <= 0 || (keys[0] === 'months' && value > 1200)) throw new Error('INVALID_DURATION');
  return { [keys[0]]: value };
}
function addDuration(start, duration) {
  validateDuration(duration);
  return duration.months ? addMonths(start, duration.months) : instant(start + duration.milliseconds);
}
module.exports = { instant, addMonths, addDuration, validateDuration, DAY };
