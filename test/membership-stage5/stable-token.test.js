'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createStableTokenProvider}=require('../../cloudfunctions/membership-payment/stable-token');
const {credentialProviders}=require('../../cloudfunctions/membership-payment/runtime');
const APP='wx0000000000000000';
function setup(){
 const state={now:1000000,secret:'LOCAL_TEST_SECRET',calls:[],result:{access_token:'LOCAL_TOKEN',expires_in:7200}};
 const fetchImpl=async(url,options)=>{state.calls.push({url,options});if(state.fail)throw Error(state.secret);return {ok:true,text:async()=>JSON.stringify(state.result)};};
 const get=createStableTokenProvider({appId:APP,getAppSecret:async()=>state.secret,clock:()=>state.now,fetchImpl});
 return {state,get,fetchImpl};
}
test('stable token request binds application, uses POST normal mode and caches privately',async()=>{
 const {state,get}=setup();assert.equal(await get(),'LOCAL_TOKEN');assert.equal(await get(),'LOCAL_TOKEN');assert.equal(state.calls.length,1);
 const {url,options}=state.calls[0];assert.equal(url,'https://api.weixin.qq.com/cgi-bin/stable_token');assert.equal(options.redirect,'error');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{grant_type:'client_credential',appid:APP,secret:'LOCAL_TEST_SECRET',force_refresh:false});
});
test('concurrent requests share one token fetch',async()=>{const {get,state}=setup();assert.deepEqual(await Promise.all([get(),get(),get()]),Array(3).fill('LOCAL_TOKEN'));assert.equal(state.calls.length,1);});
test('expiry comes from platform lifetime and refreshes before expiry',async()=>{const {get,state}=setup();await get();state.now+=6900000;state.result.access_token='LOCAL_NEW';assert.equal(await get(),'LOCAL_NEW');assert.equal(state.calls.length,2);});
test('short remaining lifetime does not cause an immediate refresh loop',async()=>{const {get,state}=setup();state.result.expires_in=345;await get();state.now+=10000;await get();assert.equal(state.calls.length,1);});
test('secret rotation invalidates cached credentials',async()=>{const {get,state}=setup();await get();state.secret='LOCAL_ROTATED';state.result.access_token='LOCAL_NEW';assert.equal(await get(),'LOCAL_NEW');assert.equal(state.calls.length,2);});
test('refresh failure never falls back to stale token and never exposes secret',async()=>{const {get,state}=setup();await get();state.now+=7200000;state.fail=true;await assert.rejects(get(),e=>e.message==='STABLE_TOKEN_TRANSPORT_FAILED'&&!String(e.stack).includes(state.secret));state.fail=false;await get();assert.equal(state.calls.length,3);});
for(const result of [{errcode:40013,errmsg:'LOCAL_SECRET'},null,{access_token:'',expires_in:7200},{access_token:'LOCAL',expires_in:0},{access_token:'LOCAL',expires_in:7201},{access_token:'LOCAL',expires_in:1.5}])test('malformed/error token reply fails closed '+JSON.stringify(result),async()=>{const {get,state}=setup();state.result=result;await assert.rejects(get(),/STABLE_TOKEN_REJECTED/);});
test('managed credentials cannot fall back to a manually supplied static token',async()=>{const {fetchImpl,state}=setup();const c=credentialProviders({MEMBERSHIP_ACCESS_TOKEN:'LOCAL_STATIC'},{appId:APP,fetchImpl});await assert.rejects(c.getAccessToken(),/CREDENTIAL_NOT_CONFIGURED/);assert.equal(state.calls.length,0);});
test('invalid application fails before network',async()=>{let calls=0;const get=createStableTokenProvider({appId:'bad',getAppSecret:async()=>'',fetchImpl:async()=>{calls++;}});await assert.rejects(get(),/TOKEN_APPLICATION_REQUIRED/);assert.equal(calls,0);});
test('provider recreation obtains official token instead of inventing persistent cache',async()=>{const {fetchImpl,state}=setup();for(let i=0;i<2;i++){const c=credentialProviders({MEMBERSHIP_APP_SECRET:'LOCAL_TEST_SECRET'},{appId:APP,fetchImpl});assert.equal(await c.getAccessToken(),'LOCAL_TOKEN');}assert.equal(state.calls.length,2);});
