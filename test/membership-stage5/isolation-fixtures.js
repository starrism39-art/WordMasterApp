'use strict';
// Offline only. No fixture identity is registered in any deployment configuration.
const {LocalSdk,setup:paymentSetup,BASE,cryptoConfig,encrypt}=require('../membership-stage3/fixtures');
const {product}=require('../membership-stage2/fixtures');
const {createPolicy,APP_ID,ENV_ID,COLLECTIONS}=require('../../cloudfunctions/membership-stage5/policy');
const {createStage5Repository}=require('../../cloudfunctions/membership-stage5/repository');
const {createStage5Runtime}=require('../../cloudfunctions/membership-stage5/runtime');
const {hmac,hash}=require('../../cloudfunctions/membership-payment/crypto');
class Stage5Sdk extends LocalSdk {
  constructor(){super();this.targets=[];this.calls=0;this.failAt=0;}
  scope(rows,transactional){
    const parent=super.scope(rows,transactional);const sdk=this;
    return {collection(name){
      sdk.targets.push(name);
      const base=parent.collection(name);
      return {...base,doc(key){const doc=base.doc(key);return {...doc,async set(value){
        if(sdk.failAt && ++sdk.calls===sdk.failAt) throw new Error('INJECTED_WRITE_FAILURE');
        return doc.set(value);
      }};},where(filter){let take=20;const query={orderBy(){return query;},limit(limit){take=limit;return query;},async get(){
        const matches=[...rows.entries()].filter(([key,value])=>key.startsWith(name+'/')&&Object.entries(filter).every(([field,expected])=>{
          const actual=field.split('.').reduce((v,k)=>v?.[k],value);
          return expected && typeof expected==='object' && 'lte' in expected ? actual<=expected.lte : actual===expected;
        }));
        return {data:matches.map(([key,value])=>({_id:key.slice(name.length+1),...structuredClone(value)})).sort((a,b)=>a.nextAt-b.nextAt).slice(0,take)};
      }};return query;}};
    }};
  }
  collection(name){
    if(name==='teachers') return {where:({teacher_id})=>({limit:()=>({get:async()=>({data:['teacher','second'].includes(teacher_id)?[{teacher_id}]:[]})})})};
    return super.collection(name);
  }
}
function config(extra={}) {return {appId:APP_ID,cloudEnvId:ENV_ID,offerId:'123',originalId:'gh_fixture',env:0,batchId:'batch_one',source:'real_payment',
  processingTeachers:['teacher','second'],purchaseTeachers:['teacher','second'],administrators:['admin'],enabledChannels:['wechat'],purchaseEnabled:true,batchClosed:false,launchAt:BASE,...extra};}
async function setup(extra={},sharedDb=null){
  const policy=createPolicy(config(extra));const db=sharedDb || new Stage5Sdk();const repository=createStage5Repository(db,policy,{sleep:async()=>{}});
  const state={actor:'teacher',now:BASE};const p=paymentSetup();
  const environment={MEMBERSHIP_NOTIFICATION_TOKEN:cryptoConfig.token,MEMBERSHIP_NOTIFICATION_AES_KEY:cryptoConfig.encodingAESKey,
    STAGE5_INTERNAL_KEY:'LOCAL_TEST_INTERNAL_KEY_32_BYTES_MINIMUM',STAGE5_EVIDENCE_KEY:'LOCAL_TEST_EVIDENCE_KEY_32_BYTES_MINIMUM'};
  const wxCloud={getWXContext:()=>({APPID:APP_ID,OPENID:state.actor})};
  const runtime=createStage5Runtime({db,policy,wxCloud,environment,api:p.api,clock:()=>state.now});
  const record={product:product({channel:'wechat',allowedTestAccounts:['teacher','second']}),appId:APP_ID,offerId:'123',env:0,platformProductId:'annual_fixture'};
  if(!await repository.get('products',record.product.productId)) await repository.transaction(tx=>tx.put('products',record.product.productId,record));
  async function create(requestId='intent1'){return runtime.orders({action:'createOrder',request:{productId:record.product.productId,requestId}});}
  async function notification(orderId,changes={}){
    const order=await repository.get('orders',orderId);
    const event={ToUserName:policy.config.originalId,FromUserName:'official_fixture',MsgType:'event',Event:'xpay_goods_deliver_notify',CreateTime:BASE/1000,
      OpenId:order.openId,OutTradeNo:orderId,Env:0,GoodsInfo:{ProductId:order.platformProductId,Quantity:1,OrigPrice:order.amount,ActualPrice:order.amount,Attach:order.attach},...changes};
    return encrypt(event,{...cryptoConfig,appId:APP_ID,originalId:policy.config.originalId});
  }
  function internal(body={limit:20},nonce='LOCAL_NONCE_123456789'){
    const request={body:JSON.stringify(body),timestamp:state.now,nonce};
    request.signature=hmac(hmac(environment.STAGE5_INTERNAL_KEY,policy.scopeId),`${request.timestamp}\n${request.nonce}\n${request.body}`);return request;
  }
  return {policy,db,repository,state,runtime,environment,wxCloud,p,record,create,notification,internal};
}
module.exports={setup,config,Stage5Sdk,BASE,COLLECTIONS,hash,hmac};
