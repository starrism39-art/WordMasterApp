'use strict';
const {check}=require('../membership-payment/protocol');
// The official product is shared across devices. Adapt its immutable order
// snapshot only; never mutate the catalog, collections, pending lock or ledger.
function forIos(base){
  function wrap(raw){return {
    async get(role,key){
      const row=await raw.get(role,key);
      return role==='products'&&row?{...row,product:{...row.product,channel:'apple_iap'}}:row;
    },
    async put(role,key,row){
      if(role==='orders')check(row.channel==='apple_iap','FORMAL_ORDER_CHANNEL_MISMATCH');
      return raw.put(role,key,row);
    }
  };}
  return {...base,...wrap(base),transaction:fn=>base.transaction(tx=>fn(wrap(tx)))};
}
module.exports={forIos};
