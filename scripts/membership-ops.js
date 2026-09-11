'use strict';
// Input/output files only. Never print the signing key or signed envelope.
// This tool prepares an authenticated invocation; the installed CloudBase manager
// sends it via invokeFunction, so no public HTTP gateway is required.
const fs=require('node:fs'),crypto=require('node:crypto');
const {canonical,strictKeys,id}=require('../cloudfunctions/membership-core/model');
const {hmac}=require('../cloudfunctions/membership-payment/crypto');
const {APP_ID,ENV_ID}=require('../cloudfunctions/membership-ops/runtime');
function prepare(input,key,clock=Date.now){
  strictKeys(input,['operator','action','request']);id(input.operator);
  if(typeof key!=='string'||Buffer.byteLength(key)<32)throw Error('OPS_INTERNAL_KEY_REQUIRED');
  if(!['getTeacher','getOrder','listReview','listHistoricalReviews','listAudit','previewGrant','applyGrant','queryOfficial','recordEvidence','reviewDecision','confirmPaidAndGrant','processRefund'].includes(input.action))throw Error('ACTION_NOT_ALLOWED');
  const body=JSON.stringify(input),timestamp=clock(),nonce=crypto.randomBytes(24).toString('hex');
  return {action:'invokeFunction',functionName:'membership_ops',params:{body,timestamp,nonce,signature:hmac(key,canonical({scope:{appId:APP_ID,envId:ENV_ID,function:'membership_ops'},body,timestamp,nonce}))}};
}
if(require.main===module){
  const [inputPath,outputPath]=process.argv.slice(2);if(!inputPath||!outputPath||fs.existsSync(outputPath))throw Error('INPUT_AND_NEW_OUTPUT_REQUIRED');
  const input=JSON.parse(fs.readFileSync(inputPath,'utf8'));
  const payload=prepare(input,process.env.MEMBERSHIP_OPS_INTERNAL_KEY);
  fs.writeFileSync(outputPath,JSON.stringify(payload,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({prepared:true,action:input.action,envId:ENV_ID,expiresInSeconds:300}));
}
module.exports={prepare};
