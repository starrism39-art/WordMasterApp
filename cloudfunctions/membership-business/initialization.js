'use strict';
// Input facts come exclusively from a protected server-side evidence provider.
// This module neither reads Stage5 records nor infers membership from profile flags.
const crypto = require('node:crypto');
const { id, canonical, grant } = require('../membership-core/model');
const { instant, addDuration } = require('../membership-core/time');
const { initializeAccess } = require('../membership-core/access');
const { normalizeLedger, rebuildAccount } = require('../membership-core/ledger');
const digest = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const validEvidence = e => !!(e && e.verified === true && typeof e.reference === 'string' && e.reference.trim() && typeof e.operator === 'string' && e.operator.trim());
const candidate = (teacherId,facts) => require('./legacy-candidates.json').teacherHashes.includes(crypto.createHash('sha256').update(teacherId).digest('hex')) && !facts?.review && !facts?.sources?.length;

function planInitialization({ teacherId, facts, now }) {
  id(teacherId); instant(now);
  const review = reason => ({ classification: 'review', reason, grants: [], access: null });
  if (!facts || facts.teacherId !== teacherId || !Array.isArray(facts.students) || !Array.isArray(facts.sources)) return review('FACTS_REQUIRED');
  if (!Number.isSafeInteger(facts.registeredAt) || facts.registeredAt < 0 || facts.registeredAt > now || !validEvidence(facts.registrationEvidence)) return review('REGISTRATION_REVIEW_REQUIRED');
  if (facts.students.some(s => s.teacherId !== teacherId || typeof s.deleted !== 'boolean')) return review('STUDENT_OWNERSHIP_REVIEW_REQUIRED');
  if (new Set(facts.students.map(s => s.studentId)).size !== facts.students.length) return review('STUDENT_ID_CONFLICT');
  if (facts.conflict || !validEvidence(facts.classificationEvidence)) return review('CLASSIFICATION_REVIEW_REQUIRED');
  let grants;
  try {
    grants = normalizeLedger(teacherId, facts.sources.map(source => {
      if (!validEvidence(source.evidence) || !['historical', 'gift', 'long-term'].includes(source.kind)) throw Error('SOURCE_EVIDENCE_REQUIRED');
      id(source.sourceId); instant(source.startsAt);
      if (source.kind === 'historical' && source.startsAt > now) throw Error('FUTURE_PAYMENT');
      const longTerm = source.kind === 'long-term';
      const duration = longTerm ? null : source.kind === 'historical' ? { months: 12 } : source.duration || { milliseconds: source.fixedEndsAt - source.startsAt };
      const metadata = { evidence: source.evidence.reference, evidenceOperator: source.evidence.operator };
      if (source.kind === 'historical') {
        Object.assign(metadata, { paidAt: source.startsAt, amount: source.amount, timePrecision: source.timePrecision });
        if (source.timePrecision === 'date_only') {
          if (typeof source.timeBasis !== 'string' || !source.timeBasis.trim()) throw Error('EXPLICIT_DATE_BASIS_REQUIRED');
          metadata.timeBasis = source.timeBasis;
        }
      }
      if (source.fixedEndsAt !== undefined) metadata.fixedEndsAt = source.fixedEndsAt;
      return grant({ teacherId, grantId: `grant_${digest({ teacherId, sourceId: source.sourceId })}`, sourceId: source.sourceId,
        sourceType: source.kind === 'historical' ? 'historical_payment' : longTerm ? 'internal_long_term' : 'gift',
        startsAt: source.startsAt, endsAt: longTerm ? null : addDuration(source.startsAt, duration), duration, longTerm,
        operation: 'grant', status: 'recorded', metadata, reason: source.reason || source.evidence.reference,
        createdAt: now, updatedAt: now, schemaVersion: 1 });
    }));
    facts.students.forEach(s => id(s.studentId));
  } catch { return review('SOURCE_OR_STUDENT_REVIEW_REQUIRED'); }
  const reliablePriorConsumption = facts.consumed === true && validEvidence(facts.consumptionEvidence);
  if (facts.consumed === true && !reliablePriorConsumption) return review('CONSUMPTION_REVIEW_REQUIRED');
  // Administrative source initialization never starts the first-open buffer.
  const access = initializeAccess({ teacherId, students: facts.students, grants, registeredAt: now, launchAt: now,
    reliablePriorConsumption, now });
  const kinds = [...new Set(facts.sources.map(s => s.kind))];
  const classification = kinds.includes('long-term') ? 'long-term' : kinds.includes('historical') ? 'historical' : kinds.includes('gift') ? 'gift' : access.transitionEndsAt !== null ? 'transition' : 'free';
  return { classification, sourceKinds: kinds, reason: null, grants, access, account: rebuildAccount(teacherId, grants, access, now) };
}

