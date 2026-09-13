'use strict';
const {setup,BASE,encrypt,cryptoConfig}=require('../membership-stage3/fixtures');
const {initializeAccess}=require('../../cloudfunctions/membership-core/access');
const {createFormalRuntime}=require('../../cloudfunctions/membership-formal/runtime');
const {createFormalRepository}=require('../../cloudfunctions/membership-formal/repository');
const {configuration}=require('../../cloudfunctions/membership-formal/policy');
const {APP_ID,ENV_ID}=require('../../cloudfunctions/membership-presentation/config');
const {hmac}=require('../../cloudfunctions/membership-payment/crypto');
function fixture(patch={}){
  const f=setup({config:{appId:APP_ID,originalId:'gh_localfixture'},product:{productId:'teacher_member_12m',testOnly:false,price:39900,allowedTestAccounts:[]}});
  f.sdk.seed('products',f.item.productId,{product:f.item,appId:APP_ID,offerId:f.config.offerId,env:0,platformProductId:f.item.productId});
  f.sdk.seed('ledgers','teacher',{teacherId:'teacher',revision:0,grants:[],students:[],studentRefs:{},operations:{legacy:'keep'},audits:[],initialization:{state:'ready'},access:initializeAccess({teacherId:'teacher',students:[],registeredAt:BASE,launchAt:BASE,now:BASE})});
  const c={appId:APP_ID,cloudEnvId:ENV_ID,offerId:f.config.offerId,originalId:f.config.originalId,formalPurchaseEnabled:false,controlledPreparationEnabled:true,controlledTeachers:['teacher'],allowedPlatforms:['android'],allowedProductId:f.item.productId,ordersReady:true,...patch};
  const environment={MEMBERSHIP_FORMAL_CONFIG:JSON.stringify(c),MEMBERSHIP_INTERNAL_KEY:'LOCAL_INTERNAL_KEY_'.repeat(3),MEMBERSHIP_NOTIFICATION_TOKEN:cryptoConfig.token,MEMBERSHIP_NOTIFICATION_AES_KEY:cryptoConfig.encodingAESKey};
  let actor='teacher';
  const db={collection:()=>({where:filter=>({limit:()=>({get:async()=>({data:filter.teacher_id==='teacher'?[{teacher_id:'teacher'}]:[]})})})})};
  const repo=createFormalRepository(null,configuration(environment),{base:f.repo,clock:()=>f.state.clock});
  const runtime=createFormalRuntime({db,wxCloud:{getWXContext:()=>({APPID:APP_ID,OPENID:actor,SOURCE:'wx_client'})},environment,repository:repo,api:f.api,clock:()=>f.state.clock});
  const call=(action,request)=>runtime.orders({action,request});
  const create=(requestId='first')=>call('createOrder',{requestId,platform:'android'});
  return {...f,repo,runtime,environment,call,create,setActor:v=>{actor=v;}};
}
module.exports={fixture,BASE,encrypt,cryptoConfig,APP_ID,hmac};
