'use strict';
const {id}=require('../membership-core/model');
const {digest}=require('./initialization');
async function previewBatch(service,teacherIds){
 teacherIds.forEach(x=>id(x));
 const unique=[...new Set(teacherIds)].sort(),rows=[];
 for(const teacherId of unique)rows.push(await service.preview(teacherId));
 const counts={historical:0,gift:0,'long-term':0,legacy_free_candidate:0,free:0,review:0};
 for(const row of rows)counts[row.classification]=(counts[row.classification]||0)+1;
 return {rows,counts,inputRows:teacherIds.length,uniqueTeachers:unique.length,duplicates:teacherIds.length-unique.length,
  digest:digest(rows),requiresHumanMigrationApproval:true};
}
async function applyApprovedBatch(service,preview,approvedDigest){
 // A caller must provide the exact reviewed manifest. Never silently import a
 // newly changed preview, skip a failed teacher, or convert review into free.
 if(!approvedDigest||approvedDigest!==preview.digest||digest(preview.rows)!==approvedDigest)throw Error('APPROVED_PREVIEW_REQUIRED');
 if(preview.rows.some(r=>r.classification==='review'))throw Error('UNRESOLVED_REVIEW');
 if(preview.rows.some(r=>r.firstOpenPending||r.classification==='legacy_free_candidate'))throw Error('NATIVE_FIRST_OPEN_REQUIRED');
 const completed=[];
 for(const row of preview.rows){
  if(row.alreadyInitialized){completed.push({teacherId:row.teacherId,alreadyInitialized:true});continue;}
  const request=Object.fromEntries(['teacherId','previewAt','factsHash','revision','token'].map(k=>[k,row[k]]));
  try{completed.push({teacherId:row.teacherId,...await service.apply(request)});}
  catch(error){return {complete:false,completed,failedTeacher:row.teacherId,code:error.message};}
 }
 return {complete:true,completed};
}
module.exports={previewBatch,applyApprovedBatch};
