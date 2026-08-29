'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const WordbookRepository = require('../utils/wordbook-repository.js');

const originalPage = global.Page;
const originalWx = global.wx;
const originalGetApp = global.getApp;
const originalDisable = WordbookRepository.disableTeacherWordbook;
let definition = null;
let modalResult = { confirm: false };
let disableCalls = [];
let toasts = [];

global.Page = (value) => { definition = value; };
global.getApp = () => ({ globalData: {} });
global.wx = {
  showModal: (options) => {
    assert.strictEqual(options.title, '确认停用词书？');
    assert.strictEqual(
      options.content,
      '停用后学生不可继续从当前词书目录选择，但历史版本和学习数据不会删除。'
    );
    options.success(modalResult);
  },
  showToast: (options) => { toasts.push(options); }
};
WordbookRepository.disableTeacherWordbook = async (wordbookId) => {
  disableCalls.push(wordbookId);
  return {
    success: true,
    book: { wordbookId, sourceType: 'teacher_custom', status: 'disabled' }
  };
};

const pagePath = require.resolve('../subpages/wordbook/wordbook.js');
delete require.cache[pagePath];
require(pagePath);

const activeBook = {
  id: 'twb_disable_page',
  wordbookId: 'twb_disable_page',
  title: '停用页面验收',
  sourceType: 'teacher_custom',
  status: 'active',
  version: 1,
  totalWords: 25
};

const createPage = () => {
  let reloadCount = 0;
  const page = {
    ...definition,
    data: {
      ...definition.data,
      teacherWordbooks: [{ ...activeBook }]
    },
    setData(update) {
      this.data = { ...this.data, ...update };
    },
    async loadWordbooks() {
      reloadCount += 1;
    },
    getReloadCount() {
      return reloadCount;
    }
  };
  return page;
};

(async () => {
  assert.ok(definition, 'wordbook page must register itself');
  const event = { currentTarget: { dataset: { id: activeBook.id } } };

  const cancelledPage = createPage();
  modalResult = { confirm: false };
  cancelledPage.disableTeacherWordbook.call(cancelledPage, event);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepStrictEqual(disableCalls, []);
  assert.strictEqual(cancelledPage.getReloadCount(), 0);

  const confirmedPage = createPage();
  modalResult = { confirm: true };
  confirmedPage.disableTeacherWordbook.call(confirmedPage, event);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepStrictEqual(disableCalls, [activeBook.id]);
  assert.strictEqual(confirmedPage.getReloadCount(), 1);
  assert.strictEqual(confirmedPage.data.disablingWordbookId, '');
  assert.strictEqual(
    confirmedPage.data.teacherWordbooks[0].status,
    'active',
    '成功后必须通过真实目录刷新，而不是手工伪造 disabled setData'
  );
  assert.strictEqual(toasts.some((toast) => toast.title === '词书已停用'), true);

  const disabledPage = createPage();
  disabledPage.data.teacherWordbooks[0].status = 'disabled';
  disabledPage.disableTeacherWordbook.call(disabledPage, event);
  assert.deepStrictEqual(disableCalls, [activeBook.id]);
  assert.strictEqual(toasts.some((toast) => toast.title === '当前词书不可停用'), true);

  const source = fs.readFileSync(
    path.resolve(__dirname, '../subpages/wordbook/wordbook.js'),
    'utf8'
  );
  const wxml = fs.readFileSync(
    path.resolve(__dirname, '../subpages/wordbook/wordbook.wxml'),
    'utf8'
  );
  assert.strictEqual(source.includes("teacherScope: this.data.selectMode ? 'active' : 'manage'"), true);
  assert.strictEqual(source.includes("selectedWordbook.status === 'disabled' ? '该词书已停用'"), true);
  assert.strictEqual(wxml.includes('catchtap="disableTeacherWordbook"'), true);
  assert.strictEqual(wxml.includes('item.status === \'disabled\' ? \'已停用\''), true);
  assert.strictEqual(
    /wx:if="\{\{!selectMode && item\.sourceType === 'teacher_custom' && item\.status === 'active'\}\}"[\s\S]*catchtap="disableTeacherWordbook"/.test(wxml),
    true
  );

  console.log('teacher-wordbook-disable-page: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  WordbookRepository.disableTeacherWordbook = originalDisable;
  global.Page = originalPage;
  global.wx = originalWx;
  global.getApp = originalGetApp;
});
