// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk');

// 使用动态当前环境，部署时会自动关联当前小程序环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  };
};