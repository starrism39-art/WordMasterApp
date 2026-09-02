'use strict';

const cloud = require('wx-server-sdk');
const { createAnnouncementService } = require('./service');
const { createCloudRepository } = require('./repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const repository = createCloudRepository(cloud.database());
const service = createAnnouncementService({
  repository,
  getOpenid: () => {
    const context = cloud.getWXContext();
    return context && context.OPENID;
  }
});

exports.main = service.main;
