'use strict';
const { createCloudbaseRepository } = require('../membership-payment/repository');
const { canonical, id } = require('../membership-core/model');
const { rebuildAccount } = require('../membership-core/ledger');
const { digest } = require('./initialization');
const COLLECTIONS = Object.freeze({ ledgers: 'membership_ledgers', grants: 'membership_grants', accounts: 'membership_accounts',
  access: 'teacher_student_access', audits: 'membership_admin_audit', evidence: 'membership_migration_evidence',
  students: 'students', sessions: 'membership_sessions' });
function createBusinessRepository(db, { clock = Date.now, targetStudentId, ...options } = {}) {
  const base = createCloudbaseRepository(db, { ...options, collectionNames: COLLECTIONS });
  function empty(teacherId) { return { teacherId, revision: 0, grants: [], access: null, students: [], studentRefs: {}, audits: [], operations: {} }; }
  function validate(row, teacherId) {
    if (row && (row.teacherId !== teacherId || row._stage5 || row.grants?.some(g => g.teacherId !== teacherId || g._stage5))) throw Error('FORMAL_LEDGER_MISMATCH');
    return row;
  }
  async function facts(teacherId, tx = base) {
    id(teacherId);
    const proof = await tx.get('evidence', teacherId);
    if (!proof || proof.teacherId !== teacherId || proof._stage5) return null;
    const students = [];
    for (const ref of proof.studentRefs || []) {
      id(ref.docId); id(ref.studentId);
      const doc = await tx.get('students', ref.docId);
      if (!doc || doc.teacher_id !== teacherId || String(doc.student_id || doc.id) !== ref.studentId) return { ...proof, conflict: true, students: [] };
      students.push({ teacherId, studentId: ref.studentId, name: doc.name || '', grade: doc.grade || '', deleted: doc.deleted === true,
        docId: ref.docId, sourceHash: digest(doc) });
    }
    const unique=[];
    for(const studentId of new Set(students.map(s=>s.studentId))) {
      const copies=students.filter(s=>s.studentId===studentId);
      if(copies.length===1){unique.push(copies[0]);continue;}
      const primary=copies.find(s=>s.docId===studentId);
      if(!primary||copies.some(s=>s.name!==primary.name||s.grade!==primary.grade||s.deleted!==primary.deleted))return {...proof,conflict:true,students:[]};
      // Legacy direct writes use doc(studentId). Bind that canonical document;
      // retain and hash the identical identity aliases instead of deleting them.
      unique.push({...primary,aliases:copies.filter(s=>s!==primary).map(s=>({docId:s.docId,sourceHash:s.sourceHash}))});
    }
    return { ...proof, students:unique };
  }
  async function load(tx, teacherId, initializing) {
    const persisted = validate(await tx.get('ledgers', teacherId), teacherId);
    if (!initializing && persisted?.initialization?.state !== 'ready') throw Error('MEMBERSHIP_INITIALIZATION_REQUIRED');
    const row = structuredClone(persisted || empty(teacherId));
    row.students ||= []; row.studentRefs ||= {}; row.audits ||= []; row.operations ||= {};
    const documents = new Map();
    for (const student of row.students) {
      // Production requests validate their target document in the same transaction.
      // Creation needs the lifetime slot, not a scan of every existing student.
      if (targetStudentId !== undefined && student.studentId !== targetStudentId) continue;
      const docId = row.studentRefs[student.studentId];
      if (!docId) throw Error('STUDENT_REFERENCE_REQUIRED');
      const doc = await tx.get('students', docId); documents.set(student.studentId, doc);
      // Existing deletion authority may have removed this document. Never recreate it.
      if (!doc || doc.deleted === true) student.deleted = true;
      else if (doc.teacher_id !== teacherId || String(doc.student_id || doc.id) !== student.studentId) throw Error('STUDENT_OWNERSHIP_CONFLICT');
      else {
        if((doc.name||'')!==student.name||(doc.grade||'')!==student.grade)throw Error('STUDENT_PROFILE_REVIEW_REQUIRED');
        if(doc.joinDate!==undefined)student.joinDate=doc.joinDate;
      }
    }
    return { row, persisted, documents };
  }
  async function transact(teacherId, operation, initializing = false) {
    id(teacherId);
    return base.transaction(async tx => {
      const { row, persisted, documents } = await load(tx, teacherId, initializing);
      const before = structuredClone(row);
      const result = await operation(row, tx);
      if (canonical(row) === canonical(before)) return result;
      validate(row, teacherId);
      // Initial migration binds existing documents only; it never rewrites them.
      if (!persisted?.initialization || persisted.initialization.state !== 'ready') {
        if (row.initialization?.state === 'ready') {
          const proof = await facts(teacherId, tx);
          if (!proof || digest(proof) !== row.initialization.factsHash) throw Error('FACTS_CHANGED');
          row.students = proof.students.map(({ docId, sourceHash, aliases, ...s }) => s);
          row.studentRefs = Object.fromEntries(proof.students.map(s => [s.studentId, s.docId]));
          row.studentAliases = Object.fromEntries(proof.students.filter(s=>s.aliases).map(s=>[s.studentId,s.aliases.map(a=>a.docId)]));
        }
      } else {
        for (const student of row.students) {
          const old = before.students.find(s => s.studentId === student.studentId);
          if (old && canonical(old) === canonical(student)) continue;
          if (old?.deleted || student.deleted) {
            if (old?.deleted && !student.deleted) throw Error('DELETED_STUDENT_CANNOT_RESTORE');
            if (!old?.deleted && student.deleted) throw Error('USE_EXISTING_DELETE_AUTHORITY');
            continue;
          }
          const docId = old ? row.studentRefs[student.studentId] : student.studentId;
          const doc = old ? documents.get(student.studentId) : await tx.get('students', docId);
          if (!old && doc) throw Error('STUDENT_ID_CONFLICT');
          if (old && !doc) throw Error('STUDENT_DELETED');
          row.studentRefs[student.studentId] = docId;
          await tx.put('students', docId, { ...(doc || {}), id: student.studentId, student_id: student.studentId,
            teacher_id: teacherId, _openid: teacherId, name: student.name, grade: student.grade,
            ...(student.joinDate!==undefined?{joinDate:student.joinDate}:{}),
            ...(doc ? {} : { createdAt: clock() }), updatedAt: clock() });
          for(const aliasId of row.studentAliases?.[student.studentId]||[]) {
            const alias=await tx.get('students',aliasId);
            if(!alias||alias.teacher_id!==teacherId||String(alias.student_id||alias.id)!==student.studentId||alias.name!==old.name||alias.grade!==old.grade)throw Error('STUDENT_ALIAS_REVIEW_REQUIRED');
            await tx.put('students',aliasId,{...alias,name:student.name,grade:student.grade,updatedAt:clock()});
          }
        }
      }
      row.revision++;
      if (row.initialization?.state === 'ready') row.account = rebuildAccount(teacherId, row.grants, row.access, clock());
      else row.account = { teacherId, status: 'review', updatedAt: clock(), schemaVersion: 1 };
      for (const g of row.grants) {
        const old = persisted?.grants?.find(p => p.grantId === g.grantId);
        if (old && canonical(old) !== canonical(g)) throw Error('EXISTING_GRANT_IMMUTABLE');
        if (!old) await tx.put('grants', g.grantId, g);
      }
      for (const a of row.audits) if (!persisted?.audits?.some(p => p.auditId === a.auditId)) await tx.put('audits', a.auditId, a);
      await tx.put('ledgers', teacherId, row); await tx.put('accounts', teacherId, row.account);
      if (row.access) await tx.put('access', teacherId, row.access);
      return result;
    });
  }
  return { facts,
    readForInitialization: async teacherId => validate(await base.get('ledgers', id(teacherId)), teacherId),
    initializeTransaction: (teacherId, operation) => transact(teacherId, operation, true),
    transaction: (teacherId, operation) => transact(teacherId, operation),
    read: teacherId => transact(teacherId, row => structuredClone(row)),
    base
  };
}
module.exports = { createBusinessRepository, COLLECTIONS };
