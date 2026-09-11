'use strict';
exports.main=async event=>{
  const {createOpsRuntime,configuration}=require('../membership-ops/runtime');
  const config=configuration(process.env);
  const cloudbase=require('@cloudbase/node-sdk'),wxCloud=require('wx-server-sdk');
  wxCloud.init({env:config.envId});
  return createOpsRuntime({db:cloudbase.init({env:config.envId}).database(),wxCloud,environment:process.env})(event);
};
