'use strict';
const {createCloudbaseRepository, COLLECTIONS: PAYMENT}=require('../membership-payment/repository');
const {id,canonical}=require('../membership-core/model');
const {rebuildAccount}=require('../membership-core/ledger');
const COLLECTIONS=Object.freeze({...PAYMENT,evidence:'membership_ops_evidence',operations:'membership_ops_requests'});
function validate(row,teacherId) {
  if(row && (row.teacherId!==teacherId || row._stage5 || !Array.isArray(row.grants) || row.grants.some(g=>g.teacherId!==teacherId||g._stage5))) throw Error('FORMAL_LEDGER_MISMATCH');
  return row;
}
function createOpsRepository(db) {
  const base=createCloudbaseRepository(db,{collectionNames:COLLECTIONS});
  return {...base,async list(role,filter,offset=0,limit=20) {
    if(!['orders','audits','operations'].includes(role))throw Error('INVALID_COLLECTION');
    const r=await db.collection(COLLECTIONS[role]).where(filter).orderBy('_id','asc').skip(offset).limit(limit).get();
    return r.data.map(({_id,...row})=>row);
  }};
}
// Only membership projections are writable. Never initialize access, transition,
// student references, migration facts, or legacy teacher/profile documents.
function ledgerAdapter(base,clock) {
  const complete=(row,teacherId)=>({...validate(row,teacherId)||{teacherId,revision:0,grants:[],access:null},audits:row?.audits||[],operations:row?.operations||{}});
  return {
    async read(teacherId){id(teacherId);return complete(await base.get('ledgers',teacherId),teacherId);},
    transaction(teacherId,operation){id(teacherId);return base.transaction(async tx=>{
      const persisted=await tx.get('ledgers',teacherId),row=complete(persisted,teacherId),before=canonical(row);
      const result=await operation(row,tx);
      if(canonical(row)!==before){
        validate(row,teacherId);row.revision++;row.account=rebuildAccount(teacherId,row.grants,row.access,clock());
        for(const g of row.grants){const old=persisted?.grants.find(x=>x.grantId===g.grantId);if(old&&canonical(old)!==canonical(g))throw Error('EXISTING_GRANT_IMMUTABLE');if(!old)await tx.put('grants',g.grantId,g);}
        for(const a of row.audits)if(!persisted?.audits?.some(x=>x.auditId===a.auditId))await tx.put('audits',a.auditId,a);
        await tx.put('ledgers',teacherId,row);await tx.put('accounts',teacherId,row.account);
      }
      return result;
    });}
  };
}
module.exports={COLLECTIONS,validate,createOpsRepository,ledgerAdapter};
