'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { invalidateAccountSession } = require('../../utils/account-session');
function setup(purchase, membership = async () => ({membershipStatus:'free',expiresAt:null})) {
  const storage = new Map([['openid', 'LOCAL_TEST_ACCOUNT']]);
  let definition, calls = 0;
  global.wx = { getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k) };
  invalidateAccountSession();
  global.Page = p => { definition = p; };
  global.getApp = () => ({ getStage5MembershipPaymentClient: () => ({ getMembershipAccess: membership, purchase: async request => { calls++; assert.deepEqual(request,{requestId:'stage5_first_real_20260910_01'}); return purchase(); }, queryOrder: async () => ({paymentStatus:'paid',grantStatus:'granted'}) }) });
  const path = require.resolve('../../subpages/stage5-membership/index'); delete require.cache[path]; require(path);
  function page() { const p = {...definition, data: {...definition.data}, setData(d) { Object.assign(this.data,d); }}; p.onShow(); return p; }
  return { page, storage, calls: () => calls };
}
test('opening page is passive, masks identity, ignores query product', () => { const s=setup();const p=s.page();assert.equal(s.calls(),0);assert.equal(p.data.accountLabel,'LOC***OUNT');assert.equal(p.data.orderId,''); });
test('closed purchase is retryable without payment claim', async () => { const s=setup(()=>({status:'unknown',refusal:'STAGE5_PURCHASE_DISABLED'}));const p=s.page();await p.restorePromise;await p.buy();assert.equal(p.data.locked,false);assert.match(p.data.message,/购买当前关闭/); });
test('double click and page reentry never start second attempt', async () => { let resolve;const s=setup(()=>new Promise(r=>{resolve=r;}));const p=s.page();await p.restorePromise;const pending=p.buy();await p.buy();assert.equal(s.calls(),1);resolve({status:'unknown',orderId:'LOCAL_ORDER'});await pending;const q=s.page();await q.restorePromise;await q.buy();assert.equal(s.calls(),1);assert.equal(q.data.locked,true); });
test('unknown no-order response stays locked across reentry', async () => {const s=setup(()=>({status:'unknown'}));const p=s.page();await p.restorePromise;await p.buy();const q=s.page();await q.restorePromise;await q.buy();assert.equal(s.calls(),1);});
test('missing login never purchases', async () => {const s=setup();s.storage.delete('openid');await s.page().buy();assert.equal(s.calls(),0);});
test('account switch does not render late result to new identity', async () => {let resolve;const s=setup(()=>new Promise(r=>{resolve=r;}));const p=s.page();await p.restorePromise;const pending=p.buy();s.storage.set('openid','OTHER');invalidateAccountSession();p.onShow();resolve({status:'granted',order:{orderId:'LOCAL_ORDER',paymentStatus:'paid',grantStatus:'granted'}});await pending;assert.doesNotMatch(p.data.message,/已确认付款/);});
test('UI through real adapter and service stops on closed cloud refusal', async () => {
  const s=setup();let calls=0;
  wx.cloud={async callFunction(arg){if(arg.name==='stage5_access')return {result:{membershipStatus:'free',expiresAt:null}};calls++;assert.equal(arg.name,'stage5_orders');assert.deepEqual(arg.data.request,{productId:'TEST_teacher_12m_a',requestId:'stage5_first_real_20260910_01'});throw {errMsg:'cloud.callFunction:fail Error: STAGE5_PURCHASE_DISABLED'};}};
  wx.login=()=>assert.fail('must not login');wx.requestVirtualPayment=()=>assert.fail('must not pay');
  const client=require('../../utils/membership-stage5-client').createStage5PaymentClient(wx);
  global.getApp=()=>({getStage5MembershipPaymentClient:()=>client});
  const p=s.page();await p.restorePromise;await p.buy();assert.equal(calls,1);assert.match(p.data.message,/购买当前关闭/);assert.equal(p.data.locked,false);
  for(const field of ['price','duration']) await assert.rejects(client.purchase({requestId:'LOCAL',[field]:1}),/INVALID_REQUEST/);
});
test('no receipt restores active from server on every entry, never buys',async()=>{
 let reads=0;const s=setup(()=>assert.fail('purchase'),async()=>{reads++;return {membershipStatus:'active',expiresAt:1820630550000};});
 const p=s.page();await p.restorePromise;assert.equal(p.data.orderId,'');assert.equal(p.data.membershipStatus,'active');assert.equal(p.data.expiresAt,1820630550000);assert.equal(p.data.locked,true);await p.buy();
 p.onShow();await p.restorePromise;assert.equal(reads,2);assert.equal(s.calls(),0);
});
test('phone receipt is preserved but membership uses server',async()=>{const s=setup(null,async()=>({membershipStatus:'active',expiresAt:1820630550000}));s.storage.set('stage5_first_ui_LOCAL_TEST_ACCOUNT',{orderId:'PHONE_ORDER'});const p=s.page();await p.restorePromise;assert.equal(p.data.orderId,'PHONE_ORDER');assert.equal(p.data.membershipStatus,'active');});
test('failed restore is not interpreted as unpurchased',async()=>{const s=setup(null,async()=>{throw Error('offline');});const p=s.page();await p.restorePromise;await p.buy();assert.equal(p.data.locked,true);assert.equal(s.calls(),0);});
test('late membership response cannot cross account switch',async()=>{let resolve;const s=setup(null,()=>new Promise(r=>{resolve=r;}));const p=s.page();s.storage.set('openid','OTHER');invalidateAccountSession();resolve({membershipStatus:'active',expiresAt:1820630550000});await p.restorePromise;assert.notEqual(p.data.membershipStatus,'active');});
