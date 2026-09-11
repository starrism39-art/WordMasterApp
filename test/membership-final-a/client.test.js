'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(){
 const state={account:'teacher',calls:[],decision:{allowed:true},readOnly:false};
 const wx={cloud:{callFunction:async request=>{state.calls.push(request);if(state.onCall)await state.onCall();return {result:{ok:true,result:state.decision}};}},hideLoading(){},showToast(){}};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../utils/membership-business-client.js'),'utf8'),{module,exports:module.exports,wx,
  require:name=>name==='./account-session'?{captureAccountSession:()=>({accountId:state.account}),isAccountSessionCurrent:s=>s.accountId===state.account}:{isCloudReadOnlyMode:()=>state.readOnly},Date,Math,Promise,Error});
 const page={data:{currentStudent:{id:'student',name:'Student'},currentBatchWords:[{id:'word'}],hasError:false},setData(p){Object.assign(this.data,p);}};
 return {state,page,wx,client:module.exports};
}
test('every new batch reauthorizes; denied next batch preserves in-flight data and controls',async()=>{
 const {state,page,client}=setup();assert.equal(await client.authorizePage(page,'learning'),true);
 state.decision={allowed:false,reasonCode:'MEMBER_EXPIRED_LOCKED_STUDENT'};
 assert.equal(await client.authorizePage(page,'learning'),false);assert.equal(state.calls.length,2);
 assert.equal(page.data.currentBatchWords[0].id,'word');assert.equal(page.data.hasError,false);
 assert.equal(state.calls[0].data.action,'authorizeLearning');
});
test('review has an independent fresh server call; initial denial blocks empty page',async()=>{
 const {state,page,client}=setup();page.data.currentBatchWords=[];state.decision={allowed:false,reasonCode:'ACCESS_DENIED'};
 assert.equal(await client.authorizePage(page,'review'),false);assert.equal(page.data.hasError,true);
 assert.equal(state.calls[0].data.action,'authorizeReview');
});
test('account switch discards response; read-only mode prevents mutations before transport',async()=>{
 const {state,client}=setup();state.onCall=async()=>{state.account='other';};
 await assert.rejects(client.call('addStudent',{requestId:'x',name:'N'}),/ACCOUNT_SESSION_CHANGED/);
 state.readOnly=true;await assert.rejects(client.call('addStudent',{}),/CLOUD_READ_ONLY/);assert.equal(state.calls.length,1);
});
test('student switch during authorization cannot grant the newly selected target',async()=>{
 const {state,page,client}=setup();state.onCall=async()=>{page.data.currentStudent.id='other';};
 assert.equal(await client.authorizePage(page,'learning'),false);
});
test('account switch while retained confirmation is open cannot write another account',async()=>{
 const {state,page,wx,client}=setup();
 state.decision={allowed:false,reasonCode:'MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT'};
 wx.showModal=({success})=>{state.account='other';success({confirm:true});};
 assert.equal(await client.authorizePage(page,'learning'),false);
 assert.equal(state.calls.length,1);
});
test('wordbook switch and late error leave the new context untouched',async()=>{
 const {state,page,client}=setup();page.data.currentWordbook={id:'before'};
 state.onCall=async()=>{page.data.currentWordbook.id='after';throw Error('offline');};
 assert.equal(await client.authorizePage(page,'review'),false);
 assert.equal(page.data.hasError,false);
});
