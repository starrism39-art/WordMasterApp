'use strict';
// This module belongs ONLY to the diagnostic worktree. Never enable in release.
const STORAGE_KEY='wm_p0_ios_native_diagnostic_v1';
const MAX_EVENTS=80;
let serial=0,last=null;
function enabled(wxApi) {
  try {
    const env=wxApi.getAccountInfoSync().miniProgram.envVersion;
    const info=typeof wxApi.getDeviceInfo==='function'?wxApi.getDeviceInfo():wxApi.getSystemInfoSync();
    return ['develop','trial'].includes(env)&&info.platform==='ios';
  } catch {return false;}
}
function start(wxApi,context={}) {
  if(!enabled(wxApi))return null;
  const traceId='p0-'+Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const events=[],secrets=new Set();let queue=Promise.resolve();
  function text(value) {
    let s=String(value===undefined?'':value);
    for(const secret of secrets)if(secret)s=s.split(secret).join('[REDACTED]');
    return s.replace(/((?:paySig|signature|loginCode|session_key|access_token|appKey|secret|openid)["\s:=]+)[^,\s"&}]+/gi,'$1[REDACTED]').replace(/\b[a-f0-9]{64}\b/gi,'[REDACTED_SIGNATURE]').slice(0,4000);
  }
  function safe(value,depth=0) {
    if(depth>6)return '[DEPTH_LIMIT]';
    if(typeof value==='string')return text(value);
    if(value===null||['number','boolean'].includes(typeof value))return value;
    if(Array.isArray(value))return value.slice(0,40).map(v=>safe(v,depth+1));
    if(value&&typeof value==='object'){const out={};for(const [key,v] of Object.entries(value)){if(/^(paySig|signature|signData|loginCode|session_key|access_token|appKey|secret|openid|accountId)$/i.test(key))out[key]='[REDACTED]';else out[key]=safe(v,depth+1);}return out;}
    return typeof value;
  }
  function event(name,data={}) {
    try {const entry={traceId,sequence:events.length?events[events.length-1].sequence+1:1,time:new Date().toISOString(),event:name,data:safe(data)};events.push(entry);if(events.length>MAX_EVENTS)events.shift();
      const snapshot={format:1,traceId,events:events.slice()};
      try{wxApi.setStorageSync(STORAGE_KEY,snapshot);}catch(error){try{console.warn('[P0_DIAGNOSTIC_STORAGE_UNAVAILABLE]',traceId,text(error.message));}catch{}}
      try{console.info('[P0_IOS_PAYMENT]',entry);}catch{}
    } catch {}
  }
  function result(value) {
    const out={returnedFields:Object.keys(value||{})};
    for(const key of ['errCode','errno','errMsg','message','status','type'])if(['string','number','boolean'].includes(typeof value?.[key]))out[key]=safe(value[key]);
    return out;
  }
  function payment(value={}) {
    for(const key of ['signData','paySig','signature'])if(typeof value[key]==='string')secrets.add(value[key]);
    const fields=[];for(const key of Object.keys(value)){const v=value[key];fields.push({name:key,type:typeof v,present:v!==null&&v!==undefined,empty:v===null||v===undefined||v==='',...(typeof v==='string'?{length:v.length}:{})});}
    const required=['mode','signData','paySig','signature'];
    let signed;
    try{const d=JSON.parse(value.signData);signed={fields:Object.keys(d),types:Object.fromEntries(Object.entries(d).map(([k,v])=>[k,typeof v])),outTradeNo:typeof d.outTradeNo==='string'?d.outTradeNo:'',productId:typeof d.productId==='string'?d.productId:'',env:d.env,goodsPrice:d.goodsPrice,attachLength:typeof d.attach==='string'?d.attach.length:null};}catch{signed={parseable:false};}
    return {fieldNames:Object.keys(value),fields,requiredEmpty:required.map(k=>({name:k,empty:value[k]===undefined||value[k]===null||value[k]===''})),signedSummary:signed};
  }
  function modal(title,content) {
    queue=queue.then(()=>new Promise(resolve=>{
      event('DEBUG_MODAL_BEGIN',{title});
      const end=outcome=>{event('DEBUG_MODAL_END',{title,outcome});resolve();};
      try{wxApi.showModal({title,content:text(content)+'\ntraceId: '+traceId,showCancel:false,success:()=>end('acknowledged'),fail:e=>{event('DEBUG_MODAL_FAIL',result(e));end('failed');}});}catch(e){event('DEBUG_MODAL_THROW',result(e));end('thrown');}
    })).catch(()=>{});
    return queue;
  }
  function errorModal(title,error) {const r=result(error);return modal(title,'errCode: '+(r.errCode??r.errno??'未返回')+'\nerrMsg: '+(r.errMsg||r.message||'未返回'));}
  const trace={traceId,event,result,payment,modal,errorModal,flush:()=>queue};last=trace;
  event('PAYMENT_CLICK',context);
  try{const base=typeof wxApi.getAppBaseInfo==='function'?wxApi.getAppBaseInfo():wxApi.getSystemInfoSync();const device=typeof wxApi.getDeviceInfo==='function'?wxApi.getDeviceInfo():base;
    event('PAYMENT_ENVIRONMENT',{envVersion:wxApi.getAccountInfoSync().miniProgram.envVersion,platform:device.platform,system:device.system,SDKVersion:base.SDKVersion,wechatVersion:base.version});}catch{}
  return trace;
}
function current(wxApi){return enabled(wxApi)?last:null;}
function copy(wxApi) {
  if(!enabled(wxApi))return;
  try{const log=wxApi.getStorageSync(STORAGE_KEY);if(!log?.traceId){wxApi.showToast({title:'暂无支付诊断记录',icon:'none'});return;}
    wxApi.setClipboardData({data:JSON.stringify(log,null,2),success:()=>wxApi.showToast({title:'诊断记录已复制',icon:'none'})});
  }catch{try{wxApi.showToast({title:'诊断记录读取失败',icon:'none'});}catch{}}
}
module.exports={enabled,start,current,copy,STORAGE_KEY,MAX_EVENTS};
