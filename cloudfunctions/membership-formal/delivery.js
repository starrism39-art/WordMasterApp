'use strict';
const {queryEvidence,check}=require('../membership-payment/protocol');
const {canonical}=require('../membership-core/model');
// A successful goods callback already completes delivery at WeChat. Recheck
// the same paid transaction before deciding whether a fallback notice is needed.
function withConfirmedDelivery(api,{clock=Date.now}={}){
  return {...api,async delivered(order){
    const response=await api.query(order);
    const fact=queryEvidence(order,response,order.goods||null,clock());
    check(order.fact&&canonical(fact)===canonical(order.fact),'PAYMENT_FACT_CONFLICT');
    if(response.order.status===4)return;
    return api.delivered(order);
  }};
}
module.exports={withConfirmedDelivery};
