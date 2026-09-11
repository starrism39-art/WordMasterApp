'use strict';
const { id, strictKeys, canonical, resolveProduct, grant, reason } = require('../membership-core/model');
const { addDuration, instant } = require('../membership-core/time');
const { normalizeLedger, rebuildAccount } = require('../membership-core/ledger');
const { hash } = require('./crypto');
const { check, goodsEvidence, queryState, queryCashEvidence, queryEvidence, refundEvidence } = require('./protocol');

function createPaymentEngine({ repository: repo, api, config, getIdentity, getAdminIdentity = null, getReviewEvidence = null, clock = Date.now }) {
  const now = () => instant(clock());
  function configured(order) {
    check(config.appId && config.originalId && config.offerId && [0, 1].includes(config.env), 'PAYMENT_NOT_CONFIGURED');
    if (order) check(order.appId === config.appId && order.env === config.env && order.offerId === config.offerId, 'WRONG_APPLICATION');
  }
  async function actor() {
    const result = await getIdentity();
    id(result?.teacherId, 'IDENTITY');
    check(typeof result.openId === 'string' && result.openId.length > 0 && result.appId === config.appId, 'IDENTITY_NOT_VERIFIED');
    return result;
  }
  async function orderById(orderId) {
    id(orderId); const order = await repo.get('orders', orderId);
    check(order, 'UNKNOWN_ORDER'); configured(order); return order;
  }
  const view = order => ({ orderId: order.orderId, productId: order.productSnapshot.productId, amount: order.amount, currency: order.currency, unit: order.unit, paymentStatus: order.paymentStatus, grantStatus: order.grantStatus, ...paymentView(order) });
  async function owned(orderId) {
    const who = await actor(); const order = await orderById(orderId);
    check(order.teacherId === who.teacherId && order.openId === who.openId, 'ORDER_NOT_OWNED');
    return { who, order };
  }
  function pending(orderId, at) { return { orderId, state: 'pending', attempts: 0, nextAt: at, lastCode: null }; }
  async function claim(tx, order, transactionId) {
    const key = hash({ appId: order.appId, env: order.env, transactionId });
    const previous = await tx.get('claims', key);
    check(!previous || previous.orderId === order.orderId, 'TRANSACTION_ALREADY_BOUND');
    await tx.put('claims', key, { orderId: order.orderId, appId: order.appId, env: order.env, transactionId });
  }
  async function append(tx, order, entry, at) {
    const row = await tx.get('ledgers', order.teacherId) || { teacherId: order.teacherId, revision: 0, grants: [], access: null };
    row.grants = normalizeLedger(order.teacherId, [...row.grants, entry]);
    row.revision++;
    const account = rebuildAccount(order.teacherId, row.grants, row.access, at);
    await tx.put('grants', entry.grantId, entry);
    await tx.put('ledgers', order.teacherId, row);
    await tx.put('accounts', order.teacherId, account);
  }
  async function recordPaid(orderId, fact) {
    const at = now();
    return repo.transaction(async tx => {
      const order = await tx.get('orders', orderId);
      configured(order); check(order, 'UNKNOWN_ORDER');
      check(!order.reviewRequired || order.refund, 'ORDER_REQUIRES_REVIEW');
      check(!order.review?.candidate || order.review.candidate.transactionId === fact.transactionId, 'TRANSACTION_MISMATCH');
      await claim(tx, order, fact.transactionId);
      if (fact.wxpayOrderId) await claim(tx, order, `wxpay:${fact.wxpayOrderId}`);
      if (order.refund) { check(order.refund.transactionId === fact.transactionId, 'TRANSACTION_MISMATCH'); return view(order); }
      if (order.fact) { check(canonical(order.fact) === canonical(fact), 'PAYMENT_FACT_CONFLICT'); return view(order); }
      order.fact = fact; order.paymentStatus = 'paid'; order.grantStatus = 'pending'; order.updatedAt = at;
      await tx.put('orders', orderId, order);
      await tx.put('events', hash({ orderId, fact }), { orderId, kind: 'verified_payment', factHash: hash(fact), paidAt: fact.paidAt, amount: fact.amount, recordedAt: at });
      await tx.put('work', orderId, pending(orderId, at));
      return view(order);
    });
  }
  async function grantPaid(orderId, existingTransaction = null) {
    const at = now();
    const execute = async tx => {
      const order = await tx.get('orders', orderId); check(order, 'UNKNOWN_ORDER'); configured(order);
      if (order.paymentStatus === 'refunded' || order.grantStatus === 'granted') return view(order);
      check(!order.reviewRequired, 'ORDER_REQUIRES_REVIEW');
      check(order.paymentStatus === 'paid' && order.fact, 'PAYMENT_NOT_VERIFIED');
      const sourceId = `payment_${orderId}`;
      const entry = grant({ grantId: `grant_${hash({ teacherId: order.teacherId, sourceId })}`, teacherId: order.teacherId, sourceId, sourceType: 'payment', operation: 'grant', startsAt: order.fact.paidAt,
        endsAt: addDuration(order.fact.paidAt, order.productSnapshot.duration), duration: order.productSnapshot.duration, longTerm: false, status: 'recorded', createdAt: at, updatedAt: at,
        reason: 'Verified virtual goods payment', metadata: { paidAt: order.fact.paidAt, amount: order.amount, productId: order.productSnapshot.productId, orderId, transactionId: order.fact.transactionId, ...(order.adminConfirmation ? { adminConfirmation: order.adminConfirmation } : {}) } });
      await append(tx, order, entry, at);
      order.grantId = entry.grantId; order.grantStatus = 'granted'; order.updatedAt = at;
      await tx.put('orders', orderId, order);
      await tx.put('events', hash({ orderId, kind: 'grant' }), { orderId, kind: 'grant', grantId: entry.grantId, recordedAt: at });
      await tx.put('work', orderId, pending(orderId, at));
      return view(order);
    };
    return existingTransaction ? execute(existingTransaction) : repo.transaction(execute);
  }
  async function reconcile(orderId, options = {}) {
    try { return await reconcileCore(orderId, options); }
    catch (error) {
      if (['TRANSACTION_ALREADY_BOUND', 'TRANSACTION_MISMATCH', 'PAYMENT_FACT_CONFLICT', 'REFUND_BALANCE_REQUIRES_REVIEW', 'REFUND_FIELD_REQUIRES_REVIEW'].includes(error.message)) await holdForReview(orderId, error.message, { code: error.message });
      throw error;
    }
  }
  async function reconcileCore(orderId, { refresh = false } = {}) {
    const order = await orderById(orderId);
    if (order.paymentStatus === 'refunded') return view(order);
    if (order.reviewRequired) {
      if (order.reviewRequired === 'PRODUCT_EVIDENCE_REQUIRED') return view(order);
      throw new Error('ORDER_REQUIRES_REVIEW');
    }
    if (order.grantStatus !== 'granted' || refresh) {
      // Refresh pending grants too: a previously verified payment may have been
      // refunded while delivery was failing and the refund callback was lost.
      const response = await api.query(order);
      const state = queryState(order, response);
      if (state.kind === 'unpaid') {
        check(!order.fact, 'PAYMENT_STATE_REGRESSION');
        return { ...view(order), confirmation: 'unpaid' };
      }
      if (state.kind === 'closed') {
        check(!order.fact, 'PAYMENT_STATE_REGRESSION');
        await repo.transaction(async tx => {
          const latest = await tx.get('orders', orderId);
          if (!latest.fact && !latest.refund) {
            latest.paymentStatus = 'closed'; await tx.put('orders', orderId, latest);
          }
        });
        return { ...view(await orderById(orderId)), confirmation: 'closed' };
      }
      if (state.kind === 'refund_review') {
        await holdForReview(orderId, 'PLATFORM_REFUND_REQUIRES_REVIEW', response);
        throw new Error('ORDER_REQUIRES_REVIEW');
      }
      let evidence;
      try { evidence = queryEvidence(order, response, order.goods || null, now()); }
      catch (error) {
        if (error.message !== 'PRODUCT_EVIDENCE_REQUIRED') throw error;
        const candidate = queryCashEvidence(order, response, now());
        await repo.transaction(async tx => {
          const latest = await tx.get('orders', orderId);
          if (latest.fact || latest.refund || latest.goods || latest.reviewRequired) return;
          await claim(tx, latest, candidate.transactionId);
          if (candidate.wxpayOrderId) await claim(tx, latest, `wxpay:${candidate.wxpayOrderId}`);
          latest.reviewRequired = 'PRODUCT_EVIDENCE_REQUIRED';
          latest.paymentStatus = 'review_required'; latest.updatedAt = now();
          latest.review = { candidate, queryHash: hash(response), queriedAt: now(), missing: 'PRODUCT_EVIDENCE_REQUIRED' };
          await tx.put('orders', orderId, latest);
          await tx.put('events', hash({ orderId, candidate }), { orderId, kind: 'payment_pending_review', ...latest.review });
          await tx.put('work', orderId, { ...pending(orderId, now()), state: 'review_required', phase: 'review' });
        });
        const latest = await orderById(orderId);
        // A goods notification may have won the transaction race.
        if (latest.goods && !latest.reviewRequired) return reconcile(orderId);
        return view(latest);
      }
      await recordPaid(orderId, evidence);
    }
    return grantPaid(orderId);
  }
  async function holdForReview(orderId, code, evidence) {
    await repo.transaction(async tx => {
      const order = await tx.get('orders', orderId); if (!order) return;
      if (!order.refund) { order.reviewRequired = code; if (order.grantStatus !== 'granted') order.paymentStatus = code.startsWith('PLATFORM_REFUND') ? 'refund_pending' : 'exception'; }
      await tx.put('orders', orderId, order);
      await tx.put('events', hash({ orderId, code, evidence }), { orderId, kind: 'review_required', code, evidenceHash: hash(evidence), recordedAt: now() });
      await tx.put('work', orderId, { ...pending(orderId, now()), state: 'exception', phase: 'review', lastCode: code });
    });
  }
  async function goods(event) {
    const order = await orderById(event.OutTradeNo);
    const evidence = goodsEvidence(order, event); const at = now();
    await repo.transaction(async tx => {
      const latest = await tx.get('orders', order.orderId);
      if (latest.goods) {
        const { eventId: oldId, ...old } = latest.goods;
        const { eventId: newId, ...next } = evidence;
        check(canonical(old) === canonical(next), 'GOODS_FACT_CONFLICT');
      } else {
        latest.goods = evidence;
        if (!latest.refund && latest.reviewRequired === 'PRODUCT_EVIDENCE_REQUIRED') {
          latest.reviewRequired = null; latest.paymentStatus = 'awaiting_payment';
        }
        await tx.put('orders', order.orderId, latest);
        // No raw envelope, token, session key, or original buyer OPENID in event logs.
        await tx.put('events', evidence.eventId, { orderId: order.orderId, kind: 'authenticated_goods', recordedAt: at });
        await tx.put('work', order.orderId, pending(order.orderId, at));
      }
    });
    return reconcile(order.orderId);
  }
  async function refund(event) {
    const order = await orderById(event.MchOrderId);
    if (Number.isInteger(event.RetCode) && event.RetCode !== 0) {
      check(event.OpenId === order.openId && typeof event.WxOrderId === 'string' && (!order.fact || event.WxOrderId === order.fact.transactionId), 'REFUND_IDENTITY_MISMATCH');
      await repo.transaction(tx => tx.put('events', hash(event), { orderId: order.orderId, kind: 'refund_failed', platformCode: event.RetCode, recordedAt: now() }));
      return { ...view(order), refundResultRecorded: true };
    }
    const fact = refundEvidence(order, event, now()); const at = now();
    return repo.transaction(async tx => {
      const latest = await tx.get('orders', order.orderId);
      // Revalidate after acquiring transaction locks: payment may have arrived meanwhile.
      refundEvidence(latest, event, at);
      await claim(tx, latest, fact.transactionId);
      if (latest.refund) { check(canonical(latest.refund) === canonical(fact), 'REFUND_FACT_CONFLICT'); return view(latest); }
      if (latest.grantId) {
        const sourceId = `refund_${hash({ appId: latest.appId, refundId: fact.refundId })}`;
        const entry = grant({ grantId: `grant_${hash({ teacherId: latest.teacherId, sourceId })}`, teacherId: latest.teacherId, sourceId, sourceType: 'refund_adjustment', operation: 'revoke_remaining', targetGrantId: latest.grantId,
          startsAt: fact.refundedAt, endsAt: null, duration: null, longTerm: false, status: 'recorded', createdAt: at, updatedAt: at, reason: 'Authenticated platform final refund', metadata: { orderId: latest.orderId, refundId: fact.refundId, amount: fact.amount } });
        await append(tx, latest, entry, at);
      }
      latest.refund = fact; latest.paymentStatus = 'refunded'; latest.grantStatus = latest.grantId ? 'revoked' : 'suppressed'; latest.updatedAt = at;
      await tx.put('orders', latest.orderId, latest);
      await tx.put('events', hash({ orderId: latest.orderId, fact }), { orderId: latest.orderId, kind: 'refund', factHash: hash(fact), refundedAt: fact.refundedAt, amount: fact.amount, recordedAt: at });
      await tx.put('work', latest.orderId, { ...pending(latest.orderId, at), state: 'done' });
      return view(latest);
    });
  }
  return {
    async confirmPaidAndGrant(orderId, adminContext, evidence, why) {
      check(getAdminIdentity && getReviewEvidence, 'ADMIN_NOT_CONFIGURED');
      const operator = await getAdminIdentity(adminContext);
      check(operator?.isAdmin === true, 'ADMIN_REQUIRED'); id(operator.operatorId); reason(why);
      strictKeys(evidence, ['reference']); id(evidence.reference);
      const official = await getReviewEvidence(evidence.reference, operator.operatorId);
      check(official && official.reference === evidence.reference, 'REVIEW_EVIDENCE_REQUIRED');
      const at = now();
      return repo.transaction(async tx => {
        const order = await tx.get('orders', id(orderId)); check(order, 'UNKNOWN_ORDER'); configured(order);
        check(!order.refund && !['refunded', 'refund_pending', 'cancelled', 'closed', 'payment_failed'].includes(order.paymentStatus), 'ORDER_NOT_REVIEWABLE');
        const candidate = order.review?.candidate || order.fact;
        check(candidate && official.mode === 'short_series_goods' && official.status === 'paid', 'REVIEW_EVIDENCE_REQUIRED');
        for (const key of ['orderId', 'teacherId', 'appId', 'env', 'productId', 'channel', 'amount', 'currency', 'unit', 'transactionId', 'paidAt']) {
          check(official[key] === candidate[key], 'REVIEW_EVIDENCE_MISMATCH');
        }
        check(official.offerId === order.offerId && official.quantity === order.quantity && official.productId === order.platformProductId && official.amount === order.amount, 'REVIEW_EVIDENCE_MISMATCH');
        if (order.grantStatus === 'granted') return view(order);
        check(order.reviewRequired === 'PRODUCT_EVIDENCE_REQUIRED', 'ORDER_NOT_REVIEWABLE');
        await claim(tx, order, candidate.transactionId);
        if (candidate.wxpayOrderId) await claim(tx, order, `wxpay:${candidate.wxpayOrderId}`);
        const before = { order: structuredClone(order), account: await tx.get('accounts', order.teacherId) };
        order.fact = candidate; order.paymentStatus = 'paid'; order.grantStatus = 'pending'; order.reviewRequired = null;
        order.adminConfirmation = { operator: operator.operatorId, evidenceReference: evidence.reference, reason: why, at };
        await tx.put('orders', orderId, order);
        const result = await grantPaid(orderId, tx);
        const after = { order: await tx.get('orders', orderId), account: await tx.get('accounts', order.teacherId) };
        await tx.put('audits', hash({ orderId, action: 'confirm_paid_and_grant' }), {
          orderId, teacherId: order.teacherId, amount: order.amount, productId: order.productSnapshot.productId,
          transactionId: candidate.transactionId, grantId: after.order.grantId, operator: operator.operatorId,
          reason: why, evidenceReference: evidence.reference, evidenceHash: hash(official), createdAt: at, before, after
        });
        return result;
      });
    },
    async createOrder(request) {
      strictKeys(request, ['productId', 'requestId']); id(request.productId); id(request.requestId);
      configured(); const who = await actor();
      check(config.purchaseEnabled === true, 'PURCHASE_DISABLED');
      const at = now(); const key = hash({ appId: config.appId, env: config.env, teacherId: who.teacherId, requestId: request.requestId,
        ...(config.orderScope ? { orderScope: config.orderScope } : {}) });
      return repo.transaction(async tx => {
        const prior = await tx.get('intents', key);
        if (prior) {
          check(prior.productId === request.productId && prior.openId === who.openId, 'INTENT_CONFLICT');
          return view(await tx.get('orders', prior.orderId));
        }
        const record = await tx.get('products', request.productId); check(record, 'PRODUCT_NOT_AVAILABLE');
        const product = resolveProduct(record.product, who.teacherId);
        check(product.productId === request.productId && record.appId === config.appId && record.offerId === config.offerId && record.env === config.env && typeof record.platformProductId === 'string' && record.platformProductId.length > 0, 'PRODUCT_CONFIGURATION_MISMATCH');
        check(config.enabledChannels?.includes(product.channel), 'CHANNEL_NOT_VERIFIED');
        check(!(product.channel === 'apple_iap' && config.env === 1), 'IOS_SANDBOX_UNSUPPORTED');
        const ledger = await tx.get('ledgers', who.teacherId);
        check(!ledger || rebuildAccount(who.teacherId, ledger.grants, ledger.access, at).status !== 'long_term', 'LONG_TERM_PURCHASE_DISABLED');
        const orderId = `wm${key.slice(0, 30)}`; const attach = hash({ key, product });
        const signData = JSON.stringify({ offerId: config.offerId, buyQuantity: 1, env: config.env, currencyType: 'CNY', productId: record.platformProductId, goodsPrice: product.price, outTradeNo: orderId, attach });
        const order = { orderId, teacherId: who.teacherId, openId: who.openId, appId: config.appId, offerId: config.offerId, env: config.env, platformProductId: record.platformProductId, productSnapshot: product, channel: product.channel,
          amount: product.price, currency: 'CNY', unit: 'fen', quantity: 1, attach, signData, paymentStatus: 'awaiting_payment', grantStatus: 'none', createdAt: at, updatedAt: at };
        await tx.put('orders', orderId, order);
        await tx.put('intents', key, { orderId, productId: request.productId, openId: who.openId });
        await tx.put('work', orderId, pending(orderId, at));
        return view(order);
      });
    },
    async parameters(request) {
      strictKeys(request, ['orderId', 'loginCode']); const { who, order } = await owned(request.orderId);
      check(config.purchaseEnabled === true && order.paymentStatus === 'awaiting_payment', 'ORDER_NOT_PURCHASABLE');
      const live = await repo.get('products', order.productSnapshot.productId);
      check(live && canonical(resolveProduct(live.product, who.teacherId)) === canonical(order.productSnapshot) && live.platformProductId === order.platformProductId && live.env === order.env && live.appId === order.appId && live.offerId === order.offerId && config.enabledChannels?.includes(order.channel), 'PRODUCT_CONFIGURATION_CHANGED');
      return api.parameters(order, who, request.loginCode);
    },
    async queryOrder(request) {
      strictKeys(request, ['orderId']); id(request.orderId);
      const who = await actor();
      // My Orders reads persisted facts only. It must remain available while
      // purchasing is disabled or payment credentials are unavailable/rotating.
      // The repository controls collection/scope; neither is a client parameter.
      const order = await (repo.readOrder ? repo.readOrder(request.orderId) : repo.get('orders',request.orderId));
      check(order, 'UNKNOWN_ORDER');
      check(order.orderId === request.orderId, 'ORDER_ID_MISMATCH');
      check(order.appId === config.appId && order.env === config.env && order.offerId === config.offerId, 'WRONG_APPLICATION');
      check(order.teacherId === who.teacherId && order.openId === who.openId, 'ORDER_NOT_OWNED');
      check(order.productSnapshot && typeof order.productSnapshot.productId === 'string' && Number.isSafeInteger(order.amount) && order.amount > 0 && order.amount === order.productSnapshot.price && order.currency === 'CNY' && order.unit === 'fen' && typeof order.paymentStatus === 'string' && typeof order.grantStatus === 'string', 'INVALID_ORDER_RECORD');
      return view(order);
    },
    // Internal methods below must NEVER be exposed as client-selected actions.
    async authenticatedEvent(event) {
      check(event?.ToUserName === config.originalId && event.MsgType === 'event', 'WRONG_APPLICATION');
      try {
        if (event.Event === 'xpay_goods_deliver_notify') return await goods(event);
        if (event.Event === 'xpay_refund_notify') return await refund(event);
        throw new Error('UNSUPPORTED_EVENT_REQUIRES_REVIEW');
      } catch (error) {
        const code = /^[A-Z_]{3,80}$/.test(error.message) ? error.message : 'PROCESSING_FAILED';
        const eventId = hash(event); const orderId = event.OutTradeNo || event.MchOrderId || null;
        if (orderId && ['TRANSACTION_ALREADY_BOUND', 'TRANSACTION_MISMATCH', 'PAYMENT_FACT_CONFLICT'].includes(code)) await holdForReview(orderId, code, { eventId });
        // Authenticated failures, partial refunds and iOS refund inquiries remain visible.
        // Neither arbitrary raw payloads nor sensitive credential material are logged.
        try { await repo.transaction(tx => tx.put('events', eventId, { orderId, kind: 'processing_exception', state: 'review_required', code, recordedAt: now() })); } catch { /* callback remains failure; never acknowledge lost work */ }
        throw error;
      }
    },
    reconcile,
    async compensate({ limit = 20 } = {}) {
      check(Number.isInteger(limit) && limit > 0 && limit <= 50, 'INVALID_BATCH');
      const jobs = await repo.due(now(), limit); const results = [];
      for (const job of jobs) {
        try {
          const result = await reconcile(job.orderId);
          if (result.confirmation === 'unpaid') {
            await repo.transaction(async tx => {
              const current = await tx.get('work', job.orderId);
              const order = await tx.get('orders', job.orderId);
              if (current?.state === 'pending' && !order.fact && !order.refund && !order.reviewRequired) {
                // Local polling policy, NOT an invented official expiry. Only
                // the platform's closed/refund state can terminate unpaid polling.
                const age = now() - order.createdAt;
                await tx.put('work', job.orderId, { ...current, phase: 'awaiting_payment', needsReview: age >= 86400000, nextAt: now() + (age < 3600000 ? 60000 : 3600000), lastCode: null });
              }
            });
            results.push({ orderId: job.orderId, status: 'awaiting_payment' }); continue;
          }
          if (result.status === 'review_required') { results.push({ orderId: job.orderId, status: 'review_required' }); continue; }
          const order = await orderById(job.orderId);
          if (order.grantStatus === 'granted') await api.delivered(order);
          await repo.transaction(async tx => {
            const current = await tx.get('work', job.orderId);
            if (current) await tx.put('work', job.orderId, { ...current, state: 'done', lastCode: null });
          });
          results.push({ orderId: job.orderId, status: 'done' });
        } catch (error) {
          // Known application codes only; never persist SDK messages containing credentials.
          const code = /^[A-Z_]{3,80}$/.test(error.message) ? error.message : 'PROCESSING_FAILED';
          if (['TRANSACTION_ALREADY_BOUND', 'TRANSACTION_MISMATCH', 'PAYMENT_FACT_CONFLICT', 'REFUND_BALANCE_REQUIRES_REVIEW'].includes(code)) await holdForReview(job.orderId, code, { code });
          await repo.transaction(async tx => {
            const current = await tx.get('work', job.orderId);
            if (!current || current.state !== 'pending') return;
            const order = await tx.get('orders', job.orderId);
            if (!order.fact) {
              const polls = (current.confirmationFailures || 0) + 1;
              await tx.put('work', job.orderId, { ...current, phase: 'payment_confirmation', confirmationFailures: polls, needsReview: polls >= 12, nextAt: now() + Math.min(3600000, 30000 * 2 ** Math.min(polls, 7)), lastCode: code });
              return;
            }
            const attempts = current.attempts + 1;
            await tx.put('work', job.orderId, { ...current, phase: 'paid_delivery', attempts, state: attempts >= 12 ? 'exception' : 'pending', nextAt: now() + Math.min(3600000, 30000 * 2 ** Math.min(attempts, 7)), lastCode: code });
          });
          results.push({ orderId: job.orderId, status: 'pending_or_exception', code });
        }
      }
      return results;
    }
  };
}
function paymentView(order) {
  const status = order.paymentStatus === 'refunded' ? 'refunded'
    : order.paymentStatus === 'refund_pending' ? 'refund_pending'
    : order.reviewRequired ? (order.reviewRequired === 'PRODUCT_EVIDENCE_REQUIRED' ? 'review_required' : 'exception')
    : order.grantStatus === 'granted' ? 'granted'
    : order.paymentStatus === 'paid' && order.grantStatus === 'pending' ? 'grant_pending'
    : order.paymentStatus === 'closed' ? 'cancelled' : order.paymentStatus;
  const userStatus = status === 'granted' ? 'MEMBER_GRANTED'
    : ['review_required', 'exception', 'refund_pending', 'refunded'].includes(status) ? 'PAYMENT_PENDING_REVIEW'
    : status === 'cancelled' ? 'PAYMENT_CANCELLED'
    : status === 'payment_failed' ? 'PAYMENT_FAILED' : 'PAYMENT_PROCESSING';
  return { status, userStatus };
}
module.exports = { createPaymentEngine, paymentView };
