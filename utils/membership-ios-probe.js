'use strict';
// Capture only the platform's diagnostic fields, never signed payment data.
function createIosProbe(wxApi,diagnostic=null) {
  let failure=null;
  function capture(error) {
    failure={};
    for(const key of ['errCode','errno','errMsg'])if(['string','number'].includes(typeof error?.[key]))failure[key]=error[key];
    if(!Object.keys(failure).length&&typeof error?.message==='string')failure.errMsg=error.message;
  }
  return {
    api:{
      login:options=>wxApi.login(options),
      requestVirtualPayment(options){
        if(!diagnostic){
          try{return wxApi.requestVirtualPayment({...options,fail:error=>{capture(error);options.fail(error);}});}
          catch(error){capture(error);throw error;}
        }
        let terminal=false;
        const finalOptions={...options,
          success:result=>{terminal=true;diagnostic.event('NATIVE_PAYMENT_SUCCESS',diagnostic.result(result));options.success?.(result);},
          fail:error=>{terminal=true;capture(error);diagnostic.event('NATIVE_PAYMENT_FAIL',diagnostic.result(error));diagnostic.errorModal('支付调起失败',error);options.fail?.(error);},
          complete:result=>{diagnostic.event('NATIVE_PAYMENT_COMPLETE',{...diagnostic.result(result),terminalCallbackSeen:terminal});if(!terminal)diagnostic.modal('支付调用已结束','支付调用已结束，但未获得明确成功结果');options.complete?.(result);}
        };
        let canIUse='unavailable';try{if(typeof wxApi.canIUse==='function')canIUse=wxApi.canIUse('requestVirtualPayment');}catch(error){canIUse='threw';diagnostic.event('NATIVE_CAPABILITY_THROW',diagnostic.result(error));}
        diagnostic.event('NATIVE_PAYMENT_CALL_BEGIN',{...diagnostic.payment(finalOptions),requestVirtualPaymentExists:typeof wxApi.requestVirtualPayment==='function',canIUse});
        try{wxApi.showToast({title:'诊断：准备调用 Apple 支付',icon:'none',duration:2000});diagnostic.event('NATIVE_BEGIN_TOAST_SHOWN');}catch(error){diagnostic.event('NATIVE_BEGIN_TOAST_THROW',diagnostic.result(error));}
        try{const returned=wxApi.requestVirtualPayment(finalOptions);
          diagnostic.event('NATIVE_PAYMENT_CALL_RETURN',{type:typeof returned,thenable:typeof returned?.then==='function'});
          if(typeof returned?.then==='function')returned.then(undefined,error=>{diagnostic.event('NATIVE_PAYMENT_REJECT',diagnostic.result(error));diagnostic.errorModal('支付调用 Promise 异常',error);});
          return returned;
        }catch(error){capture(error);diagnostic.event('NATIVE_PAYMENT_THROW',diagnostic.result(error));diagnostic.errorModal('支付调用异常',error);throw error;}
      }
    },
    result:()=>failure
  };
}
function showIosFailure(wxApi,error) {
  const content=Object.entries(error).map(([key,value])=>key+': '+value).join('\n');
  wxApi.showModal({title:'iOS支付调起结果',content:content||'平台未返回错误码或错误信息',showCancel:false});
}
module.exports={createIosProbe,showIosFailure};
