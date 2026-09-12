'use strict';
const { id, strictKeys } = require('../membership-core/model');
const { createCloudbaseRepository } = require('../membership-payment/repository');
const { membershipModel, orderModel } = require('./model');
const { APP_ID, configuration, publicConfig } = require('./config');
const {createFormalRuntime}=require('../membership-formal/runtime');
function createPresentationRuntime({db, wxCloud, environment = {}, clock = Date.now}) {
  const config = configuration(environment);
  const repository = createCloudbaseRepository(db);
  return async event => {
    strictKeys(event,['action','request','userInfo','tcbContext']);
    const who = wxCloud.getWXContext();
    if (who?.APPID !== APP_ID || !['wx_client','wx_devtools'].includes(who.SOURCE || 'wx_client')) throw Error('IDENTITY_NOT_VERIFIED');
    const teacherId = id(who.OPENID), request = event.request || {};
    const allowed = {getDisplay:['platform'],getOrders:['offset'],getOrderDetail:['orderId'],getPublicConfig:[],createOrder:['requestId','platform'],parameters:['orderId','loginCode','platform'],queryOrder:['orderId']};
    if (!allowed[event.action]) throw Error('ACTION_NOT_ALLOWED');
    strictKeys(request,allowed[event.action]);
    if (event.action === 'getPublicConfig') return publicConfig(config);
    const formal=createFormalRuntime({db,wxCloud,environment,clock});
    if (['createOrder','parameters','queryOrder'].includes(event.action)) return formal.orders(event);
    const row = await repository.get('ledgers',teacherId);
    if (row?.teacherId !== teacherId || row._stage5 || row.initialization?.state !== 'ready') throw Error('MEMBERSHIP_UNAVAILABLE');
    // Validate live document ownership, but never call personal.open or a writing repository.
    for (const student of row.students || []) {
      if (student.teacherId !== teacherId) throw Error('STUDENT_OWNERSHIP_CONFLICT');
      const ref = row.studentRefs?.[student.studentId];
      if (!ref) throw Error('STUDENT_REFERENCE_REQUIRED');
      const result = await db.collection('students').doc(ref).get();
      const doc = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!doc || doc.deleted === true) student.deleted = true;
      else if (doc.teacher_id !== teacherId || String(doc.student_id || doc.id) !== student.studentId || doc.name !== student.name) throw Error('STUDENT_OWNERSHIP_CONFLICT');
    }
    const now = clock();
    const model = membershipModel(row,now,{...config,purchaseEnabled:formal.canPrepare(teacherId,request.platform)});
    async function orders(offset, limit) {
      // Explicit deployment fact: formal orders have not been provisioned yet.
      // Never convert a failed database request into an empty successful list.
      if (!config.ordersReady&&!formal.config.ordersReady) return [];
      const result = await db.collection('membership_orders').where({teacherId,openId:teacherId,appId:APP_ID})
        .orderBy('createdAt','desc').skip(offset).limit(limit).get();
      return (result.data || []).map(o => { if (o.appId !== APP_ID) throw Error('ORDER_UNAVAILABLE');return orderModel(o,row,config,now); });
    }
    if (event.action === 'getDisplay') {
      // Scan the owner's persisted orders: recovery never depends on a local order ID.
      let offset=0, pending=false, awaitingPayment=false, purchaseBlocked=false, blockedCount=0, resumeOrderId='';
      while (true) { const batch=await orders(offset,100);pending ||= batch.some(o=>o.pending);awaitingPayment ||= batch.some(o=>o.awaitingPayment);purchaseBlocked ||= batch.some(o=>o.purchaseBlocked);for(const order of batch){if(order.purchaseBlocked)blockedCount++;if(order.awaitingPayment)resumeOrderId=order.id;}if(batch.length<100)break;offset+=100;if(offset>=10000)throw Error('ORDER_SCAN_LIMIT'); }
      const canResumePayment=blockedCount===1 && awaitingPayment && !pending && formal.canPrepare(teacherId,request.platform);
      return {...model,showPurchase:model.showPurchase&&(!['active','expiring'].includes(model.displayState)||formal.canPrepare(teacherId,request.platform)),pending,awaitingPayment,canPurchase:model.canPurchase&&!purchaseBlocked,canRenew:model.canRenew&&!purchaseBlocked,
        canResumePayment,resumeOrderId:canResumePayment?resumeOrderId:'',purchaseLabel:canResumePayment?'继续支付':model.purchaseLabel,
        purchaseDisabledText:canResumePayment?'将继续支付已有订单，不会创建新订单':awaitingPayment ? '已有待付款订单，请勿重复支付' : model.purchaseDisabledText};
    }
    if (event.action === 'getOrders') {
      const offset = request.offset === undefined ? 0 : request.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw Error('INVALID_OFFSET');
      const batch = await orders(offset,21);
      return {orders:batch.slice(0,20),nextOffset:batch.length>20 ? offset+20 : null};
    }
    id(request.orderId);
    if (!config.ordersReady&&!formal.config.ordersReady) throw Error('ORDER_UNAVAILABLE');
    const order = await repository.get('orders',request.orderId);
    if (!order || order.orderId !== request.orderId || order.appId !== APP_ID) throw Error('ORDER_UNAVAILABLE');
    const detail = orderModel(order,row,config,now);
    return {orderDetail:detail};
  };
}
module.exports = {createPresentationRuntime};
