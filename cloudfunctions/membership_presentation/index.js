'use strict';
exports.main = async event => {
  try {
    const {ENV_ID} = require('../membership-presentation/config');
    const wxCloud = require('wx-server-sdk');wxCloud.init({env:ENV_ID});
    const db = require('@cloudbase/node-sdk').init({env:ENV_ID}).database();
    const {createPresentationRuntime} = require('../membership-presentation/runtime');
    return {ok:true,result:await createPresentationRuntime({db,wxCloud,environment:process.env})(event)};
  } catch { return {ok:false,message:'会员信息暂时无法获取'}; }
};
