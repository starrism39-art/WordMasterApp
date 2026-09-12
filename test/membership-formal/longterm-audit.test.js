'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createGrantOperations}=require('../../cloudfunctions/membership-ops/grants');
const {canonical}=require('../../cloudfunctions/membership-core/model');
const now=1789216951140;
function fixture(){
 const rows=new Map();
 const get=async(role,key)=>structuredClone(rows.get(role+'/'+key)||null);
 const repository={get,async transaction(fn){const staged=new Map(structuredClone([...rows]));const result=await fn({get:async(r,k)=>structuredClone(staged.get(r+'/'+k)||null),put:async(r,k,v)=>staged.set(r+'/'+k,structuredClone(v))});rows.clear();for(const [k,v] of staged)rows.set(k,v);return result;}};
 const ops=createGrantOperations({repository,clock:()=>now,operator:'role_test_operator',previewKey:'test_only_preview_key_'.repeat(3),resolveTeacher:async()=>{}});
 const request={kind:'longTerm',teacherId:'teacher_test',requestId:'role_longterm_1',reason:'Synthetic audit regression',startsAt:now};
 return {rows,repository,ops,request};
}
test('long-term grant on an existing ledger persists independent audit atomically',async()=>{
 const f=fixture();f.rows.set('ledgers/teacher_test',{teacherId:'teacher_test',revision:5,grants:[],access:null,audits:[],operations:{}});
 const p=await f.ops.preview(f.request);const result=await f.ops.apply({request:f.request,previewAt:p.previewAt,revision:p.revision,token:p.token});
 const row=await f.repository.get('ledgers','teacher_test'),a=row.audits[0];
 assert.equal(row.grants.length,1);assert.equal(row.account.longTerm,true);assert.equal(result.account.status,'long_term');
 assert.deepEqual(await f.repository.get('audits',a.auditId),a);
});
test('same request repairs absent independent audit from ledger without new grant or revision',async()=>{
 const f=fixture(),p=await f.ops.preview(f.request),input={request:f.request,previewAt:p.previewAt,revision:p.revision,token:p.token};
 await f.ops.apply(input);const row=await f.repository.get('ledgers','teacher_test'),a=row.audits[0];f.rows.delete('audits/'+a.auditId);
 const before=canonical(await f.repository.get('ledgers','teacher_test'));await f.ops.apply({...input,previewAt:0,token:'expired_replay'});
 assert.equal(canonical(await f.repository.get('ledgers','teacher_test')),before);assert.deepEqual(await f.repository.get('audits',a.auditId),a);
 const count=f.rows.size;await f.ops.apply(input);assert.equal(f.rows.size,count);
});
test('audit replay rejects conflicting record and never fabricates missing ledger audit',async()=>{
 const f=fixture(),p=await f.ops.preview(f.request),input={request:f.request,previewAt:p.previewAt,revision:p.revision,token:p.token};await f.ops.apply(input);
 const row=await f.repository.get('ledgers','teacher_test'),a=row.audits[0];f.rows.set('audits/'+a.auditId,{...a,reason:'conflict'});
 await assert.rejects(f.ops.apply(input),/OPS_AUDIT_CONFLICT/);
 f.rows.set('ledgers/teacher_test',{...row,audits:[]});await assert.rejects(f.ops.apply(input),/OPS_AUDIT_REQUIRED/);
});
