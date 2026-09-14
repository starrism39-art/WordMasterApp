'use strict';
const {id,strictKeys,product}=require('../membership-core/model');
const {check}=require('../membership-payment/protocol');
const {APP_ID,ENV_ID,FORMAL_PRODUCT}=require('../membership-presentation/config');
const DEFAULTS=Object.freeze({formalPurchaseEnabled:false,allowedPlatforms:['android'],allowedProductId:'teacher_member_12m',controlledTeachers:[],controlledPreparationEnabled:false,controlledPaymentEnabled:false,ordersReady:false,iosTeacher:'',iosPreparationEnabled:false,iosPaymentEnabled:false,iosPlatformReady:false,iosExpiresAt:0,iosAttemptRetriesEnabled:false});
function configuration(environment={}) {
  const input=environment.MEMBERSHIP_FORMAL_CONFIG?JSON.parse(environment.MEMBERSHIP_FORMAL_CONFIG):{};
  strictKeys(input,[...Object.keys(DEFAULTS),'appId','cloudEnvId','offerId','originalId']);
  const c={...DEFAULTS,...input,appId:APP_ID,cloudEnvId:ENV_ID,env:0,enabledChannels:['wechat','apple_iap'],orderScope:'formal_android_v1'};
  check((input.appId===undefined||input.appId===APP_ID)&&(input.cloudEnvId===undefined||input.cloudEnvId===ENV_ID),'FORMAL_WRONG_ENVIRONMENT');
  for(const key of ['formalPurchaseEnabled','controlledPreparationEnabled','controlledPaymentEnabled','ordersReady','iosPreparationEnabled','iosPaymentEnabled','iosPlatformReady','iosAttemptRetriesEnabled'])check(typeof c[key]==='boolean','FORMAL_INVALID_SWITCH');
  check(typeof c.iosTeacher==='string'&&Number.isSafeInteger(c.iosExpiresAt)&&c.iosExpiresAt>=0,'FORMAL_INVALID_IOS_GATE');
  if(c.iosTeacher)id(c.iosTeacher);
  check(c.allowedProductId===FORMAL_PRODUCT.productId,'FORMAL_PRODUCT_MISMATCH');
  check(Array.isArray(c.allowedPlatforms)&&c.allowedPlatforms.length>=1&&c.allowedPlatforms.length<=2&&c.allowedPlatforms[0]==='android'&&new Set(c.allowedPlatforms).size===c.allowedPlatforms.length&&c.allowedPlatforms.every(platform=>['android','ios'].includes(platform)),'FORMAL_PLATFORM_NOT_RELEASED');
  const iosReleased=c.formalPurchaseEnabled&&c.allowedPlatforms.includes('ios');
  if(c.iosPreparationEnabled||c.iosPaymentEnabled)check(c.iosPlatformReady&&(iosReleased||(c.iosTeacher&&c.iosExpiresAt>0)),'FORMAL_INVALID_IOS_GATE');
  check(Array.isArray(c.controlledTeachers)&&c.controlledTeachers.length<=32&&new Set(c.controlledTeachers).size===c.controlledTeachers.length,'FORMAL_INVALID_TEACHERS');
  c.controlledTeachers.forEach(x=>id(x));
  return Object.freeze(c);
}
function ready(c){check(c.ordersReady&&/^\d+$/.test(c.offerId||'')&&/^gh_[A-Za-z0-9]+$/.test(c.originalId||''),'FORMAL_NOT_CONFIGURED');}
function iosBuyer(c,teacherId,now){return c.iosPlatformReady&&((c.formalPurchaseEnabled&&c.allowedPlatforms.includes('ios'))||(!!c.iosTeacher&&c.iosTeacher===teacherId&&now<c.iosExpiresAt));}
function mayPrepare(c,teacherId,platform,now=Date.now()){return platform==='ios'?iosBuyer(c,teacherId,now)&&(c.iosPreparationEnabled||c.iosPaymentEnabled):platform==='android'&&c.allowedPlatforms.includes(platform)&&(c.formalPurchaseEnabled||((c.controlledPreparationEnabled||c.controlledPaymentEnabled)&&c.controlledTeachers.includes(teacherId)));}
function mayPay(c,teacherId,platform,now=Date.now()){return mayPrepare(c,teacherId,platform,now)&&(platform==='ios'?c.iosPaymentEnabled:c.formalPurchaseEnabled||(c.controlledPaymentEnabled&&c.controlledTeachers.includes(teacherId)));}
function buyer(c,teacherId,platform,now){check(mayPrepare(c,teacherId,platform,now),'FORMAL_PURCHASE_NOT_RELEASED');ready(c);}
function validateProduct(row,c,channel='wechat'){
  check(row&&!row._stage5&&row.appId===c.appId&&row.offerId===c.offerId&&row.env===0&&row.platformProductId===c.allowedProductId,'FORMAL_PRODUCT_MISMATCH');
  const p=product(row.product);
  check(p.productId===c.allowedProductId&&p.testOnly===false&&p.channel===channel&&p.price===39900&&p.autoRenew===false,'FORMAL_PRODUCT_MISMATCH');
  return p;
}
function validateOrder(o,c){
  check(o&&!o._stage5&&o.teacherId===o.openId&&o.purchaseDomain==='formal_android_v1','FORMAL_ORDER_MISMATCH');
  check(['wechat','apple_iap'].includes(o.channel),'FORMAL_ORDER_MISMATCH');
  const p=validateProduct({product:o.productSnapshot,appId:o.appId,offerId:o.offerId,env:o.env,platformProductId:o.platformProductId},c,o.channel);
  check(o.amount===p.price&&o.currency==='CNY'&&o.unit==='fen'&&o.quantity===1,'FORMAL_ORDER_MISMATCH');
  return o;
}
module.exports={configuration,DEFAULTS,ready,mayPrepare,mayPay,buyer,validateProduct,validateOrder};
