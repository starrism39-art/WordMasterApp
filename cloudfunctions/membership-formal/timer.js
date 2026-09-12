'use strict';
const {strictKeys}=require('../membership-core/model');
const {check}=require('../membership-payment/protocol');
const {hash,hmac,equal}=require('../membership-payment/crypto');
const TRIGGER_NAME='formal_android_compensation_5m';
const capability=key=>hmac(key,`formal-android-timer-v1\n${TRIGGER_NAME}`);
function timerRequest({event,context,environment,config,clock}){
  check(environment.MEMBERSHIP_FORMAL_SCHEDULE_ENABLED==='true','FORMAL_SCHEDULE_DISABLED');
  const wxTimer=context?.SOURCE==='wx_trigger'&&context.ENV===config.cloudEnvId;
  const nativeTimer=!context?.SOURCE&&(!environment.TCB_SOURCE||environment.TCB_SOURCE==='wx_trigger')&&environment.TRIGGER_SRC==='timer'&&environment.TENCENTCLOUD_RUNENV==='SCF'&&environment.SCF_FUNCTIONNAME==='membership_formal_compensate'&&environment.SCF_NAMESPACE===config.cloudEnvId;
  check(!context?.OPENID&&!context?.FROM_OPENID&&(wxTimer||nativeTimer),'FORMAL_TIMER_AUTH_REQUIRED');
  strictKeys(event,['Type','TriggerName','Time','Message']);
  check(event.Type==='Timer'&&event.TriggerName===TRIGGER_NAME&&typeof event.Message==='string'&&equal(capability(environment.MEMBERSHIP_INTERNAL_KEY),event.Message),'FORMAL_TIMER_AUTH_REQUIRED');
  const timestamp=Math.floor(clock()/300000)*300000,nonce=hash({trigger:TRIGGER_NAME,timestamp}),body=JSON.stringify({limit:20});
  return {timestamp,nonce,body,signature:hmac(environment.MEMBERSHIP_INTERNAL_KEY,`${timestamp}\n${nonce}\n${body}`)};
}
module.exports={TRIGGER_NAME,capability,timerRequest};
