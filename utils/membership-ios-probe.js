'use strict';
// Capture only the platform's diagnostic fields, never signed payment data.
function createIosProbe(wxApi) {
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
        try{return wxApi.requestVirtualPayment({...options,fail:error=>{capture(error);options.fail(error);}});}
        catch(error){capture(error);throw error;}
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
