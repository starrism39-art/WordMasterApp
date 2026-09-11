'use strict';
const { evaluateAccess } = require('../membership-access/policy');
const { projectLedger } = require('../membership-core/ledger');
const { publicConfig } = require('./config');
const DAY = 86400000;
function date(value) {
  if (!Number.isSafeInteger(value) || value <= 0) return '';
  return new Date(value + 8 * 3600000).toISOString().slice(0,10).replace(/-/g, '/');
}
function membershipModel(row, now, config, pending = false) {
  if (!row || row.initialization?.state !== 'ready' || row._stage5 || !Array.isArray(row.students)) throw Error('MEMBERSHIP_UNAVAILABLE');
  const access = evaluateAccess({ ...row, action: 'ADD_STUDENT', now });
  const students = row.students.filter(s => s.teacherId === row.teacherId && !s.deleted);
  const retained = students.find(s => s.studentId === access.retainedStudentId);
  const remainingDays = access.expiresAt ? Math.max(0, Math.ceil((access.expiresAt - now) / DAY)) : 0;
  const transitionRemainingDays = access.membershipStatus === 'transition' ? Math.max(0, Math.ceil((access.transitionEndsAt - now) / DAY)) : 0;
  const ended = access.membershipStatus === 'expired' || (row.access.transitionEndsAt !== null && row.access.transitionEndsAt <= now && !access.unlimitedStudents);
  const needsRetentionSelection = !access.unlimitedStudents && access.membershipStatus !== 'transition' && !access.retainedStudentId && students.length > 0;
  let displayState = access.membershipStatus;
  if (displayState === 'active' && remainingDays <= config.expiringDays) displayState = 'expiring';
  if (ended) displayState = students.length <= 1 && retained ? 'expired_single' : retained ? 'expired_retained' : 'expired_selection';
  // A free account with unselected existing students must also expose the existing retention operation.
  if (displayState === 'free' && needsRetentionSelection) displayState = 'expired_selection';
  const labels = {free:'免费',active:'有效',expiring:'即将到期',transition:'剩余 ' + transitionRemainingDays + ' 天',
    expired_single:'已到期',expired_selection:'待选择',expired_retained:'已保留1名',long_term:'长期有效'};
  if (!labels[displayState]) throw Error('MEMBERSHIP_UNAVAILABLE');
  const titles = {free:'免费版',active:'教师会员',expiring:'教师会员即将到期',transition:'个人缓冲期',
    expired_single:'会员已到期',expired_selection:'会员已到期',expired_retained:'会员已到期',long_term:'长期会员'};
  const expiry = date(access.expiresAt);
  const entrySubtitle = displayState === 'free' ? '免费版' : displayState === 'active' ? '有效期至 ' + expiry :
    displayState === 'expiring' ? remainingDays + ' 天后到期' : displayState === 'transition' ? '缓冲期剩余 ' + transitionRemainingDays + ' 天' : displayState === 'long_term' ? '长期有效' : '已到期';
  const summaries = { free:'累计可新增 1 名学生', active:'剩余 ' + remainingDays + ' 天', expiring:'剩余 ' + remainingDays + ' 天',
    transition:'当前仍可继续使用现有学生',expired_single:'免费版可继续访问1名学生',expired_selection: students.length ? '当前有 ' + students.length + ' 名学生，请固定保留1名学生' : '历史数据仍保留',
    expired_retained:'已保留：' + (retained?.name || ''),long_term:'学生数量不限' };
  const notices = {free:'开通后学生数量不限',active:'',expiring:'到期后学生和历史数据不会删除。限制访问不等于删除数据。',
    transition:'缓冲结束后，免费版仅可保留1名学生。其他学生及历史数据不会删除。限制访问不等于删除数据。',
    expired_single:'其他学生和历史数据仍会保留，重新开通后可恢复全部访问。限制访问不等于删除数据。',
    expired_selection:'其他学生和历史数据仍会保留，重新开通后可恢复全部访问。限制访问不等于删除数据。',
    expired_retained:'其他学生暂不可访问，重新开通后可恢复全部访问。限制访问不等于删除数据。',long_term:''};
  const renewing = ['active','expiring'].includes(displayState);
  return { ...publicConfig(config), displayState, statusLabel:labels[displayState], title:titles[displayState], entrySubtitle,
    attention: displayState === 'expiring' || needsRetentionSelection, summary:summaries[displayState], notice:notices[displayState],
    expiresAtText:expiry, expiryLabel:expiry ? '有效期至 ' + expiry.replace('/', '年').replace('/', '月') + '日' : '',
    remainingDays, transitionRemainingDays, transitionText:transitionRemainingDays ? '剩余 ' + transitionRemainingDays + ' 天' : '',
    studentCount:students.length, freeStudentLimit:1, retainedStudentId:access.retainedStudentId || '', retainedStudentName:retained?.name || '',
    needsRetentionSelection, retentionAllowed:needsRetentionSelection,
    retentionStudents: needsRetentionSelection ? students.filter(s => evaluateAccess({...row,action:'SELECT_RETAINED_STUDENT',studentId:s.studentId,now}).allowed)
      .map(s => ({id:s.studentId,name:s.name,initial:Array.from(s.name || '学')[0],grade:s.grade || ''})) : [],
    showPurchase:displayState !== 'long_term', showRules:displayState !== 'long_term',
    canPurchase:config.purchaseEnabled === true && config.platformReady === true && !renewing && displayState !== 'long_term' && !pending,
    canRenew:config.purchaseEnabled === true && config.platformReady === true && renewing && !pending,
    purchaseLabel:renewing ? (displayState === 'expiring' ? '立即续费' : '提前续费') : ended ? '重新开通会员' : '开通教师会员',
    renewalText:renewing ? '续费后从当前到期日顺延12个月' : '', purchaseDisabledText:'会员购买暂未开放',
    pending, orders:[], orderDetail:null };
}
function orderModel(order, row, config, now) {
  if (order.teacherId !== row.teacherId || order.openId !== row.teacherId || order._stage5 || order.productSnapshot?.testOnly !== false ||
      order.env !== 0 || order.productSnapshot?.duration?.months !== 12 || order.productSnapshot.price !== 39900 || order.currency !== 'CNY' || order.unit !== 'fen' ||
      !Number.isSafeInteger(order.amount) || order.amount <= 0 || order.amount !== order.productSnapshot.price) throw Error('ORDER_UNAVAILABLE');
  const granted = order.paymentStatus === 'paid' && order.grantStatus === 'granted';
  const refunded = order.paymentStatus === 'refunded';
  const closed = ['closed','cancelled','payment_failed'].includes(order.paymentStatus);
  const period = projectLedger(row.teacherId,row.grants,now).periods.find(p => p.grantId === order.grantId);
  const confirmed = granted && !!period;
  return { id:order.orderId, productText:'教师会员 · ' + config.durationText, amountText:(order.amount / 100).toFixed(2) + '元',
    statusText:refunded ? '已退款' : confirmed ? '支付成功' : closed ? '已关闭' : '正在确认',
    pending:!refunded && !confirmed && !closed, paymentTimeText:date(order.fact?.paidAt) || '待确认',
    membershipPeriodText:period ? date(period.startsAt) + ' — ' + date(period.endsAt) : refunded ? '已退款' : '待确认',
    maskedOrderId:order.orderId.length > 10 ? order.orderId.slice(0,6) + '••••' + order.orderId.slice(-4) : '••••' + order.orderId.slice(-4) };
}
module.exports = { membershipModel, orderModel, date };
