'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {setup,config}=require('./isolation-fixtures');
const {timerRequest,timerCapability,TRIGGER_NAME,INTERVAL_MS}=require('../../cloudfunctions/membership-stage5/timer');
const LOCAL_KEY='LOCAL_TEST_INTERNAL_KEY_32_BYTES_MINIMUM';
const defaultPolicy=require('../../cloudfunctions/membership-stage5/policy').createPolicy(config());
function event(extra={}){return {Type:'Timer',TriggerName:TRIGGER_NAME,Time:'2019-02-21T11:49:00Z',Message:timerCapability(LOCAL_KEY,defaultPolicy.scopeId),...extra};}
async function ready(){
 const s=await setup({purchaseEnabled:false,purchaseTeachers:[]});
 s.environment.STAGE5_SCHEDULE_ENABLED='true';
 s.context={SOURCE:'wx_trigger',ENV:s.policy.config.cloudEnvId};
 s.wxCloud.getWXContext=()=>s.context;
 return s;
}
test('trusted timer invokes existing bounded compensation while purchasing is closed',async()=>{
 const s=await ready();const result=await s.runtime.compensate(event());
 assert.deepEqual(result.reviews,[]);assert.ok(result.compensation);
 const entries=[...s.db.rows.values()].filter(row=>JSON.stringify(row).includes('internal_invocation'));
 assert.equal(entries.length,1);assert.equal(await s.repository.get('ledgers','teacher'),null);
});
for(const SOURCE of ['wx_client','wx_devtools','wx_http','wx_client,scf','wx_trigger,scf','',undefined])test('event impersonation cannot replace trusted source '+SOURCE,async()=>{
 const s=await ready();s.context.SOURCE=SOURCE;
 await assert.rejects(s.runtime.compensate(event({userInfo:{isAdmin:true},tcbContext:{SOURCE:'wx_trigger'}})),/STAGE5_TIMER_AUTH_REQUIRED/);
 assert.equal([...s.db.rows.values()].filter(row=>JSON.stringify(row).includes('internal_invocation')).length,0);
});
test('wrong environment and user-bearing context are rejected',async()=>{
 const s=await ready();s.context.ENV='other';await assert.rejects(s.runtime.compensate(event()),/STAGE5_TIMER_AUTH_REQUIRED/);
 s.context.ENV=s.policy.config.cloudEnvId;s.context.OPENID='LOCAL_FORGED';await assert.rejects(s.runtime.compensate(event()),/STAGE5_TIMER_AUTH_REQUIRED/);
});
test('schedule disabled or internal key absent fails closed',async()=>{
 const s=await ready();delete s.environment.STAGE5_SCHEDULE_ENABLED;await assert.rejects(s.runtime.compensate(event()),/STAGE5_SCHEDULE_DISABLED/);
 s.environment.STAGE5_SCHEDULE_ENABLED='true';delete s.environment.STAGE5_INTERNAL_KEY;await assert.rejects(s.runtime.compensate(event()),/STAGE5_SECRET_NOT_CONFIGURED/);
});
test('fixed name and authenticated message prevent arbitrary scan or review targets',async()=>{
 const s=await ready();for(const changes of [{TriggerName:'other'},{Message:'{"limit":999}'},{Type:'Other'},{teacherId:'second'},{reviewOrderIds:['other']}])
 await assert.rejects(s.runtime.compensate(event(changes)),/INVALID_TIMER_EVENT|UNEXPECTED_FIELDS|STAGE5_TIMER_CREDENTIAL_REQUIRED/);
});
test('same slot replay across reconstructed runtimes is rejected, next slot resumes',async()=>{
 const s=await ready();await s.runtime.compensate(event());
 const next=await setup({purchaseEnabled:false,purchaseTeachers:[]},s.db);
 next.environment.STAGE5_SCHEDULE_ENABLED='true';next.wxCloud.getWXContext=()=>s.context;
 await assert.rejects(next.runtime.compensate(event()),/INTERNAL_REPLAY_REJECTED/);
 next.state.now+=INTERVAL_MS;assert.ok((await next.runtime.compensate(event())).compensation);
});
test('timer envelope binds scope and fixed limit; never depends on event creation time',async()=>{
 const s=await ready();const args={context:s.context,policy:s.policy,environment:s.environment,clock:()=>s.state.now};
 const a=timerRequest({...args,event:event()});const b=timerRequest({...args,event:event({Time:'2026-09-10T00:00:00Z'})});
 assert.deepEqual(a,b);assert.deepEqual(JSON.parse(a.body),{limit:20});
 const other=await setup({batchId:'other_batch'});
 const c=timerRequest({...args,event:event({Message:timerCapability(LOCAL_KEY,other.policy.scopeId)}),policy:other.policy});assert.notEqual(c.signature,a.signature);assert.notEqual(c.nonce,a.nonce);
});
test('existing signed internal calls remain authenticated without enabling timer',async()=>{
 const s=await setup();assert.ok((await s.runtime.compensate(s.internal())).compensation);
 await assert.rejects(s.runtime.compensate({...s.internal(),signature:'forged'}),/INTERNAL_AUTH_REQUIRED/);
});
async function nativeReady(){
 const s=await ready();s.context={};
 Object.assign(s.environment,{TRIGGER_SRC:'timer',TENCENTCLOUD_RUNENV:'SCF',SCF_FUNCTIONNAME:'stage5_compensate',SCF_NAMESPACE:s.policy.config.cloudEnvId});
 return s;
}
test('native SCF timer uses provider runtime identity when WX context is empty',async()=>{
 const s=await nativeReady();assert.ok((await s.runtime.compensate(event())).compensation);
 await assert.rejects(s.runtime.compensate(event()),/INTERNAL_REPLAY_REJECTED/);
});
test('native timer permits matching provider timer source without WX context keys',async()=>{
 const s=await nativeReady();s.environment.TCB_SOURCE='wx_trigger';assert.ok((await s.runtime.compensate(event())).compensation);
});
for(const key of ['TRIGGER_SRC','TENCENTCLOUD_RUNENV','SCF_FUNCTIONNAME','SCF_NAMESPACE'])test('native timer missing provider '+key+' fails closed',async()=>{
 const s=await nativeReady();delete s.environment[key];await assert.rejects(s.runtime.compensate(event()),/STAGE5_TIMER_AUTH_REQUIRED/);
});
test('native timer cannot turn a client context into internal authority',async()=>{
 for(const changes of [{SOURCE:'wx_client'},{SOURCE:'wx_http'},{OPENID:'LOCAL_TEACHER'},{FROM_OPENID:'LOCAL_TEACHER'}]){
  const s=await nativeReady();s.context=changes;await assert.rejects(s.runtime.compensate(event()),/STAGE5_TIMER_AUTH_REQUIRED/);
 }
 const s=await nativeReady();s.environment.TCB_SOURCE='wx_client,scf';await assert.rejects(s.runtime.compensate(event()),/STAGE5_TIMER_AUTH_REQUIRED/);
});
test('client-supplied native runtime fields are not trusted',async()=>{
 const s=await ready();s.context={};
 await assert.rejects(s.runtime.compensate(event({TRIGGER_SRC:'timer',SCF_NAMESPACE:s.policy.config.cloudEnvId,SCF_FUNCTIONNAME:'stage5_compensate'})),/STAGE5_TIMER_AUTH_REQUIRED/);
});
for(const Message of ['',undefined,'0'.repeat(64)])test('native metadata without valid scheduler credential is rejected '+String(Message),async()=>{
 const s=await nativeReady();await assert.rejects(s.runtime.compensate(event({Message})),/STAGE5_TIMER_CREDENTIAL_REQUIRED/);
 assert.equal([...s.db.rows.values()].filter(row=>JSON.stringify(row).includes('internal_invocation')).length,0);
});
test('scheduler credential binds scope and rotation invalidates old capability',async()=>{
 const s=await nativeReady();const other=require('../../cloudfunctions/membership-stage5/policy').createPolicy(config({batchId:'another_batch'}));
 await assert.rejects(s.runtime.compensate(event({Message:timerCapability(LOCAL_KEY,other.scopeId)})),/STAGE5_TIMER_CREDENTIAL_REQUIRED/);
 s.environment.STAGE5_INTERNAL_KEY='LOCAL_ROTATED_KEY_32_BYTES_MINIMUM';await assert.rejects(s.runtime.compensate(event()),/STAGE5_TIMER_CREDENTIAL_REQUIRED/);
});
