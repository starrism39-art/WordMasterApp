'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWechatApi}=require('../../cloudfunctions/membership-payment/wechat-api');
const {paySignature}=require('../../cloudfunctions/membership-payment/crypto');
test('Apple fallback delivery signs the exact attempt body; existing non-Apple request stays unchanged',async()=>{
  const calls=[],api=createWechatApi({getAccessToken:async()=>'LOCAL_TOKEN',getAppKey:async()=> 'LOCAL_KEY',fetchImpl:async(url,init)=>{calls.push({url:new URL(url),init});return {ok:true,text:async()=>''};}});
  await api.delivered({orderId:'wi_local_attempt_2',env:0,channel:'apple_iap'});
  assert.equal(calls[0].url.searchParams.get('pay_sig'),paySignature('LOCAL_KEY','/xpay/notify_provide_goods',calls[0].init.body));
  assert.deepEqual(JSON.parse(calls[0].init.body),{order_id:'wi_local_attempt_2',env:0});
  await api.delivered({orderId:'local_existing_channel',env:0,channel:'wechat'});
  assert.equal(calls[1].url.searchParams.has('pay_sig'),false);
});
test('a rejected official delivery acknowledgement remains a failure',async()=>{
  const api=createWechatApi({getAccessToken:async()=>'LOCAL_TOKEN',getAppKey:async()=> 'LOCAL_KEY',fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({errcode:268490002})})});
  await assert.rejects(api.delivered({orderId:'local',env:0,channel:'apple_iap'}),/DELIVERY_NOT_CONFIRMED/);
});
