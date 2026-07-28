'use strict';

const assert = require('assert');

const student = { id: 'student456' };
const wordbook = { id: 'book_a', title: '测试词书' };
const storage = {
  wordMastery: {
    student456: {
      book_a: {}
    }
  }
};

global.wx = {
  getStorageSync: (key) => storage[key]
};
global.getApp = () => ({
  globalData: {
    currentStudent: student,
    currentWordbook: wordbook
  }
});

let pageDefinition = null;
global.Page = (definition) => {
  pageDefinition = definition;
};

require('../pages/index/index.js');
assert.ok(pageDefinition, '首页应注册 Page');

const page = Object.assign({}, pageDefinition, {
  data: {},
  setData(update) {
    this.data = { ...this.data, ...update };
  }
});

const now = Date.now();
const records = storage.wordMastery.student456.book_a;

records.book_a_known = {
  mastered: true,
  antiForgettingSource: 'preview_mastered',
  reviewCount: 0,
  nextReviewTime: now - 1000
};
records.book_a_other = {
  difficult: true,
  antiForgettingSource: 'non_preview_difficult',
  reviewCount: 0,
  nextReviewTime: now - 1000
};
page.calculateAntiForgotTime();
assert.ok(page.data.antiForgotTime.includes('无抗遗忘'), '非预习不会来源不能点亮首页抗遗忘提示');

records.book_a_preview_future = {
  difficult: true,
  antiForgettingSource: 'preview_not_mastered',
  reviewCount: 1,
  nextReviewTime: now + 2 * 24 * 60 * 60 * 1000
};
page.calculateAntiForgotTime();
assert.ok(page.data.antiForgotTime.includes('下次复习时间'), '未到期的预习不会词只应显示下次时间');

delete records.book_a_preview_future;
records.book_a_preview_unknown = {
  mastered: true,
  antiForgettingSource: 'preview_not_mastered',
  reviewCount: 2,
  nextReviewTime: now - 1000
};
page.calculateAntiForgotTime();
assert.ok(page.data.antiForgotTime.includes('有抗遗忘'), '预习不会来源到期后应点亮首页提示');

delete records.book_a_preview_unknown;
records.book_a_legacy = {
  difficult: true,
  reviewCount: 1,
  nextReviewTime: now - 1000
};
page.calculateAntiForgotTime();
assert.ok(page.data.antiForgotTime.includes('有抗遗忘'), '旧困难记录应继续兼容，不能升级后消失');

process.stdout.write('home-anti-forgetting-source: PASS\n');
