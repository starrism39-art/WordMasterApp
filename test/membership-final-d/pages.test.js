'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {row,NOW}=require('../membership-final-b/fixtures');
const {membershipModel}=require('../../cloudfunctions/membership-presentation/model');
const {DEFAULTS}=require('../../cloudfunctions/membership-presentation/config');
const {makePage}=require('../../subpages/membership/page');
const client=require('../../utils/membership-ui-client');
function setup(platform='android'){
 let model=membershipModel(row('expiring'),NOW,DEFAULTS),fail=false,identity='teacher';const values=new Map(),calls=[];
 global.getApp=()=>({globalData:{cloudReadOnly:false}});
 global.wx={getStorageSync:k=>k==='membership_reminder_receipts_v1'?values.get(k):identity,setStorageSync:(k,v)=>values.set(k,v),getDeviceInfo:()=>({platform}),requestVirtualPayment(){throw Error('PAYMENT_FORBIDDEN');},onNetworkStatusChange(){},offNetworkStatusChange(){},cloud:{callFunction:async o=>{calls.push(o);if(fail)throw Error('offline');return {result:{ok:true,result:model}};}}};
 const page=makePage('index');page.data=structuredClone(page.data);page.setData=v=>Object.assign(page.data,v);page.onLoad({});page._visible=true;
 return {page,calls,setModel:v=>model=v,fail:v=>fail=v,account:v=>identity=v};
}
test('real page uses fresh server model, consumes notice once and keeps entry status',async()=>{
 const s=setup();await s.page.reload();assert.match(s.page.data.reminderText,/3 天/);assert.equal(s.page.data.model.entrySubtitle,'3 天后到期');
 s.page.onHide();s.page._visible=true;await s.page.reload();assert.equal(s.page.data.reminderText,'');assert.equal(s.page.data.model.entrySubtitle,'3 天后到期');
 s.setModel(membershipModel(row('active'),NOW,DEFAULTS));await s.page.reload();assert.equal(s.page.data.reminderText,'');assert.equal(s.page.data.model.displayState,'active');
});
test('failed refresh clears old reminder and model; recovery remains usable',async()=>{
 const s=setup();await s.page.reload();s.fail(true);await s.page.reload();assert.equal(s.page.data.reminderText,'');assert.equal(s.page.data.model,null);
 s.fail(false);await s.page.reload();assert.equal(s.page.data.error,false);assert.equal(s.page.data.reminderText,'');
});
test('Windows direct purchase is rejected before any cloud call, while status loads',async()=>{
 const s=setup('windows');s.setModel({...membershipModel(row('active'),NOW,DEFAULTS),canPurchase:true,canRenew:true});await s.page.reload();
 assert.equal(s.page.data.model.showPurchase,false);assert.equal(s.page.data.model.displayState,'active');const n=s.calls.length;
 await s.page.buy();assert.equal(s.calls.length,n);await assert.rejects(client.purchase('test'),/PURCHASE_CHANNEL_NOT_RELEASED/);assert.equal(s.calls.length,n);
});
test('late account response cannot display or consume another account notice',async()=>{
 const s=setup();let finish;wx.cloud.callFunction=()=>new Promise(resolve=>finish=resolve);const pending=s.page.reload();s.account('other');
 finish({result:{ok:true,result:membershipModel(row('expiring'),NOW,DEFAULTS)}});await pending;assert.equal(s.page.data.model,null);assert.equal(wx.getStorageSync('membership_reminder_receipts_v1'),undefined);
});
