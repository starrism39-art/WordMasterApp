'use strict';
const {strictKeys}=require('../membership-core/model');
const {check}=require('../membership-payment/protocol');
const {hash,hmac,equal}=require('../membership-payment/crypto');
const TRIGGER_NAME='stage5_compensation_5m';
const INTERVAL_MS=300000;

// Treat this purpose-limited capability as a secret. Store it only in the
// protected timer CustomArgument; it cannot sign general internal API requests.
function timerCapability(key,scopeId) {
  check(typeof key==='string' && Buffer.byteLength(key)>=32,'STAGE5_SECRET_NOT_CONFIGURED');
  return hmac(key,`stage5-timer-v1\n${scopeId}\n${TRIGGER_NAME}`);
}
// Runtime source metadata is a guard, not sufficient authentication: native
// management invocations can share it. The scheduler capability is mandatory.
function timerRequest({event,context,policy,environment,clock=Date.now}) {
  check(environment.STAGE5_SCHEDULE_ENABLED==='true','STAGE5_SCHEDULE_DISABLED');
  const userContext=!!(context?.OPENID || context?.FROM_OPENID);
  const wxTimer=context?.SOURCE==='wx_trigger' && context.ENV===policy.config.cloudEnvId;
  // Native SCF timers do not carry WX_CONTEXT_KEYS, so wx-server-sdk returns {}.
  // TRIGGER_SRC is SCF's documented built-in runtime variable, never event input.
  // Do not configure these provider-owned fields in function environment settings.
  const nativeTimer=!context?.SOURCE && (!environment.TCB_SOURCE || environment.TCB_SOURCE==='wx_trigger') &&
    environment.TRIGGER_SRC==='timer' && environment.TENCENTCLOUD_RUNENV==='SCF' &&
    environment.SCF_FUNCTIONNAME==='stage5_compensate' && environment.SCF_NAMESPACE===policy.config.cloudEnvId;
  const trusted=!userContext && (wxTimer || nativeTimer);
  if(!trusted) {
    // Fixed, redacted operational evidence; never log caller IDs or raw events.
    const known=['wx_trigger','wx_client','wx_devtools','wx_http','scf'];
    console.info('STAGE5_TIMER_AUTH_DIAGNOSTIC',JSON.stringify({
      source:known.includes(context?.SOURCE)?context.SOURCE:(context?.SOURCE?'other':'absent'),
      environmentPresent:!!context?.ENV,environmentMatches:context?.ENV===policy.config.cloudEnvId,
      userContextPresent:userContext,
      nativeTimerSource:environment.TRIGGER_SRC==='timer',
      nativeFunctionMatches:environment.SCF_FUNCTIONNAME==='stage5_compensate',
      nativeEnvironmentMatches:environment.SCF_NAMESPACE===policy.config.cloudEnvId
    }));
  }
  check(trusted,'STAGE5_TIMER_AUTH_REQUIRED');
  policy.real();
  check(event && typeof event==='object' && !Array.isArray(event),'INVALID_TIMER_EVENT');
  const {userInfo,tcbContext,...input}=event;
  strictKeys(input,['Type','TriggerName','Time','Message']);
  check(input.Type==='Timer' && input.TriggerName===TRIGGER_NAME,'INVALID_TIMER_EVENT');
  const key=environment.STAGE5_INTERNAL_KEY;
  const capability=timerCapability(key,policy.scopeId);
  check(typeof input.Message==='string' && /^[a-f0-9]{64}$/.test(input.Message) && equal(capability,input.Message),'STAGE5_TIMER_CREDENTIAL_REQUIRED');
  // Official Time is documented as trigger creation time, not a fresh signature.
  // Use server clock; one accepted invocation per scope per five-minute slot.
  const now=clock();check(Number.isSafeInteger(now) && now>=0,'INVALID_TIMER_CLOCK');
  const timestamp=Math.floor(now/INTERVAL_MS)*INTERVAL_MS;
  const nonce=hash({scope:policy.scopeId,trigger:TRIGGER_NAME,timestamp});
  const body=JSON.stringify({limit:20});
  const signature=hmac(hmac(key,policy.scopeId),`${timestamp}\n${nonce}\n${body}`);
  return {timestamp,nonce,body,signature};
}
module.exports={timerRequest,timerCapability,TRIGGER_NAME,INTERVAL_MS};
