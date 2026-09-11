'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const at=Date.parse('2026-09-11T00:00:00Z'),e={verified:true,operator:'admin',reference:'LOCAL_ONLY'};
function preview(evidence){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'finala-preview-'));
 const input=path.join(dir,'in.json'),output=path.join(dir,'out.json');
 fs.writeFileSync(input,JSON.stringify({asOf:at,teachers:[{_id:'t',teacher_id:'t'}],students:[{_id:'s',student_id:'s',teacher_id:'t',name:'N'}],evidence:[evidence]}));
 execFileSync(process.execPath,[path.resolve(__dirname,'../../scripts/preview-membership-final-a.js'),input,output]);
 return JSON.parse(fs.readFileSync(output,'utf8'));
}
const evidence={teacherId:'t',registeredAt:at-1000,registrationEvidence:e,classificationEvidence:e,sources:[],studentRefs:[{docId:'s',studentId:'s'}]};
test('offline preview derives free slot classification from bound snapshot students',()=>{
 const result=preview(evidence);assert.equal(result.counts.free,1);assert.equal(result.rows[0].uniqueStudentIds,1);
});
test('offline preview cannot silently ignore existing students omitted by evidence',()=>{
 assert.equal(preview({...evidence,studentRefs:[]}).counts.review,1);
});
test('offline preview keeps invalid registration time in review instead of crashing or classifying free',()=>{
 assert.equal(preview({...evidence,registeredAt:at+1}).counts.review,1);
});
