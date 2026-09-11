'use strict';
const {award,student,BASE}=require('../membership-stage2/fixtures');
const {initializeAccess}=require('../../cloudfunctions/membership-core/access');
const {DEFAULTS,APP_ID}=require('../../cloudfunctions/membership-presentation/config');
const {membershipModel}=require('../../cloudfunctions/membership-presentation/model');
const NOW=BASE+30*86400000;
function row(state='free') {
  const students=['expired_retained','expired_selection','transition'].includes(state) ? [student('one'),student('two')] : [student('one')];
  students[0].name='林同学';if(students[1])students[1].name='陈同学';
  const grants=state==='long_term' ? [award('long',BASE,{sourceType:'internal_long_term'})] : state==='active' ? [award('annual',BASE)] : state==='expiring' ? [award('short',NOW-2*86400000,{sourceType:'gift',duration:{milliseconds:5*86400000}})] : state.startsWith('expired') ? [award('old',BASE,{sourceType:'gift',duration:{milliseconds:5*86400000}})] : [];
  const access=initializeAccess({teacherId:'teacher',students,grants,registeredAt:BASE,launchAt:BASE,now:NOW});
  if(state==='transition'){access.transitionStartsAt=NOW-86400000;access.transitionEndsAt=NOW+4*86400000;access.transitionStudentIds=students.map(s=>s.studentId);}
  if(state==='expired_retained')access.retainedStudentId='one';
  return {teacherId:'teacher',revision:1,initialization:{state:'ready'},grants,access,students,studentRefs:Object.fromEntries(students.map(s=>[s.studentId,s.studentId])),operations:{},audits:[]};
}
function order(overrides={}) {return {orderId:'WM20260911_1234567890',teacherId:'teacher',openId:'teacher',appId:APP_ID,env:0,amount:39900,currency:'CNY',unit:'fen',createdAt:NOW,fact:{paidAt:NOW},paymentStatus:'paid',grantStatus:'granted',grantId:'annual',productSnapshot:{productId:'annual_server',testOnly:false,duration:{months:12},price:39900},...overrides};}
function models() {return Object.fromEntries(['free','active','expiring','transition','expired_single','expired_selection','expired_retained','long_term'].map(s=>[s,membershipModel(row(s),NOW,DEFAULTS)]));}
class ReadDb {
  constructor(value=row(),orders=[]){this.writes=0;this.rows=new Map([['membership_ledgers/teacher',value],...value.students.map(s=>['students/'+s.studentId,{teacher_id:'teacher',student_id:s.studentId,name:s.name,grade:s.grade}]),...orders.map(o=>['membership_orders/'+o.orderId,o])]);}
  collection(name){const db=this;return {doc(key){return {async get(){return {data:db.rows.has(name+'/'+key)?[structuredClone(db.rows.get(name+'/'+key))]:[]};},set(){db.writes++;throw Error('WRITE_FORBIDDEN');}};},where(filter){let offset=0,limit=100;const query={orderBy(){return query;},skip(n){offset=n;return query;},limit(n){limit=n;return query;},async get(){return {data:[...db.rows.entries()].filter(([k,v])=>k.startsWith(name+'/')&&Object.entries(filter).every(([f,x])=>v[f]===x)).map(([,v])=>structuredClone(v)).sort((a,b)=>b.createdAt-a.createdAt).slice(offset,offset+limit)};}};return query;}};}
}
module.exports={row,order,models,NOW,ReadDb};
