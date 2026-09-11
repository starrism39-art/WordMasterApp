'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {planInitialization}=require('../cloudfunctions/membership-business/initialization');
const {isLegacyCandidate}=require('../cloudfunctions/membership-business/personal-transition');
const [input,output]=process.argv.slice(2);if(!input||!output||fs.existsSync(output))throw Error('INPUT_AND_NEW_OUTPUT_REQUIRED');
const snapshot=JSON.parse(fs.readFileSync(input,'utf8'));
if(!Array.isArray(snapshot.teachers)||!Array.isArray(snapshot.students))throw Error('SNAPSHOT_REQUIRED');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const groups=new Map();for(const t of snapshot.teachers){const key=t.teacher_id||'MISSING_'+t._id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
const rows=[];
for(const [teacherId,copies] of groups){
 const studentDocs=snapshot.students.filter(s=>s.teacher_id===teacherId);
 const evidence=(snapshot.evidence||[]).find(e=>e.teacherId===teacherId);
 const initialized=(snapshot.ledgers||[]).find(row=>row.teacherId===teacherId&&row.initialization?.state==='ready'&&!row._stage5);
 let plan={classification:'review',reason:'TRUSTED_CLASSIFICATION_EVIDENCE_REQUIRED'};
 if(initialized&&['historical','gift','long-term','transition','free','legacy_free_candidate'].includes(initialized.initialization.classification))
  plan={classification:initialized.initialization.classification,reason:'ALREADY_INITIALIZED',alreadyInitialized:true};
 else if(isLegacyCandidate(teacherId)&&!evidence?.sources?.length&&evidence?.review!==true)
  plan={classification:'legacy_free_candidate',reason:'APPROVED_LEGACY_COHORT_FIRST_OPEN_PENDING'};
 else if(evidence){
  // Classification must use the same document bindings as the server adapter,
  // never an evidence object's unverified copy of student facts.
  const bound=[];let conflict=false;
  for(const ref of evidence.studentRefs||[]){
   const doc=studentDocs.find(s=>s._id===ref.docId);
   if(!doc||String(doc.student_id||doc.id)!==ref.studentId){conflict=true;continue;}
   bound.push({teacherId,studentId:ref.studentId,name:doc.name||'',grade:doc.grade||'',deleted:doc.deleted===true,docId:ref.docId});
  }
  if(studentDocs.some(doc=>!(evidence.studentRefs||[]).some(ref=>ref.docId===doc._id)))conflict=true;
  const students=[];
  for(const sid of new Set(bound.map(s=>s.studentId))){
   const matches=bound.filter(s=>s.studentId===sid),primary=matches.find(s=>s.docId===sid)||matches[0];
   if(matches.length>1&&(!matches.some(s=>s.docId===sid)||matches.some(s=>s.name!==primary.name||s.grade!==primary.grade||s.deleted!==primary.deleted)))conflict=true;
   students.push(primary);
  }
  try{plan=planInitialization({teacherId,facts:{...evidence,students,conflict:conflict||evidence.conflict},now:snapshot.asOf});}
  catch{plan={classification:'review',reason:'INVALID_SNAPSHOT_TIME'};}
 }
 rows.push({teacherFingerprint:hash(teacherId).slice(0,12),teacherDocumentCount:copies.length,
  studentDocumentCount:studentDocs.length,uniqueStudentIds:new Set(studentDocs.map(s=>s.student_id||s.id)).size,
  classification:plan.classification,reason:plan.reason,sourceKinds:plan.sourceKinds||[],alreadyInitialized:plan.alreadyInitialized===true,
  transitionStartedAt:null,duplicateTeacherDocuments:copies.length>1});
}
const counts={historical:0,gift:0,'long-term':0,legacy_free_candidate:0,free:0,review:0};rows.forEach(r=>counts[r.classification]++);
const report={asOf:snapshot.asOf,readOnly:true,policy:'personal-transition-v2',inputTeacherRows:snapshot.teachers.length,
 uniqueTeachers:rows.length,initializedTeachers:rows.filter(r=>r.alreadyInitialized).length,counts,rows,sourceRequestIds:snapshot.requestIds||[],snapshotSha256:hash(fs.readFileSync(input)),
 note:'Approved legacy cohort is candidate, not permanent free. Five days start once at each teacher first enabled native open. Preview writes nothing.'};
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output,uniqueTeachers:rows.length,counts}));
