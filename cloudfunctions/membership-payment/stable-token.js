'use strict';
const {check}=require('./protocol');
// Official stable_token normal mode. Never invalidate another service's token.
// Cache is private to this provider; nothing is persisted to business collections.
function createStableTokenProvider({appId,getAppSecret,fetchImpl=globalThis.fetch,clock=Date.now}) {
  let cached=null, pending=null;
  return async function getAccessToken() {
    check(typeof appId==='string' && /^wx[0-9a-f]{16}$/.test(appId),'TOKEN_APPLICATION_REQUIRED');
    const secret=await getAppSecret();
    check(typeof secret==='string' && secret.trim().length>0,'CREDENTIAL_NOT_CONFIGURED');
    if(cached?.secret===secret && clock()<cached.refreshAt) return cached.token;
    // A changed secret must not reuse either cached or in-flight old credentials.
    if(pending?.secret===secret) return pending.promise;
    const current={secret};
    current.promise=(async()=>{
      const startedAt=clock();
      let data;
      try {
        const response=await fetchImpl('https://api.weixin.qq.com/cgi-bin/stable_token',{
          method:'POST',headers:{'content-type':'application/json'},redirect:'error',
          signal:AbortSignal.timeout(10000),
          body:JSON.stringify({grant_type:'client_credential',appid:appId,secret,force_refresh:false})
        });
        if(!response.ok) throw new Error();
        const body=await response.text();
        if(Buffer.byteLength(body)>32768) throw new Error();
        data=JSON.parse(body);
      } catch { throw new Error('STABLE_TOKEN_TRANSPORT_FAILED'); }
      check(data && (data.errcode===undefined || data.errcode===0) && typeof data.access_token==='string' && data.access_token.length>0 && data.access_token.length<=8192 && Number.isSafeInteger(data.expires_in) && data.expires_in>0 && data.expires_in<=7200,'STABLE_TOKEN_REJECTED');
      const expiresAt=startedAt+data.expires_in*1000;
      check(clock()<expiresAt-1000,'STABLE_TOKEN_TOO_SHORT');
      const refreshAt=expiresAt-Math.min(300000,Math.max(1000,data.expires_in*100));
      if(pending===current) cached={secret,token:data.access_token,refreshAt};
      return data.access_token;
    })();
    pending=current;
    try {return await current.promise;} finally {if(pending===current) pending=null;}
  };
}
module.exports={createStableTokenProvider};
