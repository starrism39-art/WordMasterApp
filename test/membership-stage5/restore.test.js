'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createStage5PaymentClient}=require('../../utils/membership-stage5-client');
const {invalidateAccountSession}=require('../../utils/account-session');
function setup(response={membershipStatus:'active',expiresAt:1820630550000}, change=false){let calls=[];global.wx={getStorageSync:()=> 'LOCAL_A'};invalidateAccountSession();const api={cloud:{async callFunction(arg){calls.push(arg);if(change)invalidateAccountSession();return {result:response};}}};return {client:createStage5PaymentClient(api),calls};}
test('membership recovery uses fixed access action without client identity or order',async()=>{const s=setup();assert.equal((await s.client.getMembershipAccess()).membershipStatus,'active');assert.deepEqual(s.calls,[{name:'stage5_access',config:{env:'cloudbase-4gafzdch60ad597b'},data:{action:'getMembershipAccess',request:{action:'ADD_STUDENT'}}}]);});
test('forged teacher or other input rejected before cloud',async()=>{const s=setup();for(const key of ['teacherId','openid','orderId','action','env'])await assert.rejects(s.client.getMembershipAccess({[key]:'OTHER'}),/INVALID_REQUEST/);assert.equal(s.calls.length,0);});
test('invalid response cannot become active',async()=>{const s=setup({membershipStatus:'active'});await assert.rejects(s.client.getMembershipAccess(),/INVALID_SERVER_RESPONSE/);});
test('late access response rejected across account generation',async()=>{const s=setup(undefined,true);await assert.rejects(s.client.getMembershipAccess(),/ACCOUNT_CHANGED/);});
