'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {row,NOW,ReadDb}=require('../membership-final-b/fixtures');
const {award,refund,T}=require('../membership-stage2/fixtures');
const {membershipModel}=require('../../cloudfunctions/membership-presentation/model');
const {DEFAULTS,APP_ID}=require('../../cloudfunctions/membership-presentation/config');
const {createPresentationRuntime}=require('../../cloudfunctions/membership-presentation/runtime');
const {takeReminder}=require('../../utils/membership-reminders');
const {gateDisplay}=require('../../utils/membership-channel-gates');
const DAY=86400000;
const display=(r,now=NOW)=>membershipModel(r,now,DEFAULTS);
function expiring(days){const r=row('active');r.grants=[award('payment',NOW+(days-365)*DAY)];return r;}
function storage(){const values=new Map();return {getStorageSync:k=>values.get(k),setStorageSync:(k,v)=>values.set(k,v)};}
test('7/3/1 stages, 8-day silence and Beijing today boundary are derived from final expiry',()=>{
  for(const [days,stage] of [[8,null],[7,'expiry_7'],[4,'expiry_7'],[3,'expiry_3'],[2,'expiry_3'],[1,'expiry_1'],[0,'expired']]){
    const r=expiring(days),before=structuredClone(r),m=display(r);
    assert.equal(m.reminder?.stage||null,stage);assert.deepEqual(r,before);
  }
  const r=expiring(1),end=display(r).reminder.expiresAt;
  const m=display(r,end-3600000);assert.equal(m.remainingDays,0);assert.equal(m.entrySubtitle,'今天到期');assert.equal(m.reminder.stage,'expiry_1');
  assert.equal(display(r,end).reminder.stage,'expired');
  const midnight=T('2026-10-08T00:00:00');
  assert.notEqual(display(r,midnight-1).beijingDay,display(r,midnight).beijingDay);
});
test('same-stage same-day receipt survives reload; next Beijing day may notify once',()=>{
  const wx=storage(),r=expiring(7),a=display(r);
  assert.ok(takeReminder(a,wx));assert.equal(takeReminder(a,wx),'');assert.equal(takeReminder(display(r,NOW+1000),wx),'');
  const next=display(r,NOW+DAY);assert.ok(takeReminder(next,wx));assert.equal(takeReminder(next,wx),'');
});
test('renewal invalidates the old reminder and later uses the new final expiry',()=>{
  const r=expiring(1),old=display(r);assert.equal(old.reminder.stage,'expiry_1');
  r.grants.push(award('renewal',NOW,{duration:{months:12}}));
  assert.equal(display(r).reminder,null);
  const projection=require('../../cloudfunctions/membership-core/ledger').projectLedger('teacher',r.grants,NOW);
  assert.notEqual(display(r,projection.effectiveExpiresAt-DAY).reminder.key,old.reminder.key);
});
test('long-term overrides finite and refunded payment reminders; gift remains authoritative',()=>{
  const r=expiring(1);r.grants.push(award('long',NOW-DAY,{sourceType:'internal_long_term'}));assert.equal(display(r).reminder,null);
  r.grants.push(refund('refund','payment',NOW));assert.equal(display(r).reminder,null);
  const gift=expiring(1);gift.grants.push(award('gift',NOW,{sourceType:'gift',duration:{months:1}}),refund('refund','payment',NOW));
  assert.equal(display(gift).displayState,'active');assert.equal(display(gift).reminder,null);
  const only=expiring(1);only.grants.push(refund('refund','payment',NOW));assert.equal(display(only).reminder.stage,'expired');
});
test('personal five-day countdown, final-day notice and end follow existing transition only',()=>{
  const r=row('transition');r.transitionStartedAt=NOW;r.access.transitionStartsAt=NOW;r.access.transitionEndsAt=NOW+5*DAY;
  const before=structuredClone(r);assert.equal(display(r).transitionRemainingDays,5);assert.equal(display(r).reminder,null);
  assert.equal(display(r,NOW+4*DAY).reminder.stage,'transition_1');assert.equal(display(r,NOW+5*DAY).reminder.stage,'transition_expired');assert.deepEqual(r,before);
});
test('server display rejects client times and performs zero writes',async()=>{
  const db=new ReadDb(expiring(3));const run=createPresentationRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:'teacher',SOURCE:'wx_client'})},clock:()=>NOW});
  const m=await run({action:'getDisplay'});assert.equal(m.reminder.stage,'expiry_3');assert.equal(db.writes,0);
  await assert.rejects(run({action:'getDisplay',request:{now:0}}));
});
test('receipt failures suppress notices, different accounts have different keys, status stays visible',()=>{
  const m=display(expiring(3));assert.equal(takeReminder(m,{getStorageSync(){throw Error('storage');}}),'');assert.equal(m.entrySubtitle,'3 天后到期');
  const r=expiring(3);r.teacherId='other';r.access.teacherId='other';r.students.forEach(s=>s.teacherId='other');r.grants.forEach(g=>g.teacherId='other');assert.notEqual(display(r).reminder.key,m.reminder.key);
});
test('Windows/iOS/Harmony/unknown buying hidden while entitlement model is preserved',()=>{
  const m={...display(expiring(3)),canPurchase:true,canRenew:true,showPurchase:true};
  for(const platform of ['windows','ios','ohos','mac','devtools','unknown']){const g=gateDisplay(m,{getDeviceInfo:()=>({platform}),requestVirtualPayment(){}});assert.equal(g.showPurchase,false);assert.equal(g.canRenew,false);assert.equal(g.canPurchase,false);assert.equal(g.entrySubtitle,m.entrySubtitle);assert.equal(g.expiresAtText,m.expiresAtText);}
  assert.equal(gateDisplay(m,{getDeviceInfo:()=>({platform:'android'}),requestVirtualPayment(){}}),m);
  assert.equal(gateDisplay(m,{}).canPurchase,false);
});
