'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const diagnostic=require('../../utils/membership-payment-diagnostic');
const {createIosProbe}=require('../../utils/membership-ios-probe');
const {makePage}=require('../../subpages/membership/page');
const {models}=require('../membership-final-b/fixtures');
const client=require('../../utils/membership-ui-client');
// Assertions inspect persisted events; keep the test runner output compact.
const originalInfo=console.info,originalWarn=console.warn;console.info=()=>{};console.warn=()=>{};
test.after(()=>{console.info=originalInfo;console.warn=originalWarn;});
const ORDER='existing_mock_order';
const PARAMETERS={paymentInvocationAllowed:true,mode:'short_series_goods',signData:JSON.stringify({offerId:'mock_offer',outTradeNo:ORDER,productId:'teacher_member_12m',goodsPrice:39900,env:0,attach:'PRIVATE_ATTACH'}),paySig:'PAY_SIG_DO_NOT_LOG',signature:'USER_SIGNATURE_DO_NOT_LOG'};
function setup({native='success',platform='ios',env='develop',deferModal=false,permission=true}={}) {
 const storage=new Map(),calls=[],modals=[],toasts=[],acks=[];let nativeCalls=0;
 const model={...models().active,iosPurchaseAllowed:true,showPurchase:true,pending:false,canPurchase:false,canRenew:false,canResumePayment:true,resumeOrderId:ORDER,purchaseLabel:'继续支付'};
 const wxApi={getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),getDeviceInfo:()=>({platform,system:'iOS mock'}),getAppBaseInfo:()=>({SDKVersion:'MOCK_SDK',version:'MOCK_WECHAT'}),getStorageSync:key=>key==='openid'?'mock_diagnostic_account':storage.get(key),setStorageSync:(key,value)=>storage.set(key,JSON.parse(JSON.stringify(value))),canIUse:()=>true,login:o=>o.success({code:'MOCK_LOGIN_CODE'}),onNetworkStatusChange(){},offNetworkStatusChange(){},showToast:o=>toasts.push(o),showModal:o=>{modals.push(o);if(deferModal)acks.push(()=>o.success({confirm:true}));else o.success({confirm:true});},setClipboardData:o=>{storage.set('clipboard',o.data);o.success?.();},requestVirtualPayment:o=>{nativeCalls++;calls.push({action:'native',options:o});
   if(native==='throw')throw {errCode:-15006,errMsg:'sync failure'};
   if(native==='reject')return Promise.reject({errCode:-15006,errMsg:'thenable rejected'});
   if(native==='completeOnly'){o.complete?.({errMsg:'complete only'});return;}
   if(native==='fail'){const error={errCode:-15002,errMsg:'outTradeNo reused',signature:PARAMETERS.signature};o.fail(error);o.complete?.(error);return;}
   o.success({errMsg:'requestVirtualPayment:ok'});o.complete?.({errMsg:'requestVirtualPayment:ok'});
 },cloud:{callFunction:async options=>{
   const {action,request}=options.data;calls.push({action,request});
   if(action==='createOrder')throw Error('NEW_PRODUCTION_ORDER_FORBIDDEN');
   const result=action==='getDisplay'?model:action==='parameters'?{...PARAMETERS,paymentInvocationAllowed:permission}:action==='getOrders'?{orders:[],nextOffset:null}:{paymentStatus:'awaiting_payment',grantStatus:'none'};
   return {result:{ok:true,code:'OK',result}};
 }}};
 global.wx=wxApi;global.getApp=()=>({globalData:{cloudReadOnly:false}});
 const page=makePage('index');page.setData=v=>Object.assign(page.data,v);page.onLoad({});page._visible=true;page.data={...page.data,loading:false,error:false,localPending:false,model};
 return {wxApi,page,calls,modals,toasts,acks,storage,nativeCalls:()=>nativeCalls,events:()=>storage.get(diagnostic.STORAGE_KEY)?.events||[]};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('A/B: real resume handler receives parameters and calls native exactly once; success + complete share one trace',async()=>{
 const s=setup();await s.page.buy();
 assert.equal(s.nativeCalls(),1);assert.equal(s.calls.some(c=>c.action==='createOrder'),false);
 const e=s.events(),names=e.map(x=>x.event);for(const n of ['PAYMENT_CLICK','PARAMETERS_BEGIN','PARAMETERS_END','NATIVE_PAYMENT_CALL_BEGIN','NATIVE_PAYMENT_SUCCESS','NATIVE_PAYMENT_COMPLETE'])assert.ok(names.includes(n),n);
 assert.equal(new Set(e.map(x=>x.traceId)).size,1);assert.equal(e[0].data.businessOrderId,ORDER);
 const native=s.calls.find(c=>c.action==='native').options;
 assert.deepEqual(Object.keys(native).sort(),['mode','signData','paySig','signature','success','fail','complete'].sort());
 assert.equal(native.signData,PARAMETERS.signData);assert.equal(native.paySig,PARAMETERS.paySig);assert.equal(native.signature,PARAMETERS.signature);
 const begin=e.find(x=>x.event==='NATIVE_PAYMENT_CALL_BEGIN');assert.equal(begin.data.fields.find(x=>x.name==='signData').type,'string');assert.equal(begin.data.canIUse,true);assert.equal(begin.data.requiredEmpty.find(x=>x.name==='signature').empty,false);
 assert.deepEqual(s.calls.find(c=>c.action==='parameters').request,{orderId:ORDER,loginCode:'MOCK_LOGIN_CODE',platform:'ios'});
 assert.equal(s.page.data.message,'正在确认支付结果');assert.ok(s.toasts.some(x=>x.title.includes('准备调用 Apple 支付')));
});
test('C/F/G: fail fields persist; debug error waits for acknowledgement before finally/reload',async()=>{
 const s=setup({native:'fail',deferModal:true});const run=s.page.buy();await tick();
 assert.equal(s.modals.length,1);assert.equal(s.modals[0].title,'支付调起失败');assert.match(s.modals[0].content,/errCode: -15002/);assert.match(s.modals[0].content,/outTradeNo reused/);
 let names=s.events().map(x=>x.event);assert.ok(names.includes('NATIVE_PAYMENT_FAIL'));assert.ok(names.includes('NATIVE_PAYMENT_COMPLETE'));assert.equal(names.includes('PAYMENT_FINALLY_BEGIN'),false);assert.equal(names.includes('PAGE_RELOAD_BEGIN'),false);
 s.acks.shift()();await run;
 const e=s.events();names=e.map(x=>x.event);assert.ok(names.indexOf('NATIVE_PAYMENT_FAIL')<names.indexOf('DEBUG_MODAL_BEGIN'));assert.ok(names.indexOf('DEBUG_MODAL_END')<names.indexOf('PAYMENT_FINALLY_BEGIN'));assert.ok(names.indexOf('PAYMENT_FINALLY_BEGIN')<names.indexOf('PAGE_RELOAD_BEGIN'));assert.ok(names.indexOf('PAGE_RELOAD_BEGIN')<names.indexOf('PAGE_RELOAD_END'));
 assert.equal(e.find(x=>x.event==='NATIVE_PAYMENT_FAIL').data.errCode,-15002);
 assert.equal(e.find(x=>x.event==='PAGE_RELOAD_BEGIN').data.reason,'buy.finally');
 assert.ok(e.some(x=>x.event==='NATIVE_PAYMENT_FAIL'),'reload retains error');
});
test('D: synchronous native throw is visible, retained and reaches unchanged unknown result + finally',async()=>{
 const s=setup({native:'throw'});await s.page.buy();const names=s.events().map(x=>x.event);
 assert.ok(names.includes('NATIVE_PAYMENT_THROW'));assert.ok(names.includes('NATIVE_PAYMENT_REJECT'));assert.ok(names.includes('PAYMENT_SERVICE_CATCH'));assert.ok(names.includes('PAYMENT_FINALLY_BEGIN'));
 assert.equal(s.modals[0].title,'支付调用异常');assert.match(s.modals[0].content,/sync failure/);assert.equal(s.calls.some(x=>x.action==='queryOrder'),false);
});
test('E: returned thenable rejection is observed without inventing a fail callback or changing settlement',async()=>{
 const s=setup({native:'reject'});const trace=diagnostic.start(s.wxApi,{});let failures=0;
 const p=createIosProbe(s.wxApi,trace);const returned=p.api.requestVirtualPayment({...PARAMETERS,success(){},fail(){failures++;}});
 await assert.rejects(returned);await tick();await trace.flush();
 assert.ok(s.events().some(x=>x.event==='NATIVE_PAYMENT_REJECT'));assert.equal(failures,0);assert.equal(s.modals[0].title,'支付调用 Promise 异常');
});
test('complete-only native callback emits visible ambiguous ending without manufacturing success/fail',async()=>{
 const s=setup({native:'completeOnly'});const trace=diagnostic.start(s.wxApi,{});let terminal=0;
 createIosProbe(s.wxApi,trace).api.requestVirtualPayment({...PARAMETERS,success(){terminal++;},fail(){terminal++;}});await trace.flush();
 assert.equal(terminal,0);assert.equal(s.events().find(x=>x.event==='NATIVE_PAYMENT_COMPLETE').data.terminalCallbackSeen,false);
 assert.match(s.modals[0].content,/未获得明确成功结果/);
});
test('diagnostic storage/clipboard contain summaries, never original signatures/signData/attach or arbitrary callback data',async()=>{
 const s=setup({native:'fail'});await s.page.buy();diagnostic.copy(s.wxApi);const saved=JSON.stringify(s.events()),copied=s.storage.get('clipboard');
 for(const value of [PARAMETERS.signData,PARAMETERS.paySig,PARAMETERS.signature,'PRIVATE_ATTACH','MOCK_LOGIN_CODE','mock_diagnostic_account']){assert.equal(saved.includes(value),false);assert.equal(copied.includes(value),false);}
 const trace=diagnostic.current(s.wxApi);trace.event('ECHO',{message:PARAMETERS.signData+' '+PARAMETERS.paySig+' '+PARAMETERS.signature});assert.equal(JSON.stringify(s.events()).includes(PARAMETERS.paySig),false);
});
test('release and Android disable diagnosis; Android resume follows original cloud/native path without modal/storage',async()=>{
 for(const [platform,env] of [['ios','release'],['android','develop']]){
  const s=setup({platform,env,native:'fail'});assert.equal(diagnostic.enabled(s.wxApi),false);assert.equal(s.page.data.paymentDiagnosticEnabled,false);
  await s.page.buy();assert.equal(s.nativeCalls(),1);assert.equal(s.events().length,0);assert.equal(s.toasts.length,0);assert.equal(s.calls.some(x=>x.action==='createOrder'),false);
  if(platform==='android')assert.equal(s.modals.length,0);
 }
});
test('H: Android active renewal creates one order as before; native success never grants without server fact',async()=>{
 const s=setup({platform:'android'});let creates=0;const original=s.wxApi.cloud.callFunction;
 s.wxApi.cloud.callFunction=async o=>{if(o.data.action==='createOrder'){creates++;return {result:{ok:true,result:{orderId:ORDER}}};}const r=await original(o);if(o.data.action==='getDisplay')r.result.result={...r.result.result,canRenew:true,canResumePayment:false,resumeOrderId:'',awaitingPayment:false};return r;};
 const r=await client.purchase('mock_renew');assert.equal(creates,1);assert.equal(s.nativeCalls(),1);assert.equal(r.status,'processing');assert.equal(s.events().length,0);
});
test('permission false records early stop and cannot invoke native; page guard records stop without any cloud call',async()=>{
 const s=setup({permission:false});await s.page.buy();assert.equal(s.nativeCalls(),0);assert.ok(s.events().some(x=>x.event==='NATIVE_PAYMENT_SKIPPED'));
 const g=setup();g.page.data.localPending=true;await g.page.buy();assert.equal(g.calls.length,0);assert.equal(g.events().find(x=>x.event==='PAYMENT_CLICK_RETURN').data.reason,'PAGE_GUARD');
});
test('diagnostic ring replaces previous click, is bounded, and storage failure cannot block native',async()=>{
 const s=setup();const a=diagnostic.start(s.wxApi,{});for(let i=0;i<100;i++)a.event('MOCK_EVENT',{index:i});assert.equal(s.events().length,diagnostic.MAX_EVENTS);
 const b=diagnostic.start(s.wxApi,{});assert.notEqual(a.traceId,b.traceId);assert.equal(s.events().length,2);assert.equal(s.events()[1].data.wechatVersion,'MOCK_WECHAT');
 s.wxApi.setStorageSync=()=>{throw Error('MOCK_FULL');};await s.page.buy();assert.equal(s.nativeCalls(),1);
});
test('Android first purchase and terminal/uncertain client gates keep original routing, without diagnostics',async()=>{
 const s=setup({platform:'android'});let creates=0;const original=s.wxApi.cloud.callFunction;
 s.wxApi.cloud.callFunction=async o=>{if(o.data.action==='createOrder'){creates++;return {result:{ok:true,result:{orderId:ORDER}}};}const r=await original(o);if(o.data.action==='getDisplay')r.result.result={...r.result.result,displayState:'free',canPurchase:true,canRenew:false,canResumePayment:false,resumeOrderId:'',awaitingPayment:false};return r;};
 assert.equal((await client.purchase('mock_first')).status,'processing');assert.equal(creates,1);assert.equal(s.nativeCalls(),1);
 for(const state of ['pending','closed','long_term']){const g=setup({platform:'android'});g.page.data.model={...g.page.data.model,canResumePayment:false,canRenew:false,canPurchase:false,pending:state==='pending',showPurchase:state!=='long_term'};await g.page.buy();assert.equal(g.nativeCalls(),0);assert.equal(g.calls.length,0);assert.equal(g.events().length,0);}
});
test('reload origins onShow/network/poll/manual are distinguishable without changing triggers',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const s=setup();diagnostic.start(s.wxApi,{});let network;
 s.wxApi.onNetworkStatusChange=fn=>{network=fn;};s.page.onShow();await tick();network({isConnected:true});await tick();s.page.poll();t.mock.timers.tick(8000);await tick();await s.page.reload();
 const reasons=s.events().filter(x=>x.event==='PAGE_RELOAD_BEGIN').map(x=>x.data.reason);for(const value of ['onShow','network','poll','manual'])assert.ok(reasons.includes(value));assert.equal(s.nativeCalls(),0);s.page.onHide();
});
test('an independent lifecycle reload while debug modal is open cannot erase persisted failure or finish purchase',async()=>{
 const s=setup({native:'fail',deferModal:true});const run=s.page.buy();await tick();await s.page.reload('onShow');diagnostic.copy(s.wxApi);
 assert.ok(s.events().some(x=>x.event==='NATIVE_PAYMENT_FAIL'));assert.match(s.storage.get('clipboard'),/NATIVE_PAYMENT_FAIL/);assert.equal(s.events().some(x=>x.event==='PAYMENT_FINALLY_BEGIN'),false);
 s.acks.shift()();await run;
});
