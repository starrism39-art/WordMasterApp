'use strict';

const { SCHEMA_VERSION } = require('./constants');
const { instant, addDuration } = require('./time');
const { id, grant, canonical } = require('./model');

function normalizeLedger(teacherId, input) {
  id(teacherId, 'TEACHER_ID');
  if (!Array.isArray(input)) throw new Error('INVALID_LEDGER');
  const sources = new Map();
  const ids = new Map();
  for (const item of input) {
    const current = grant(item);
    if (current.teacherId !== teacherId) throw new Error('TEACHER_MISMATCH');
    // sourceId is globally unique within a teacher, including across source types.
    for (const previous of [sources.get(current.sourceId), ids.get(current.grantId)]) {
      if (previous && canonical(previous) !== canonical(current)) throw new Error('IDEMPOTENCY_CONFLICT');
    }
    sources.set(current.sourceId, current); ids.set(current.grantId, current);
  }
  // Same-instant awards precede adjustments; sourceId is the stable tie breaker.
  return [...sources.values()].sort((a, b) => a.startsAt - b.startsAt || Number(a.operation === 'revoke_remaining') - Number(b.operation === 'revoke_remaining') || (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
}

function projectLedger(teacherId, input, now) {
  instant(now);
  const ledger = normalizeLedger(teacherId, input);
  let periods = [];
  const perpetual = [];
  const adjustments = [];
  for (const entry of ledger) {
    if (entry.operation === 'grant') {
      if (entry.longTerm) perpetual.push({ grantId: entry.grantId, startsAt: entry.startsAt, endsAt: null });
      else {
        const startsAt = Math.max(entry.startsAt, periods.at(-1)?.endsAt || 0);
        if (entry.metadata.fixedEndsAt !== undefined && addDuration(startsAt, entry.duration) !== entry.metadata.fixedEndsAt) throw new Error('GIFT_FIXED_END_CONFLICT_REQUIRES_REVIEW');
        periods.push({ grantId: entry.grantId, sourceId: entry.sourceId, startsAt, endsAt: addDuration(startsAt, entry.duration), earliestStart: entry.startsAt, duration: entry.duration });
      }
      continue;
    }
    const original = ledger.find(item => item.grantId === entry.targetGrantId && item.operation === 'grant');
    if (!original || original.startsAt > entry.startsAt) throw new Error('ADJUSTMENT_TARGET_NOT_AVAILABLE');
    if (entry.sourceType === 'refund_adjustment' && !['payment', 'historical_payment'].includes(original.sourceType)) throw new Error('REFUND_REQUIRES_PAYMENT');
    if (entry.startsAt > now) continue;
    const long = perpetual.find(item => item.grantId === entry.targetGrantId);
    if (long) {
      long.endsAt = Math.min(long.endsAt ?? Infinity, entry.startsAt);
      adjustments.push({ grantId: entry.grantId, targetGrantId: original.grantId, at: entry.startsAt });
      continue;
    }
    const target = periods.find(item => item.grantId === entry.targetGrantId);
    // An expired/already removed award has no remainder; never debit another award.
    if (!target || target.endsAt <= entry.startsAt) continue;
    const removedMilliseconds = target.endsAt - Math.max(target.startsAt, entry.startsAt);
    const changes = [];
    const next = [];
    for (const period of periods) {
      if (period === target) {
        if (period.startsAt < entry.startsAt) next.push({ ...period, endsAt: entry.startsAt });
      } else if (period.startsAt >= entry.startsAt) {
        const startsAt = Math.max(entry.startsAt, period.earliestStart, next.at(-1)?.endsAt || 0);
        const moved = { ...period, startsAt, endsAt: addDuration(startsAt, period.duration) };
        next.push(moved);
        if (moved.startsAt !== period.startsAt) changes.push({ grantId: moved.grantId, before: [period.startsAt, period.endsAt], after: [moved.startsAt, moved.endsAt] });
      } else next.push(period);
    }
    periods = next;
    adjustments.push({ grantId: entry.grantId, targetGrantId: original.grantId, at: entry.startsAt, removedMilliseconds, changes });
  }
  const longTerm = perpetual.some(item => item.startsAt <= now && (item.endsAt === null || now < item.endsAt));
  const currentIndex = periods.findIndex(item => item.startsAt <= now && now < item.endsAt);
  let effectiveStartsAt = null;
  let effectiveExpiresAt = null;
  if (currentIndex >= 0) {
    let first = currentIndex; let last = currentIndex;
    while (first > 0 && periods[first - 1].endsAt === periods[first].startsAt) first--;
    while (last + 1 < periods.length && periods[last].endsAt === periods[last + 1].startsAt) last++;
    effectiveStartsAt = periods[first].startsAt;
    effectiveExpiresAt = periods[last].endsAt;
  }
  const hadMembership = ledger.some(item => item.operation === 'grant' && item.startsAt <= now);
  if (longTerm) {
    effectiveStartsAt = Math.min(...perpetual.filter(item => item.startsAt <= now && (item.endsAt === null || now < item.endsAt)).map(item => item.startsAt));
    effectiveExpiresAt = null;
  }
  const status = longTerm ? 'long_term' : currentIndex >= 0 ? 'active' : hadMembership ? 'expired' : 'free';
  return { teacherId, status, effectiveStartsAt, effectiveExpiresAt, longTerm, currentAccess: longTerm || currentIndex >= 0 ? 'all_students' : 'retained_student', updatedAt: now, schemaVersion: SCHEMA_VERSION, periods, perpetual, adjustments };
}

function rebuildAccount(teacherId, grants, access, now) {
  const projection = projectLedger(teacherId, grants, now);
  if (access && access.teacherId !== teacherId) throw new Error('TEACHER_MISMATCH');
  if (!['active', 'long_term'].includes(projection.status) && access?.transitionStartsAt <= now && now < access.transitionEndsAt) {
    projection.status = 'grace';
    projection.currentAccess = 'transition_existing_students';
  }
  return projection;
}
module.exports = { normalizeLedger, projectLedger, rebuildAccount };
