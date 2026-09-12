'use strict';
const {createCloudbaseRepository}=require('../membership-payment/repository');
const {canonical,id}=require('../membership-core/model');
const {rebuildAccount}=require('../membership-core/ledger');
const {hash}=require('../membership-payment/crypto');
const {check}=require('../membership-payment/protocol');
const {validateProduct,validateOrder}=require('./policy');
function createFormalRepository(db,config,{base=createCloudbaseRepository(db),clock=Date.now}={}) {
  const terminal=o=>!o.reviewRequired&&!['refund_pending','exception','review_required'].includes(o.paymentStatus)&&(o.grantStatus==='granted'||['closed','cancelled','payment_failed','refunded'].includes(o.paymentStatus));
  function validate(role,row,key){
    if(!row)return row;
    check(!row._stage5,'FORMAL_DOMAIN_MISMATCH');
    if(role==='products')validateProduct(row,config);
    if(role==='orders'){check(row.orderId===key,'FORMAL_ORDER_MISMATCH');validateOrder(row,config);}
    if(role==='ledgers')check(row.teacherId===key&&row.initialization?.state==='ready'&&Array.isArray(row.grants)&&!row.grants.some(g=>g._stage5||g.teacherId!==key),'FORMAL_LEDGER_NOT_READY');
    if(['intents','claims','events','work'].includes(role))check(row.purchaseDomain==='formal_android_v1','FORMAL_DOMAIN_MISMATCH');
    return row;
  }
  function wrap(raw){
    const get=async(role,key)=>validate(role,await raw.get(role,id(key)),key);
    return {get,async put(role,key,input){
      let row=structuredClone(input);
      if(['orders','intents','claims','events','work'].includes(role))row.purchaseDomain='formal_android_v1';
      validate(role,row,key);
      if(role==='orders'&&!await get('orders',key)){
        const lockKey='formal_pending_'+hash(row.teacherId);
        const lock=await get('intents',lockKey);
        if(lock&&lock.orderId!==key){const prior=await get('orders',lock.orderId);check(prior&&terminal(prior),'FORMAL_ORDER_PENDING');}
        await raw.put('intents',lockKey,{orderId:key,openId:row.openId,productId:config.allowedProductId,purchaseDomain:'formal_android_v1'});
      }
      if(role==='ledgers'){
        const before=await get('ledgers',key);check(before,'FORMAL_LEDGER_NOT_READY');
        // Payment may change grants/revision/account only. Preserve every business field.
        for(const name of new Set([...Object.keys(before),...Object.keys(row)]))if(!['grants','revision','account'].includes(name))check(canonical(before[name])===canonical(row[name]),'FORMAL_LEGACY_DATA_CHANGED');
        row.account=rebuildAccount(key,row.grants,row.access,clock());
      }
      await raw.put(role,key,row);
    }};
  }
  return {get:async(role,key)=>validate(role,await base.get(role,id(key)),key),transaction:operation=>base.transaction(tx=>operation(wrap(tx))),
    async due(now,limit){const jobs=await base.due(now,limit);for(const job of jobs){validate('work',job);check(await this.get('orders',job.orderId),'FORMAL_ORDER_REQUIRED');}return jobs;}};
}
module.exports={createFormalRepository};
