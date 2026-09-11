'use strict';

const SCHEMA_VERSION = 1;
const POLICY_VERSION = 'teacher-membership-v1';
const SOURCE_TYPES = Object.freeze(['payment', 'gift', 'historical_payment', 'internal_long_term', 'admin_adjustment', 'refund_adjustment']);
const MEMBERSHIP_STATUSES = Object.freeze(['free', 'active', 'expired', 'grace', 'long_term']);
const ORDER_STATUSES = Object.freeze(['created', 'awaiting_payment', 'paid', 'grant_pending', 'granted', 'payment_failed', 'cancelled', 'refund_pending', 'refunded', 'exception']);
const REASONS = Object.freeze(Object.fromEntries([
  'FREE_SLOT_AVAILABLE', 'FREE_SLOT_ALREADY_USED', 'FREE_RETAINED_STUDENT',
  'FREE_LOCKED_STUDENT', 'MEMBER_ACTIVE', 'MEMBER_EXPIRED_RETAINED_STUDENT',
  'MEMBER_EXPIRED_LOCKED_STUDENT', 'RETAINED_STUDENT_REQUIRED',
  'TRANSITION_ACTIVE', 'TRANSITION_STUDENT_LOCKED', 'LONG_TERM_MEMBER',
  'STUDENT_NOT_OWNED', 'STUDENT_DELETED', 'PROFILE_REPLACEMENT_REQUIRES_ADMIN'
].map(value => [value, value])));
const COLLECTIONS = Object.freeze(['membership_products', 'membership_grants', 'membership_accounts', 'teacher_student_access', 'membership_admin_audit', 'payment_orders', 'payment_events']);
const ANNUAL_PRODUCT = Object.freeze({ productType: 'teacher_annual', price: 39900, currency: 'CNY', duration: Object.freeze({ months: 12 }), autoRenew: false });
module.exports = { SCHEMA_VERSION, POLICY_VERSION, SOURCE_TYPES, MEMBERSHIP_STATUSES, ORDER_STATUSES, REASONS, COLLECTIONS, ANNUAL_PRODUCT };
