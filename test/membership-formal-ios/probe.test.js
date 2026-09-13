'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createIosProbe,showIosFailure}=require('../../utils/membership-ios-probe');
test('iOS diagnostics preserve official code and message without payment/session fields',()=>{
  const raw={errCode:-15000,errno:123,errMsg:'requestVirtualPayment:fail original 平台信息',paySig:'NEVER_CAPTURE',signature:'NEVER_CAPTURE'};
  let received;const probe=createIosProbe({login(){},requestVirtualPayment:({fail})=>fail(raw)});
  probe.api.requestVirtualPayment({fail:error=>{received=error;}});
  assert.equal(received,raw);assert.deepEqual(probe.result(),{errCode:raw.errCode,errno:raw.errno,errMsg:raw.errMsg});
  let modal;showIosFailure({showModal:value=>{modal=value;}},probe.result());
  assert.equal(modal.showCancel,false);assert.match(modal.content,/errCode: -15000/);assert.ok(modal.content.includes(raw.errMsg));assert.ok(!modal.content.includes('NEVER_CAPTURE'));
});
test('successful iOS invocation does not fabricate a failure; synchronous errors remain visible',()=>{
 const ok=createIosProbe({requestVirtualPayment:({success})=>success(),login(){}});ok.api.requestVirtualPayment({success(){}});assert.equal(ok.result(),null);
 const bad=createIosProbe({requestVirtualPayment(){throw {errCode:-1,errMsg:'original'};},login(){}});assert.throws(()=>bad.api.requestVirtualPayment({}));assert.deepEqual(bad.result(),{errCode:-1,errMsg:'original'});
});
