'use strict';
const {id}=require('../membership-core/model');
const {digest}=require('./initialization');
const crypto=require('node:crypto');
const KEY='legacy_eligibility_release_v1';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function validate(snapshot){
 if(!snapshot||snapshot.state!=='sealed'||snapshot.policy!==KEY||!Array.isArray(snapshot.teacherHashes)||
  snapshot.digest!==digest(snapshot.teacherHashes))throw Error('LEGACY_SNAPSHOT_REQUIRED');
 return snapshot;
}
async function eligible(tx,teacherId){
 return validate(await tx.get('evidence',KEY)).teacherHashes.includes(hash(id(teacherId)));
}
// Server-only source: enumerate stored teacher identities, never client dates,
// entitlement flags, student counts or a caller-supplied teacher list.
async function readTeachers(db){
 const rows=[];let offset=0;
 while(true){
  const r=await db.collection('teachers').orderBy('_id','asc').skip(offset).limit(100).get();
  if(!Array.isArray(r.data))throw Error('TEACHER_SOURCE_UNAVAILABLE');
  rows.push(...r.data);if(r.data.length<100)return rows;
  offset+=100;if(offset>=10000)throw Error('LEGACY_SNAPSHOT_CAPACITY');
 }
}
function cohort(rows){
 return [...new Set(rows.map(row=>{
  const owner=id(row.teacher_id);
  if((row._openid&&row._openid!==owner)||(row.openid&&row.openid!==owner))throw Error('TEACHER_IDENTITY_CONFLICT');
  return hash(owner);
 }))].sort();
}
function createLegacyEligibility({repository,getTeachers,clock=Date.now}){
 const base=repository.base;
 const result=s=>({policy:s.policy,state:s.state,capturedAt:s.capturedAt,count:s.teacherHashes.length,digest:s.digest});
 return {async capture(operator){
  id(operator);
  const previous=await base.get('evidence',KEY);
  if(previous)return result(validate(previous));
  const first=cohort(await getTeachers()),second=cohort(await getTeachers());
  // Fail instead of sealing a moving paginated source. Release capture should
  // run with teacher registration quiesced; retries never append to a seal.
  if(digest(first)!==digest(second))throw Error('TEACHER_SOURCE_CHANGED_RETRY');
  const snapshot={policy:KEY,state:'sealed',capturedAt:clock(),teacherHashes:first,digest:digest(first),operator,source:'teachers'};
  return base.transaction(async tx=>{
   const old=await tx.get('evidence',KEY);
   if(old)return result(validate(old));
   await tx.put('evidence',KEY,snapshot);
   return result(snapshot);
  });
 }};
}
module.exports={KEY,eligible,readTeachers,createLegacyEligibility};
