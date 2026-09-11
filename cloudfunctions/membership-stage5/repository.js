'use strict';
const { createCloudbaseRepository } = require('../membership-payment/repository');
const { hash } = require('../membership-payment/crypto');
const { check } = require('../membership-payment/protocol');
const { id, canonical } = require('../membership-core/model');
const { initializeAccess } = require('../membership-core/access');
const { rebuildAccount } = require('../membership-core/ledger');
const { COLLECTIONS } = require('./policy');

function createStage5Repository(db, policy, options = {}) {
  check(policy?.collections === COLLECTIONS && policy.scopeId, 'STAGE5_POLICY_REQUIRED');
  check(db && typeof db.startTransaction === 'function' && typeof db.collection === 'function', 'STAGE5_DATABASE_REQUIRED');
  const base = createCloudbaseRepository(db, { ...options, collectionNames:COLLECTIONS, dueFilter:{'_stage5.scopeId':policy.scopeId} });
  function key(role, logical) {
    check(Object.hasOwn(COLLECTIONS,role),'INVALID_COLLECTION'); id(logical);
    // Real claims have no batch component. Synthetic namespaces never share them.
    return hash(role === 'claims' ? {role,appId:policy.config.appId,offerId:policy.config.offerId,env:policy.config.env,source:policy.config.source,key:logical}
      : {role,scopeId:policy.scopeId,key:logical});
  }
  function validate(role, row) {
    check(row && typeof row === 'object' && !Array.isArray(row), 'STAGE5_INVALID_RECORD');
    if (row.teacherId !== undefined) policy.teacher(row.teacherId);
    if (row.openId !== undefined) policy.teacher(row.openId);
    if (role === 'products') policy.product(row);
    if (role === 'orders') policy.order(row);
    if (role === 'claims') {
      policy.real(); check(row.appId === policy.config.appId && row.env === policy.config.env && typeof row.transactionId === 'string', 'STAGE5_INVALID_CLAIM');
    }
    if (role === 'grants' && row.sourceType === 'payment') policy.real();
    if (role === 'ledgers') {
      policy.teacher(row.teacherId);
      for (const g of row.grants || []) { check(g.teacherId === row.teacherId,'STAGE5_OWNER_MISMATCH'); if(g.sourceType === 'payment') policy.real(); }
      for (const s of row.students || []) check(s.teacherId === row.teacherId,'STAGE5_OWNER_MISMATCH');
    }
  }
  function unpack(role, raw, validateRow = validate) {
    if (!raw) return null;
    const {_stage5:stamp,...row}=raw;
    check(stamp?.testOnly === true && stamp.appId === policy.config.appId && stamp.cloudEnvId === policy.config.cloudEnvId && stamp.offerId === policy.config.offerId && stamp.paymentEnv === policy.config.env && stamp.source === policy.config.source, 'STAGE5_SCOPE_MISMATCH');
    if (role !== 'claims') check(stamp.scopeId === policy.scopeId && stamp.batchId === policy.config.batchId,'STAGE5_SCOPE_MISMATCH');
    validateRow(role,row); return row;
  }
  function wrap(raw) {
    const get = async (role,logical) => unpack(role,await raw.get(role,key(role,logical)));
    async function store(role,logical,row) {
      validate(role,row); check(!Object.hasOwn(row,'_stage5'),'STAGE5_RESERVED_FIELD');
      if (row.orderId && !['orders','products'].includes(role)) {
        const order=await get('orders',row.orderId); check(order,'STAGE5_ORDER_REQUIRED');
      }
      if (role === 'claims') {
        const prior=await get(role,logical); check(!prior || prior.orderId === row.orderId,'TRANSACTION_ALREADY_BOUND');
      }
      await raw.put(role,key(role,logical),{...row,_stage5:policy.stamp});
    }
    async function put(role,logical,row) {
      if (role !== 'ledgers') return store(role,logical,row);
      check(logical === row.teacherId,'STAGE5_OWNER_MISMATCH');
      const before=await get('ledgers',logical);
      await store(role,logical,row);
      if (row.access && canonical(before?.access || null) !== canonical(row.access)) await store('access',logical,row.access);
      for (const student of row.students || []) {
        const old=before?.students?.find(s=>s.studentId === student.studentId);
        if (!old || canonical(old) !== canonical(student)) await store('students',hash({teacherId:logical,studentId:student.studentId}),student);
      }
    }
    return {get,put};
  }
  return Object.freeze({
    // Only the fixed orders collection and current server scope are readable.
    // Payment/transaction paths continue using get(), including its real-domain gate.
    readOrder:async logical=>unpack('orders',await base.get('orders',key('orders',logical)),(_role,row)=>policy.orderRecord(row)),
    get:async(role,logical)=>unpack(role,await base.get(role,key(role,logical))),
    transaction:operation=>base.transaction(raw=>operation(wrap(raw))),
    async due(now,limit) {
      const jobs=(await base.due(now,limit)).map(row=>unpack('work',row));
      // Validate each task's persisted order before allowing an external query.
      for(const job of jobs) check(await this.get('orders',job.orderId),'STAGE5_ORDER_REQUIRED');
      return jobs;
    }
  });
}

// One ledger revision is the authority shared by payment and access; the other
// collections are transactionally maintained projections, not a parallel ledger.
function createLedgerRepository(repository,policy,clock=Date.now,{initializeEmpty=true}={}) {
  function complete(row,teacherId) {
    const now=clock(); const value=row || {teacherId,revision:0,grants:[],access:null};
    value.students ||= []; value.audits ||= []; value.operations ||= {};
    if(initializeEmpty) value.access ||= initializeAccess({teacherId,students:value.students,grants:value.grants,registeredAt:now,launchAt:policy.config.launchAt,now});
    value.account=rebuildAccount(teacherId,value.grants,value.access,now);
    return value;
  }
  return {
    async read(teacherId) { policy.teacher(teacherId); return complete(await repository.get('ledgers',teacherId),teacherId); },
    transaction(teacherId,operation) {
      policy.teacher(teacherId);
      return repository.transaction(async tx=>{
        const persisted=await tx.get('ledgers',teacherId);
        const row=complete(persisted && structuredClone(persisted),teacherId);
        const before=canonical(row); const result=await operation(row);
        if (!persisted || canonical(row) !== before) {
          row.revision++; row.account=rebuildAccount(teacherId,row.grants,row.access,clock());
          for(const grant of row.grants) if(!persisted?.grants?.some(g=>canonical(g)===canonical(grant))) await tx.put('grants',grant.grantId,grant);
          for(const audit of row.audits) if(!persisted?.audits?.some(a=>a.auditId===audit.auditId)) await tx.put('audits',audit.auditId,audit);
          await tx.put('ledgers',teacherId,row); await tx.put('accounts',teacherId,row.account);
        }
        return result;
      });
    }
  };
}
module.exports={createStage5Repository,createLedgerRepository};
