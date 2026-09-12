'use strict';
exports.main=async event=>{
  const {ENV_ID}=require('../membership-presentation/config');
  const wxCloud=require('wx-server-sdk');wxCloud.init({env:ENV_ID});
  const db=require('@cloudbase/node-sdk').init({env:ENV_ID}).database();
  return require('../membership-formal/runtime').createFormalRuntime({db,wxCloud,environment:process.env}).compensate(event);
};
