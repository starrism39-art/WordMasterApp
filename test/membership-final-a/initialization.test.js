'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planInitialization, createInitializationService } = require('../../cloudfunctions/membership-business/initialization');
const { MemoryRepository } = require('../../cloudfunctions/membership-core/repository');
const { rebuildAccount } = require('../../cloudfunctions/membership-core/ledger');
const DAY = 86400000;
const AT = Date.parse('2026-09-11T10:00:00+08:00');
const evidence = { verified: true, reference: 'LOCAL_EVIDENCE', operator: 'LOCAL_ADMIN' };
const student = n => ({ teacherId: 'teacher', studentId: 'student_' + n, name: 'Local', grade: '', deleted: false });
const facts = (extra = {}) => ({ teacherId: 'teacher', registeredAt: AT - DAY, registrationEvidence: evidence,
  classificationEvidence: evidence, students: [], sources: [], ...extra });
const source = (kind, extra = {}) => ({ kind, sourceId: 'LOCAL_' + kind, startsAt: AT - DAY, duration: { months: 12 },
  amount: 19900, timePrecision: 'exact', evidence, ...extra });
const plan = (f, now = AT) => planInitialization({ teacherId: 'teacher', facts: f, now });
test('gift deadline-only evidence preserves the recorded end; negative registration enters review',()=>{
 const result=plan(facts({sources:[source('gift',{duration:undefined,fixedEndsAt:AT+DAY})]}));
 assert.equal(result.classification,'gift');assert.equal(result.grants[0].endsAt,AT+DAY);
 assert.equal(plan(facts({registeredAt:-1})).classification,'review');
});
function setup(initialFacts) {
  const repo = new MemoryRepository(); repo.readForInitialization = id => repo.read(id); repo.initializeTransaction = (id, op) => repo.transaction(id, op);
  const state = { facts: initialFacts, now: AT, admin: true };
  const service = createInitializationService({ repository: repo, getFacts: async () => structuredClone(state.facts),
    previewKey: 'LOCAL_PREVIEW_KEY_ONLY_32_BYTES_MINIMUM', clock: () => state.now,
    getOperator: async () => ({ isAdmin: state.admin, operatorId: 'LOCAL_ADMIN' }) });
  const request = p => Object.fromEntries(['teacherId','previewAt','factsHash','revision','token'].map(k => [k, p[k]]));
  return { repo, state, service, request };
}
test('missing ledger facts and unverified old profile never imply free', () => {
  assert.equal(plan(null).classification, 'review');
  assert.equal(plan(facts({ classificationEvidence: null, userRole: 'internal' })).classification, 'review');
  assert.equal(plan(facts({ registrationEvidence: null })).classification, 'review');
});
test('known free without reliable deletion history is not invented as consumed', () => {
  assert.equal(plan(facts()).access.freeSlotConsumed, false);
  assert.equal(plan(facts({ students: [student(1)] })).access.freeSlotConsumed, true);
  assert.equal(plan(facts({ consumed: true, consumptionEvidence: evidence })).access.freeSlotConsumed, true);
  assert.equal(plan(facts({ consumed: true })).classification, 'review');
});
test('historical actual paidAt, non-399 amount and expired history remain historical', () => {
  const p = plan(facts({ sources: [source('historical', { startsAt: AT - 800 * DAY })] }));
  assert.equal(p.classification, 'historical'); assert.equal(p.account.status, 'expired');
  assert.equal(p.grants[0].metadata.amount, 19900); assert.equal(p.grants[0].startsAt, AT - 800 * DAY);
});
test('date-only history requires explicit precision basis; malformed sources go to review', () => {
  assert.equal(plan(facts({ sources: [source('historical', { timePrecision: 'date_only' })] })).classification, 'review');
  assert.equal(plan(facts({ sources: [source('historical', { timePrecision: 'date_only', timeBasis: 'Recorded date at Beijing midnight; time unknown' })] })).classification, 'historical');
  assert.equal(plan(facts({ sources: [source('historical', { startsAt: AT + DAY })] })).classification, 'review');
});
test('gift is separate and long-term survives ordinary duration sources', () => {
  const p = plan(facts({ sources: [source('gift'), source('historical'), source('long-term')] }));
  assert.equal(p.classification, 'long-term'); assert.equal(p.account.status, 'long_term');
  assert.equal(p.grants.length, 3); assert.equal(p.grants[0].sourceType, 'gift');
  assert.equal(rebuildAccount('teacher', p.grants, p.access, AT + 900 * DAY).status, 'long_term');
});
test('conflicting source IDs do not partially initialize paid grants', () => {
  const p = plan(facts({ sources: [source('gift'), source('gift', { duration: { months: 2 } })] }));
  assert.equal(p.classification, 'review'); assert.deepEqual(p.grants, []); assert.equal(p.access, null);
});
test('preview has no writes, concurrent/repeated apply has one grant and one source audit', async () => {
  const s = setup(facts({ sources: [source('historical')] })); const p = await s.service.preview('teacher');
  assert.equal(s.repo.rows.size, 0);
  const req = s.request(p); await Promise.all([s.service.apply(req),s.service.apply(req)]);
  s.state.now += DAY; await s.service.apply(req);
  const row = s.repo.read('teacher'); assert.equal(row.grants.length,1); assert.equal(row.audits.length,1); assert.equal(row.revision,1);
  assert.equal((await s.service.preview('teacher')).alreadyInitialized,true);
});
test('unknown is auditable review with no free access, repeat stays idempotent', async () => {
  const s = setup(facts({ classificationEvidence: null })); const req = s.request(await s.service.preview('teacher'));
  await s.service.apply(req); await s.service.apply(req);
  const row = s.repo.read('teacher'); assert.equal(row.initialization.state,'review'); assert.equal(row.access,null); assert.equal(row.grants.length,0); assert.equal(row.audits.length,1);
});
test('facts changed, expired preview, tampering and non-admin all refuse writes', async () => {
  const s=setup(facts()); const req=s.request(await s.service.preview('teacher'));
  s.state.facts.students.push(student(1)); await assert.rejects(s.service.apply(req),/FACTS_CHANGED/);
  s.state.facts=facts(); s.state.now+=300001; await assert.rejects(s.service.apply(req),/PREVIEW_STALE/);
  await assert.rejects(s.service.apply({...req,revision:2}),/PREVIEW_REQUIRED/);
  s.state.admin=false; await assert.rejects(s.service.preview('teacher'),/ADMIN_REQUIRED/); assert.equal(s.repo.rows.size,0);
});
test('failed transaction leaves no partial grant, access or audit', async () => {
  const s=setup(facts({sources:[source('gift')]})); const req=s.request(await s.service.preview('teacher'));
  s.repo.failNextCommit=true; await assert.rejects(s.service.apply(req),/INJECTED_COMMIT_FAILURE/); assert.equal(s.repo.rows.size,0);
  await s.service.apply(req); assert.equal(s.repo.read('teacher').grants.length,1);
});
