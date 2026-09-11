'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {models,order,row,NOW}=require('./fixtures');
const {orderModel}=require('../../cloudfunctions/membership-presentation/model');
const {DEFAULTS,publicConfig}=require('../../cloudfunctions/membership-presentation/config');
const client=require('../../utils/membership-ui-client');
const {makePage}=require('../../subpages/membership/page');
function setup(kind='index') {
 let account='teacher',model=models().free,failed=false;const calls=[];
 global.getApp=()=>({globalData:{cloudReadOnly:false}});
 global.wx={getStorageSync:()=>account,onNetworkStatusChange(){},offNetworkStatusChange(){},navigateTo(){},login:({success})=>success({code:'local_code'}),requestVirtualPayment:({fail})=>fail({errMsg:'cancel'}),cloud:{callFunction:async options=>{
   calls.push(options);if(failed)throw Error('offline');const a=options.data.action;
   let result=a==='getDisplay'?model:a==='getPublicConfig'?publicConfig(DEFAULTS):a==='getOrders'?{orders:[],nextOffset:null}:a==='getOrderDetail'?{orderDetail:orderModel(order(),row('active'),DEFAULTS,NOW)}:a==='createOrder'?{orderId:'local_order'}:a==='parameters'?{}:a==='queryOrder'?{paymentStatus:'awaiting_payment',grantStatus:'pending'}:{studentId:'one'};
   return {result:{ok:true,result}};
 }}};
 const page=makePage(kind);page.data=structuredClone(page.data);page.setData=value=>Object.assign(page.data,value);page.onLoad({id:'order'});page._visible=true;page.poll=()=>{};
 return {page,calls,setModel:v=>{model=v;},fail:v=>{failed=v;},setAccount:v=>{account=v;}};
}
test('pages load eight server models verbatim and long-term exposes no buying',async()=>{
 const s=setup();for(const m of Object.values(models())){s.setModel(m);await s.page.reload();assert.equal(s.page.data.model.displayState,m.displayState);}
 await s.page.buy();assert.equal(s.calls.filter(c=>c.data.action==='createOrder').length,0);
});
test('loading/error prohibit purchase and retention; failed reload does not become free',async()=>{
 const s=setup();assert.equal(s.page.data.model,null);await s.page.buy();await s.page.confirmRetention();assert.equal(s.calls.length,0);
 s.fail(true);await s.page.reload();assert.equal(s.page.data.error,true);assert.equal(s.page.data.model,null);await s.page.buy();assert.equal(s.calls.filter(c=>c.data.action==='createOrder').length,0);
 s.fail(false);await s.page.reload();assert.equal(s.page.data.error,false);
});
test('retention failure preserves selection; retry reuses id and reload reflects fixed result',async()=>{
 const s=setup('retain-student');s.setModel(models().expired_selection);await s.page.reload();s.page.chooseStudent({detail:{value:'one'}});s.fail(true);
 await s.page.confirmRetention();assert.equal(s.page.data.selectedId,'one');assert.equal(s.page.data.error,true);const id=s.page._retainRequest;
 s.fail(false);await s.page.reload();await s.page.confirmRetention();assert.equal(s.page._retainRequest,id);
 s.setModel(models().expired_retained);await s.page.reload();assert.equal(s.page.data.model.retainedStudentName,'林同学');const before=s.calls.length;await s.page.confirmRetention();assert.equal(s.calls.length,before);
});
test('same-tick duplicate retention causes one service mutation',async()=>{
 const s=setup('retain-student');s.setModel(models().expired_selection);await s.page.reload();s.page.chooseStudent({detail:{value:'one'}});
 await Promise.all([s.page.confirmRetention(),s.page.confirmRetention()]);assert.equal(s.calls.filter(c=>c.name==='membership_business').length,1);
});
test('cancelled payment reuses sealed orchestration; no client price/product/duration, no grant assertion',async()=>{
 const s=setup();s.setModel({...models().free,canPurchase:true});await s.page.reload();
 await Promise.all([s.page.buy(),s.page.buy()]);const creates=s.calls.filter(c=>c.data.action==='createOrder');assert.equal(creates.length,1);assert.deepEqual(Object.keys(creates[0].data.request),['requestId']);assert.equal(s.page.data.model.displayState,'free');assert.equal(s.page.data.message,'已取消支付');
});
test('success callback does not grant membership; server pending restored after reentry',async()=>{
 const s=setup();s.setModel({...models().free,canPurchase:true});await s.page.reload();
 wx.requestVirtualPayment=({success})=>{s.setModel({...models().free,pending:true});success();};await s.page.buy();assert.equal(s.page.data.model.displayState,'free');assert.equal(s.page.data.localPending,true);assert.equal(s.page.data.message,'正在确认支付结果');
 s.page.onHide();s.page._visible=true;await s.page.reload();assert.equal(s.page.data.localPending,true);const n=s.calls.length;await s.page.buy();assert.equal(s.calls.length,n);
});
test('late response from switched account discarded, including A-B-A generation changes',async()=>{
 const s=setup();let resolve;wx.cloud.callFunction=()=>new Promise(r=>{resolve=r;});const pending=s.page.reload();
 s.setAccount('other');require('../../utils/account-session').captureAccountSession();s.setAccount('teacher');require('../../utils/account-session').captureAccountSession();resolve({result:{ok:true,result:models().active}});await pending;assert.equal(s.page.data.model,null);
});
test('orders, details, rules, support and network recovery use fresh server reads',async()=>{
 for(const kind of ['orders','order-detail','rules','support']){const s=setup(kind);await s.page.reload();assert.equal(s.page.data.error,false);if(kind==='orders')assert.deepEqual(s.page.data.orders,[]);if(kind==='order-detail')assert.equal(s.page.data.detail.statusText,'支付成功');}
 const s=setup();let listener;wx.onNetworkStatusChange=fn=>{listener=fn;};s.page.onShow();await new Promise(r=>setImmediate(r));s.fail(true);await s.page.reload();s.fail(false);listener({isConnected:true});await new Promise(r=>setImmediate(r));assert.equal(s.page.data.error,false);s.page.onUnload();
});
test('account change releases old submission UI while discarding its late completion',async()=>{
 const s=setup('retain-student');s.setModel(models().expired_selection);await s.page.reload();s.page.chooseStudent({detail:{value:'one'}});
 const original=wx.cloud.callFunction;let finish;
 wx.cloud.callFunction=options=>options.name==='membership_business'?new Promise(resolve=>{finish=resolve;}):original(options);
 const pending=s.page.confirmRetention();await new Promise(resolve=>setImmediate(resolve));assert.equal(s.page.data.submitting,true);
 s.setAccount('new_teacher');s.setModel(models().free);await s.page.reload();
 assert.equal(s.page.data.submitting,false);assert.equal(s.page.data.selectedId,'');
 finish({result:{ok:true,result:{studentId:'one'}}});await pending;assert.equal(s.page.data.model.displayState,'free');assert.equal(s.page.data.message,'');
});