function createInitializationService({ repository, getFacts, getOperator, previewKey, clock = Date.now }) {
  if (typeof previewKey !== 'string' || Buffer.byteLength(previewKey) < 32) throw Error('PREVIEW_KEY_REQUIRED');
  const sign = value => crypto.createHmac('sha256', previewKey).update(canonical(value)).digest('hex');
  async function operator() { const value = await getOperator(); if (!value?.isAdmin) throw Error('ADMIN_REQUIRED'); return id(value.operatorId); }
  function tokenFor(teacherId, factsHash, revision, previewAt) { return sign({ teacherId, factsHash, revision, previewAt, policy:'personal-transition-v2' }); }
  return {
    async preview(teacherId) {
      await operator(); id(teacherId);
      const row = await repository.readForInitialization(teacherId);
      if (row?.initialization?.state === 'ready') return { teacherId, alreadyInitialized: true, classification: row.initialization.classification };
      const facts = await getFacts(teacherId); const previewAt = clock();
      if(candidate(teacherId,facts))return {teacherId,classification:'legacy_free_candidate',transitionStartedAt:null,firstOpenPending:true,readOnly:true};
      const plan = planInitialization({ teacherId, facts, now: previewAt });
      const factsHash = digest(facts || null); const revision = row?.revision || 0;
      return { teacherId, ...plan, previewAt, factsHash, revision, token: tokenFor(teacherId, factsHash, revision, previewAt) };
    },
    async apply(request) {
      const by = await operator();
      const { strictKeys } = require('../membership-core/model');
      strictKeys(request, ['teacherId', 'previewAt', 'factsHash', 'revision', 'token']); id(request.teacherId);
      const expected = tokenFor(request.teacherId, request.factsHash, request.revision, request.previewAt);
      if (typeof request.token !== 'string' || request.token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(request.token), Buffer.from(expected))) throw Error('PREVIEW_REQUIRED');
      return repository.initializeTransaction(request.teacherId, async (row, transaction) => {
        if (row.initialization?.token === request.token) return { alreadyApplied: true, classification: row.initialization.classification };
        if (row.initialization?.state === 'ready') throw Error('ALREADY_INITIALIZED');
        const at = clock(); instant(request.previewAt);
        if (at < request.previewAt || at - request.previewAt > 300000 || row.revision !== request.revision) throw Error('PREVIEW_STALE');
        const facts = await getFacts(request.teacherId, transaction);
        if(candidate(request.teacherId,facts))throw Error('NATIVE_FIRST_OPEN_REQUIRED');
        if (digest(facts || null) !== request.factsHash) throw Error('FACTS_CHANGED');
        const plan = planInitialization({ teacherId: request.teacherId, facts, now: at });
        if (row.grants?.length || row.access) throw Error('EXISTING_LEDGER_REVIEW_REQUIRED');
        row.grants = plan.grants; row.access = plan.access;
        row.initialization = { state: plan.classification === 'review' ? 'review' : 'ready', classification: plan.classification,
          reason: plan.reason, factsHash: request.factsHash, policy:'personal-transition-v2', token: request.token, operator: by, at };
        const sources = plan.grants.length ? plan.grants.map(g => g.sourceId) : [`initialize_${request.factsHash}`];
        row.audits ||= [];
        for (const source of sources) {
          const auditId=digest({ teacherId: request.teacherId, action: 'initialize', source });
          if(row.audits.some(a=>a.auditId===auditId))continue;
          row.audits.push({ auditId,
          teacherId: request.teacherId, operator: by, actionType: 'membership_initialize', source, reference: source,
          before: null, after: { classification: plan.classification, grantIds: plan.grants.map(g => g.grantId), access: plan.access },
          reason: plan.reason || 'Protected migration evidence', evidenceHash: request.factsHash, createdAt: at, schemaVersion: 1 });
        }
        return { alreadyApplied: false, classification: plan.classification };
      });
    }
  };
}
module.exports = { planInitialization, createInitializationService, digest };
