'use strict';
const {createHash} = require('node:crypto');
const {projectLedger} = require('../membership-core/ledger');
const DAY = 86400000, CST = 8 * 3600000;
const localDay = value => Math.floor((value + CST) / DAY);
function reminderModel(row, access, now) {
  const day = new Date(now + CST).toISOString().slice(0, 10);
  const remainingDays = access.expiresAt ? Math.max(0, localDay(access.expiresAt) - localDay(now)) : 0;
  const base = {serverNow: now, beijingDay: day, remainingDays, reminder: null};
  if (access.longTerm) return base;
  let stage, text, end;
  if (access.membershipStatus === 'active' && remainingDays <= 7) {
    stage = remainingDays <= 1 ? 'expiry_1' : remainingDays <= 3 ? 'expiry_3' : 'expiry_7';
    end = access.expiresAt;
    text = remainingDays === 0 ? '会员今天到期' : '会员还有 ' + remainingDays + ' 天到期';
  } else if (access.membershipStatus === 'transition') {
    end = access.transitionEndsAt;
    const days = Math.max(0, Math.ceil((end - now) / DAY));
    if (days > 1) return base;
    stage = 'transition_1'; text = '个人缓冲期将在24小时内结束';
  } else if (access.membershipStatus === 'expired') {
    stage = 'expired'; text = '会员已到期，学生和历史记录仍会保留';
    end = Math.max(0, ...projectLedger(row.teacherId, row.grants, now).periods.map(p => p.endsAt));
  } else if (Number.isSafeInteger(row.access.transitionEndsAt) && row.access.transitionEndsAt <= now) {
    stage = 'transition_expired'; text = '个人缓冲期已结束，学生和历史记录仍会保留';
    end = row.access.transitionEndsAt;
  }
  if (!stage) return base;
  // A renewal/refund changes the final entitlement end. Never use cached isVip
  // or rewrite grants/dates; a new response replaces the old reminder entirely.
  const key = createHash('sha256').update(JSON.stringify([row.teacherId, stage, end, day])).digest('hex');
  return {...base, reminder: {key, stage, text, day, expiresAt: end}};
}
module.exports = {reminderModel, localDay};
