'use strict';
exports.main=async event=>{
  try {
  const {createBusinessRuntime,readConfig}=require('../membership-business/runtime');
  const config=readConfig(process.env);
  const wxCloud=require('wx-server-sdk');wxCloud.init({env:config.envId});
  const cloudbase=require('@cloudbase/node-sdk');const db=cloudbase.init({env:config.envId}).database();
  return {ok:true,result:await createBusinessRuntime({db,wxCloud,environment:process.env})(event)};
  }
  catch(error){return {ok:false,code:/^[A-Z_]{3,80}$/.test(error.message)?error.message:'BUSINESS_REQUEST_FAILED'};}
};
