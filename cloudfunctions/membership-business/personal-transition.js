'use strict';
const crypto=require('node:crypto');
const {id,canonical}=require('../membership-core/model');
const {initializeAccess}=require('../membership-core/access');
const {rebuildAccount}=require('../membership-core/ledger');
const {DAY}=require('../membership-core/time');
const {digest,planInitialization}=require('./initialization');
const roster=require('./legacy-candidates.json');
const fingerprint=teacherId=>crypto.createHash('sha256').update(teacherId).digest('hex');
const isLegacyCandidate=teacherId=>roster.teacherHashes.includes(fingerprint(teacherId));
const POLICY='personal-transition-v2';

function bindStudents(teacherId,docs){
 const students=[],refs={},aliases={};
 for(const sid of new Set(docs.map(d=>String(d.student_id||d.id||'')))){
  id(sid);const copies=docs.filter(d=>String(d.student_id||d.id||'')===sid);
  if(copies.some(d=>d.teacher_id!==teacherId))throw Error('STUDENT_OWNERSHIP_CONFLICT');
  const primary=copies.find(d=>d._id===sid)||copies[0];
  if(copies.some(d=>d.name!==primary.name||d.grade!==primary.grade||!!d.deleted!==!!primary.deleted))throw Error('STUDENT_PROFILE_REVIEW_REQUIRED');
  refs[sid]=id(primary._id);aliases[sid]=copies.filter(d=>d!==primary).map(d=>id(d._id));
  students.push({teacherId,studentId:sid,name:primary.name||'',grade:primary.grade||'',deleted:primary.deleted===true,...(primary.joinDate!==undefined?{joinDate:primary.joinDate}:{})});
 }
 return {students,studentRefs:refs,studentAliases:aliases};
}
function createPersonalTransition({repository,getStudents,isLegacy,clock=Date.now,previewKey}){
 const base=repository.base;
 const summary=row=>({classification:row.initialization.classification,transitionStartedAt:row.transitionStartedAt??null,
  transitionEndsAt:row.access?.transitionEndsAt??null,policy:row.initialization.policy||'existing',membershipStatus:row.account?.status});
 async function write(tx,row){
  row.revision=(row.revision||0)+1;
  row.account=row.initialization.classification==='review'?{teacherId:row.teacherId,status:'review',updatedAt:clock()}:rebuildAccount(row.teacherId,row.grants,row.access,clock());
  await tx.put('ledgers',row.teacherId,row);await tx.put('accounts',row.teacherId,row.account);
  if(row.access)await tx.put('access',row.teacherId,row.access);
 }
 function audit(row,action,source,details){
  const a={auditId:digest({teacherId:row.teacherId,action,source}),teacherId:row.teacherId,operator:row.teacherId,actionType:action,
   source,reference:source,reason:POLICY,before:null,after:details,createdAt:clock(),schemaVersion:1};
  row.audits.push(a);return a;
 }
 async function open(teacherId){
  id(teacherId);
  // Read-only preview never calls open. An enabled native client is the only
  // production caller; the native OPENID, not request data, selects the ledger.
  const existing=await base.get('ledgers',teacherId);
  const docs=existing?.initialization?.state==='ready'?[]:await getStudents(teacherId);
  return base.transaction(async tx=>{
   const old=await tx.get('ledgers',teacherId);
   if(old?._stage5||old&&old.teacherId!==teacherId)throw Error('FORMAL_LEDGER_MISMATCH');
   const proof=await tx.get('evidence',teacherId);
   if(proof&&(proof.teacherId!==teacherId||proof._stage5))throw Error('FORMAL_EVIDENCE_MISMATCH');
   const legacy=isLegacy?await isLegacy(teacherId):await require('./legacy-eligibility').eligible(tx,teacherId);
   function start(row){
    if(!legacy||row.transitionStartedAt!=null)return false;
    const at=row.access.transitionStartedAt??row.access.transitionStartsAt??clock();
    row.transitionStartedAt=at;
    Object.assign(row.access,{transitionStartedAt:at,transitionStartsAt:at,transitionEndsAt:at+5*DAY,
     transitionStudentIds:row.students.filter(s=>!s.deleted).map(s=>s.studentId)});
    return true;
   }
   if(old?.initialization?.state==='ready'){
    if(start(old)){
     const a=audit(old,'membership_first_new_version_open',POLICY,{classification:old.initialization.classification,transitionStartedAt:old.transitionStartedAt});
     await write(tx,old);await tx.put('audits',a.auditId,a);
    }
    if(old.initialization.classification==='legacy_free_candidate'&&clock()>=old.access.transitionEndsAt){
     const pending=await tx.get('evidence',teacherId);
     if(pending?.review===true||pending?.sources?.length)return {...summary(old),classification:'review',identityOverridePending:true};
     old.initialization.classification='free';
     const a=audit(old,'legacy_candidate_closed','personal_transition_end',{transitionStartedAt:old.transitionStartedAt});
     await write(tx,old);await tx.put('audits',a.auditId,a);
    }
    return summary(old);
   }
   if(old?.grants?.length||old?.access)throw Error('EXISTING_LEDGER_REVIEW_REQUIRED');
   if(!legacy&&(proof?.review===true||proof?.sources?.length))throw Error('PROTECTED_IDENTITY_INITIALIZATION_REQUIRED');
   const checked=[];
   for(const doc of docs){
    const current=await tx.get('students',id(doc._id));
    const {_id,...expected}=doc;
    if(!current||canonical(current)!==canonical(expected))throw Error('STUDENT_SNAPSHOT_CHANGED');
    checked.push({...current,_id:doc._id});
   }
   const at=clock(),bound=bindStudents(teacherId,checked);
   const access=initializeAccess({teacherId,students:bound.students,grants:[],registeredAt:at,launchAt:at,now:at,
    reliablePriorConsumption:bound.students.length>0||(proof?.consumed===true&&proof?.consumptionEvidence?.verified===true&&!!proof?.consumptionEvidence?.operator&&!!proof?.consumptionEvidence?.reference)});
   if(legacy)Object.assign(access,{transitionStartedAt:at,transitionStartsAt:at,transitionEndsAt:at+5*DAY,
    transitionStudentIds:bound.students.filter(s=>!s.deleted).map(s=>s.studentId)});
   const row={teacherId,revision:old?.revision||0,grants:[],access,...bound,audits:old?.audits||[],operations:old?.operations||{},
    transitionStartedAt:legacy?at:null,initialization:{state:'ready',classification:legacy?'legacy_free_candidate':'free',policy:POLICY,at,
     originClassification:legacy?'legacy_free_candidate':'free',source:legacy?'sealed_legacy_eligibility':'new_native_teacher'}};
   const a=audit(row,'membership_first_new_version_open',POLICY,{classification:row.initialization.classification,transitionStartedAt:row.transitionStartedAt});
   await write(tx,row);await tx.put('audits',a.auditId,a);
   return summary(row);
  });
 }
 const sign=value=>{if(typeof previewKey!=='string'||previewKey.length<32)throw Error('PREVIEW_KEY_REQUIRED');return crypto.createHmac('sha256',previewKey).update(canonical(value)).digest('hex');};
 async function overridePlan(tx,teacherId){
  const row=await tx.get('ledgers',teacherId),proof=await tx.get('evidence',teacherId);
  if(!row||row.teacherId!==teacherId||row._stage5||row.initialization?.state!=='ready')throw Error('INITIALIZATION_REQUIRED');
  if(!proof||proof.teacherId!==teacherId||proof._stage5)throw Error('PROTECTED_EVIDENCE_REQUIRED');
  if(proof.review===true)return {row,proof,classification:'review',grants:[]};
  const serverEvidence={verified:true,operator:'server',reference:'native_first_open'};
  const plan=planInitialization({teacherId,now:clock(),facts:{...proof,students:row.students,registeredAt:row.initialization.at,
   registrationEvidence:serverEvidence,classificationEvidence:proof.classificationEvidence}});
  if(!['historical','gift','long-term'].includes(plan.classification))throw Error('PROTECTED_SOURCE_REVIEW_REQUIRED');
  for(const g of plan.grants){const old=row.grants.find(x=>x.sourceId===g.sourceId);if(old){
   const strip=x=>{const {createdAt,updatedAt,...rest}=x;return rest;};
   if(canonical(strip(old))!==canonical(strip(g)))throw Error('SOURCE_CONFLICT');
  }}
  const classification=row.grants.some(g=>g.longTerm&&g.status==='recorded')?'long-term':plan.classification;
  return {row,proof,classification,grants:plan.grants.filter(g=>!row.grants.some(x=>x.sourceId===g.sourceId))};
 }
 async function previewOverride(teacherId){
  id(teacherId);const p=await overridePlan(base,teacherId),previewAt=clock();
  const manifest={teacherId,revision:p.row.revision,factsHash:digest(p.proof),previewAt};
  const account=rebuildAccount(teacherId,[...p.row.grants,...p.grants],p.row.access,previewAt);
  return {...manifest,token:sign(manifest),classification:p.classification,newGrants:p.grants.length,account};
 }
 async function applyOverride(request,operator){
  const {teacherId,revision,factsHash,previewAt,token}=request;id(teacherId);id(operator);
  const expected=sign({teacherId,revision,factsHash,previewAt});
  if(typeof token!=='string'||token.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected)))throw Error('PREVIEW_REQUIRED');
  return base.transaction(async tx=>{
   const p=await overridePlan(tx,teacherId),row=p.row;
   if(row.operations['identity_'+token])return row.operations['identity_'+token];
   if(clock()<previewAt||clock()-previewAt>300000||row.revision!==revision||digest(p.proof)!==factsHash)throw Error('PREVIEW_STALE');
   for(const g of p.grants){await tx.put('grants',g.grantId,g);row.grants.push(g);}
   // Grants and the consumed free slot survive identity corrections. In
   // particular a finite gift/backfill never replaces a long-term grant.
   row.initialization.classification=p.classification;
   const result={classification:p.classification,addedGrants:p.grants.length};row.operations['identity_'+token]=result;
   const a=audit(row,'membership_identity_override',factsHash,result);a.operator=operator;
   await write(tx,row);await tx.put('audits',a.auditId,a);return result;
  });
 }
 return {open,previewOverride,applyOverride};
}
module.exports={createPersonalTransition,bindStudents,isLegacyCandidate,POLICY};
