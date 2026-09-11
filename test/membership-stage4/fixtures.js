'use strict';
const { MemoryRepository } = require('../../cloudfunctions/membership-core/repository');
const { createAccessService } = require('../../cloudfunctions/membership-access/service');
const { initializeAccess } = require('../../cloudfunctions/membership-core/access');
const { BASE, award, student, T } = require('../membership-stage2/fixtures');
async function setup({ students = [], grants = [], registeredAt = BASE, now = BASE, risk = 'normal' } = {}) {
  const repository = new MemoryRepository(); const state = { teacherId: 'teacher', now, risk };
  await repository.transaction('teacher', row => { row.students = students; row.grants = grants; row.access = initializeAccess({ teacherId: 'teacher', students, grants, registeredAt, launchAt: BASE, now }); });
  const build = () => createAccessService({ repository, getIdentity: async () => ({ teacherId: state.teacherId }), clock: () => state.now, administrators: ['admin'], getProfileRisk: async () => state.risk });
  const service = build();
  return { repository, state, build, service };
}
function entry(sourceType = 'gift', sourceId = 'gift1', extra = {}) {
  const longTerm = sourceType === 'internal_long_term';
  return { sourceId, sourceType, startsAt: BASE, duration: longTerm ? null : { months: 12 }, longTerm, metadata: {}, reason: 'Authorized fixture', operation: 'grant', ...extra };
}
async function adminGrant(s, input) {
  s.state.teacherId = 'admin'; const p = await s.service.admin.previewGrant({ teacherId: 'teacher', entry: input });
  const result = await s.service.admin.applyGrant({ teacherId: 'teacher', entry: input, previewToken: p.token, previewAt: p.previewAt });
  s.state.teacherId = 'teacher'; return result;
}
module.exports = { setup, entry, adminGrant, BASE, award, student, T };
