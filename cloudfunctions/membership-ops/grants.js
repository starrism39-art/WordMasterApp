'use strict';
const {id,reason,strictKeys,grant,canonical}=require('../membership-core/model');
const {instant,addDuration,validateDuration}=require('../membership-core/time');
const {normalizeLedger,rebuildAccount}=require('../membership-core/ledger');
const {hash,hmac,equal}=require('../membership-payment/crypto');
const {ledgerAdapter}=require('./repository');
function createGrantOperations({repository,clock,operator,previewKey,resolveTeacher}) {
  const ledger=ledgerAdapter(repository,clock);
  function entry(r,at) {
    strictKeys(r,['kind','teacherId','requestId','reason','paidAt','amount','paymentReference','evidence','timePrecision','timeBasis','startsAt','duration','targetGrantId','operation']);
    id(r.teacherId);id(r.requestId);reason(r.reason);
    const sourceTypes={historical:'historical_payment',gift:'gift',longTerm:'internal_long_term',adjustment:'admin_adjustment'};
    if(!Object.hasOwn(sourceTypes,r.kind))throw Error('INVALID_GRANT_KIND');
    let startsAt=r.startsAt,duration=r.duration,metadata={},longTerm=false,operation='grant';
    let sourceId=`ops_${r.kind}_${hash({teacherId:r.teacherId,requestId:r.requestId})}`;
    if(r.kind==='historical') {
      id(r.paymentReference);reason(r.evidence);instant(r.paidAt);
      if(r.paidAt>at || !Number.isSafeInteger(r.amount)||r.amount<=0 || !['exact','date_only'].includes(r.timePrecision))throw Error('HISTORY_EVIDENCE_REQUIRED');
      if(r.timePrecision==='date_only')reason(r.timeBasis);
      if(r.duration!==undefined||r.startsAt!==undefined||r.operation!==undefined||r.targetGrantId!==undefined)throw Error('UNEXPECTED_FIELDS');
      startsAt=r.paidAt;duration={months:12};sourceId=`historical_${hash(r.paymentReference)}`;
      metadata={paidAt:r.paidAt,amount:r.amount,evidence:r.evidence,paymentReference:r.paymentReference,timePrecision:r.timePrecision,...r.timeBasis?{timeBasis:r.timeBasis}:{}};
    } else {
      if(['paidAt','amount','paymentReference','evidence','timePrecision','timeBasis'].some(k=>r[k]!==undefined))throw Error('UNEXPECTED_FIELDS');
      instant(startsAt);
      if(r.kind==='longTerm'){if(duration!==undefined||r.operation!==undefined||r.targetGrantId!==undefined)throw Error('UNEXPECTED_FIELDS');longTerm=true;duration=null;}
      else if(r.kind==='adjustment') {
        if(!['grant','revoke_remaining'].includes(r.operation))throw Error('INVALID_ADJUSTMENT');
        operation=r.operation;if(startsAt>at)throw Error('FUTURE_ADJUSTMENT');
        if(operation==='revoke_remaining'){id(r.targetGrantId);if(duration!==undefined)throw Error('UNEXPECTED_FIELDS');duration=null;}
        else {if(r.targetGrantId!==undefined)throw Error('UNEXPECTED_FIELDS');validateDuration(duration);}
      }else{if(r.operation!==undefined||r.targetGrantId!==undefined)throw Error('UNEXPECTED_FIELDS');validateDuration(duration);}
    }
    return grant({teacherId:r.teacherId,sourceId,sourceType:sourceTypes[r.kind],grantId:`grant_${hash({teacherId:r.teacherId,sourceId})}`,startsAt,duration,longTerm,operation,
      endsAt:longTerm||operation==='revoke_remaining'?null:addDuration(startsAt,duration),status:'recorded',createdAt:at,updatedAt:at,metadata,reason:r.reason,...r.targetGrantId?{targetGrantId:r.targetGrantId}:{}});
  }
  function project(row,candidate,at) {
    const before=rebuildAccount(row.teacherId,row.grants,row.access,at);
    const after=rebuildAccount(row.teacherId,[...row.grants,candidate],row.access,at);
    if(candidate.sourceType==='historical_payment') {
      // Backfill never silently reflows an existing award or revives expired history.
      const p=after.periods.find(x=>x.grantId===candidate.grantId);
      if(p.startsAt!==candidate.startsAt || p.endsAt!==candidate.endsAt || before.periods.some(x=>canonical(x)!==canonical(after.periods.find(y=>y.grantId===x.grantId))))throw Error('HISTORY_CONFLICT_REQUIRES_REVIEW');
    }
    return {before,after};
  }
  async function review(r,code) {
    const key=`review_${hash({teacherId:r.teacherId,requestId:r.requestId})}`;
    await repository.transaction(async tx=>{
      const old=await tx.get('operations',key);if(old){if(old.requestHash!==hash(r))throw Error('IDEMPOTENCY_CONFLICT');return;}
      const row={kind:'historical_review',teacherId:r.teacherId,requestId:r.requestId,requestHash:hash(r),request:r,code,state:'review',operator,reason:r.reason,createdAt:clock()};
      await tx.put('operations',key,row);await tx.put('audits',key,{...row,action:'historical_review'});
    });return {state:'review',code,reviewId:key};
  }
  return {
    async preview(r){
      id(r.teacherId);id(r.requestId);reason(r.reason);
      try{
        await resolveTeacher(r.teacherId);const at=clock(),candidate=entry(r,at),row=await ledger.read(r.teacherId);
        const old=row.operations[`ops_${candidate.sourceId}`];
        if(old){if(old.hash!==hash({...r,requestId:undefined}))throw Error('IDEMPOTENCY_CONFLICT');return {state:'applied',...old.result};}
        const claim=r.kind==='historical'?await repository.get('operations',candidate.sourceId):null;
        if(claim)throw Error('HISTORICAL_PAYMENT_ALREADY_BOUND');
        const projection=project(row,candidate,at),body={request:r,revision:row.revision,previewAt:at};
        return {state:'ready',...projection,previewAt:at,revision:row.revision,token:hmac(previewKey,canonical(body))};
      }catch(e){if(r.kind==='historical'&&['HISTORY_EVIDENCE_REQUIRED','REASON_REQUIRED','INVALID_time','INVALID_id','TEACHER_IDENTITY_REQUIRED','HISTORY_CONFLICT_REQUIRES_REVIEW','HISTORICAL_PAYMENT_ALREADY_BOUND'].includes(e.message))return review(r,e.message);throw e;}
    },
    async apply(input){
      strictKeys(input,['request','previewAt','revision','token']);const r=input.request;
      await resolveTeacher(id(r.teacherId));const at=clock(),candidate=entry(r,at),fingerprint=hash({...r,requestId:undefined});
      return ledger.transaction(r.teacherId,async(row,tx)=>{
        const key=`ops_${candidate.sourceId}`,old=row.operations[key];
        if(old){
          if(old.hash!==fingerprint)throw Error('IDEMPOTENCY_CONFLICT');
          // Repair only this operation's already committed ledger audit. A replay
          // must not grant again or invent a missing original audit.
          const audit=row.audits.find(a=>a.auditId===key);
          if(!audit)throw Error('OPS_AUDIT_REQUIRED');
          const stored=await tx.get('audits',key);
          if(stored&&canonical(stored)!==canonical(audit))throw Error('OPS_AUDIT_CONFLICT');
          if(!stored)await tx.put('audits',key,audit);
          return old.result;
        }
        instant(input.previewAt);
        if(input.previewAt>at||at-input.previewAt>300000||input.revision!==row.revision||!equal(hmac(previewKey,canonical({request:r,revision:row.revision,previewAt:input.previewAt})),input.token))throw Error('PREVIEW_STALE_OR_MISSING');
        const {before,after}=project(row,candidate,at);
        if(r.kind==='historical'){
          if(await tx.get('operations',candidate.sourceId))throw Error('HISTORICAL_PAYMENT_ALREADY_BOUND');
          await tx.put('operations',candidate.sourceId,{kind:'historical_claim',teacherId:r.teacherId,grantId:candidate.grantId,requestHash:fingerprint,createdAt:at});
        }
        row.grants=normalizeLedger(r.teacherId,[...row.grants,candidate]);
        const result={grantId:candidate.grantId,account:after};row.operations[key]={hash:fingerprint,result};
        row.audits.push({auditId:key,action:r.kind,teacherId:r.teacherId,operator,reason:r.reason,requestId:r.requestId,source:candidate.sourceType,grantId:candidate.grantId,before,after,createdAt:at});
        return result;
      });
    }
  };
}
module.exports={createGrantOperations};
