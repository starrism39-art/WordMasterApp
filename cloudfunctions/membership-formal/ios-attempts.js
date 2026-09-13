'use strict';
const {randomBytes}=require('node:crypto');
const {canonical,id}=require('../membership-core/model');
const {hash}=require('../membership-payment/crypto');
const {check,queryState,queryCashEvidence,goodsEvidence,refundEvidence}=require('../membership-payment/protocol');
const indexKey=attemptId=>'ios_attempt_'+hash(attemptId);
const version=o=>hash({attempts:o.iosAttempts,winner:o.iosWinningAttemptId||null,fact:o.fact||null,refund:o.refund||null});
async function resolveBusinessOrder(repo,input){
  const key=id(input),direct=await repo.get('orders',key);
  if(direct)return direct;
  const index=await repo.get('intents',indexKey(key));if(!index)return null;
  const order=await repo.get('orders',id(index.orderId));
  check(order?.channel==='apple_iap'&&index.kind==='ios_attempt_index'&&index.attemptId===key&&index.teacherId===order.teacherId&&order.iosAttempts?.some(a=>a.attemptId===key),'IOS_ATTEMPT_INDEX_MISMATCH');
  return order;
}
function attemptOrder(order,attempt){
  check(order.channel==='apple_iap'&&attempt,'IOS_ATTEMPT_REQUIRED');
  return {...order,orderId:attempt.attemptId,createdAt:attempt.createdAt,
    signData:JSON.stringify({...JSON.parse(order.signData),outTradeNo:attempt.attemptId}),
    goods:attempt.goods||null,fact:attempt.cash||null};
}
// Business order IDs and payment grant IDs remain unchanged. Platform IDs live
// only in this adapter and an indexed, bounded audit list on the business order.
function createIosAttempts({repository:repo,api,clock=Date.now}){
  async function load(orderId){const o=await repo.get('orders',id(orderId));check(o,'UNKNOWN_ORDER');return o;}
  async function ensure(orderId){
    return repo.transaction(async tx=>{
      const o=await tx.get('orders',orderId);check(o?.channel==='apple_iap','FORMAL_ORDER_CHANNEL_MISMATCH');
      if(o.iosAttempts)return o;
      check(!o.fact&&!o.refund&&!o.reviewRequired&&o.grantStatus==='none','IOS_ORDER_NOT_RETRYABLE');
      o.iosAttempts=[{attemptId:o.orderId,number:1,state:'active',createdAt:o.createdAt,issuedAt:o.createdAt,...(o.goods?{goods:o.goods}:{})}];
      o.iosActiveAttemptId=o.orderId;
      await tx.put('orders',orderId,o);
      await tx.put('intents',indexKey(orderId),{orderId,attemptId:orderId,teacherId:o.teacherId,kind:'ios_attempt_index'});
      return o;
    });
  }
  async function refresh(orderId){
    const before=await load(orderId);check(before.iosAttempts?.length&&before.iosAttempts.length<=8,'IOS_ATTEMPT_LIMIT');
    // No external request inside a database transaction. Any unknown/error
    // prevents rotation, including a signed attempt never received by WeChat.
    const results=await Promise.all(before.iosAttempts.map(async a=>{
      const virtual=attemptOrder(before,a),response=await api.query(virtual),state=queryState(virtual,response);
      check(response.order.order_fee===before.amount,'QUERY_AMOUNT_MISMATCH');
      const cash=state.kind==='paid'?queryCashEvidence(virtual,response,clock()):null;
      if(state.kind==='unpaid')check(!a.cash,'PAYMENT_STATE_REGRESSION');
      return {attemptId:a.attemptId,response,state:state.kind,cash};
    }));
    const at=clock();
    const order=await repo.transaction(async tx=>{
      const o=await tx.get('orders',orderId);check(version(o)===version(before),'IOS_ATTEMPT_CHANGED');
      for(const r of results){
        const a=o.iosAttempts.find(a=>a.attemptId===r.attemptId);
        a.platformStatus=r.response.order.status;a.queriedAt=at;a.queryHash=hash(r.response);
        if(r.cash){check(!a.cash||canonical(a.cash)===canonical(r.cash),'PAYMENT_FACT_CONFLICT');a.cash=r.cash;}
      }
      const paid=results.filter(r=>r.state==='paid'&&!o.iosAttempts.find(a=>a.attemptId===r.attemptId).finalRefund);
      if(!o.iosWinningAttemptId&&paid.length)o.iosWinningAttemptId=paid[0].attemptId;
      if(o.iosWinningAttemptId){
        o.iosActiveAttemptId=null;
        for(const a of o.iosAttempts){
          a.state=a.attemptId===o.iosWinningAttemptId?'paid':'superseded';
          if(a.cash&&a.attemptId!==o.iosWinningAttemptId){
            o.iosDuplicatePaymentReviewRequired=true;
            a.duplicatePaymentReview={code:'IOS_DUPLICATE_PAYMENT',state:a.finalRefund?'refunded':'manual_refund_review',transactionId:a.cash.transactionId,amount:a.cash.amount};
            await tx.put('events',hash({orderId,attemptId:a.attemptId,kind:'ios_duplicate_payment'}),{orderId,attemptId:a.attemptId,kind:'review_required',code:'IOS_DUPLICATE_PAYMENT',state:a.finalRefund?'resolved_refund':'review_required',transactionId:a.cash.transactionId,amount:a.cash.amount,recordedAt:at});
          }
        }
        const winner=o.iosAttempts.find(a=>a.attemptId===o.iosWinningAttemptId);
        if(winner.goods){o.goods={...winner.goods,orderId};if(o.reviewRequired==='PRODUCT_EVIDENCE_REQUIRED'){o.reviewRequired=null;o.paymentStatus='awaiting_payment';}}
        else delete o.goods; // Never borrow another attempt's product evidence.
      }
      await tx.put('orders',orderId,o);return o;
    });
    return {order,results};
  }
  async function prepare(orderId,loginCode){
    await ensure(orderId);
    const scan=await refresh(orderId),before=scan.order;
    if(before.iosWinningAttemptId)return {paid:true};
    check(scan.results.every(r=>['unpaid','closed'].includes(r.state)),'IOS_ATTEMPT_REQUIRES_REVIEW');
    const at=clock(),attemptId='wi'+randomBytes(15).toString('hex'),requestHash=hash(loginCode);
    await repo.transaction(async tx=>{
      const o=await tx.get('orders',orderId);check(version(o)===version(before),'IOS_ATTEMPT_CHANGED');
      check(!o.fact&&!o.refund&&!o.reviewRequired&&!o.iosWinningAttemptId,'IOS_ORDER_NOT_RETRYABLE');
      check(o.iosAttempts.length<8,'IOS_ATTEMPT_LIMIT');
      check(!o.iosAttempts.some(a=>a.requestHash===requestHash),'IOS_ATTEMPT_ALREADY_ISSUED');
      const active=o.iosAttempts.find(a=>a.attemptId===o.iosActiveAttemptId);
      check(!active||at-active.issuedAt>=60000,'IOS_PAYMENT_IN_PROGRESS');
      for(const a of o.iosAttempts)if(a.state==='active'){a.state='superseded';a.supersededAt=at;a.supersededBy=attemptId;}
      check(!await tx.get('intents',indexKey(attemptId)),'IOS_ATTEMPT_COLLISION');
      const a={attemptId,number:o.iosAttempts.length+1,state:'active',createdAt:at,issuedAt:at,requestHash};
      o.iosAttempts.push(a);o.iosActiveAttemptId=attemptId;o.paymentStatus='awaiting_payment';o.updatedAt=at;
      await tx.put('intents',indexKey(attemptId),{orderId,attemptId,teacherId:o.teacherId,kind:'ios_attempt_index'});
      await tx.put('orders',orderId,o);
      await tx.put('events',hash({orderId,attemptId,kind:'ios_attempt_created'}),{orderId,attemptId,kind:'ios_attempt_created',number:a.number,recordedAt:at,priorQueryHashes:before.iosAttempts.map(a=>a.queryHash)});
      await tx.put('work',orderId,{orderId,state:'pending',attempts:0,nextAt:at,lastCode:null});
    });
    return {paid:false,attemptId};
  }
  const adaptedApi={...api,
    async parameters(order,who,loginCode){
      if(!order.iosAttempts)return api.parameters(order,who,loginCode);
      const a=order.iosAttempts.find(a=>a.attemptId===order.iosActiveAttemptId);
      check(a?.state==='active'&&!order.iosWinningAttemptId&&a.requestHash===hash(loginCode),'IOS_ATTEMPT_NOT_ACTIVE');
      const result=await api.parameters(attemptOrder(order,a),who,loginCode);
      const latest=await load(order.orderId);
      check(latest.iosActiveAttemptId===a.attemptId&&!latest.iosWinningAttemptId&&!latest.fact,'IOS_ATTEMPT_NOT_ACTIVE');
      return result;
    },
    async query(order){
      if(!order.iosAttempts)return api.query(order);
      const latest=await load(order.orderId),a=latest.iosAttempts.find(a=>a.attemptId===latest.iosWinningAttemptId);
      check(a,'IOS_WINNER_NOT_CONFIRMED');
      const response=await api.query(attemptOrder(latest,a));queryState(attemptOrder(latest,a),response);
      return {...response,order:{...response.order,order_id:order.orderId}};
    },
    async delivered(order){
      if(!order.iosAttempts)return api.delivered(order);
      const a=order.iosAttempts.find(a=>a.attemptId===order.iosWinningAttemptId);check(a,'IOS_WINNER_NOT_CONFIRMED');
      return api.delivered(attemptOrder(order,a));
    }
  };
  async function reconcile(payment,orderId,options={}){
    const o=await resolveBusinessOrder(repo,orderId);check(o,'UNKNOWN_ORDER');orderId=o.orderId;
    if(!o.iosAttempts)return payment.reconcile(orderId,options);
    const {order}=await refresh(orderId);
    if(!order.iosWinningAttemptId)return {orderId,paymentStatus:order.paymentStatus,grantStatus:order.grantStatus,confirmation:'unpaid'};
    return payment.reconcile(orderId,{refresh:true});
  }
  async function notification(payment,event){
    const attemptId=id(event.OutTradeNo||event.MchOrderId);
    const o=await resolveBusinessOrder(repo,attemptId);check(o,'UNKNOWN_ORDER');
    if(!o.iosAttempts)return payment.authenticatedEvent(event);
    const a=o.iosAttempts.find(a=>a.attemptId===attemptId);check(a,'IOS_ATTEMPT_REQUIRED');
    const virtual=attemptOrder(o,a);
    if(event.Event==='xpay_goods_deliver_notify'){
      const goods=goodsEvidence(virtual,event);
      await repo.transaction(async tx=>{
        const latest=await tx.get('orders',o.orderId),entry=latest.iosAttempts.find(a=>a.attemptId===attemptId);
        if(entry.goods){const {eventId:oldId,...old}=entry.goods,{eventId:newId,...next}=goods;check(canonical(old)===canonical(next),'GOODS_FACT_CONFLICT');}
        entry.goods=goods;await tx.put('orders',o.orderId,latest);
        await tx.put('events',goods.eventId,{orderId:o.orderId,attemptId,kind:'authenticated_goods',recordedAt:clock()});
        await tx.put('work',o.orderId,{orderId:o.orderId,state:'pending',attempts:0,nextAt:clock(),lastCode:null});
      });
      const result=await reconcile(payment,o.orderId);
      const latest=await load(o.orderId),entry=latest.iosAttempts.find(a=>a.attemptId===attemptId);
      check(entry.cash,'QUERY_NOT_PAID');return result;
    }
    if(event.Event==='xpay_refund_notify'){
      // Refunds on a duplicate payment never revoke the winning grant.
      if(o.iosWinningAttemptId===attemptId){
        const result=await payment.authenticatedEvent({...event,MchOrderId:o.orderId});
        await repo.transaction(tx=>tx.put('work',o.orderId,{orderId:o.orderId,state:'pending',attempts:0,nextAt:clock()+3600000,lastCode:null}));
        return result;
      }
      const fact=refundEvidence(virtual,event,clock());
      await repo.transaction(async tx=>{
        const latest=await tx.get('orders',o.orderId),entry=latest.iosAttempts.find(a=>a.attemptId===attemptId);
        check(latest.iosWinningAttemptId!==attemptId,'IOS_ATTEMPT_CHANGED');
        check(!entry.finalRefund||canonical(entry.finalRefund)===canonical(fact),'REFUND_FACT_CONFLICT');
        entry.finalRefund=fact;
        if(entry.duplicatePaymentReview)entry.duplicatePaymentReview.state='refunded';
        await tx.put('orders',o.orderId,latest);
        await tx.put('events',hash({orderId:o.orderId,attemptId,fact}),{orderId:o.orderId,attemptId,kind:'ios_attempt_refund',fact,recordedAt:clock()});
      });return {orderId:o.orderId,duplicateRefundRecorded:true,refundResultRecorded:true};
    }
    throw Error('UNSUPPORTED_EVENT_REQUIRES_REVIEW');
  }
  async function compensate(payment,jobs){
    const results=[];
    for(const job of jobs){let code=null;
      try{await reconcile(payment,job.orderId);const o=await load(job.orderId);if(o.grantStatus==='granted'&&!o.refund)await adaptedApi.delivered(o);}
      catch(e){code=/^[A-Z_]{3,80}$/.test(e.message)?e.message:'PROCESSING_FAILED';}
      // Keep auditing superseded platform orders even after the business grant.
      await repo.transaction(async tx=>{const current=await tx.get('work',job.orderId);await tx.put('work',job.orderId,{...current,orderId:job.orderId,state:'pending',nextAt:clock()+3600000,lastCode:code});});
      results.push({orderId:job.orderId,status:code?'pending_or_exception':'ios_attempts_monitored',...(code?{code}:{})});
    }return results;
  }
  return {api:adaptedApi,prepare,reconcile,notification,compensate,resolve:input=>resolveBusinessOrder(repo,input)};
}
module.exports={createIosAttempts,attemptOrder,resolveBusinessOrder};
