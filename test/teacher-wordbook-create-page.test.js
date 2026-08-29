'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const uploadService = require('../utils/teacher-wordbook-upload.js');

const pagePath = require.resolve('../subpages/wordbook-create/wordbook-create.js');
const originalPage = global.Page;
const originalWx = global.wx;
const originalSetTimeout = global.setTimeout;
const originalUploadMethods = {
  chooseFile: uploadService.chooseFile,
  prepareAndParse: uploadService.prepareAndParse,
  publish: uploadService.publish
};
let definition = null;

global.Page = (value) => {
  definition = value;
};
delete require.cache[pagePath];
require(pagePath);

const createPage = () => {
  const page = {
    ...definition,
    data: { ...definition.data },
    setData(update) {
      this.data = { ...this.data, ...update };
    }
  };
  return page;
};

(async () => {
  assert.ok(definition, 'wordbook-create page must register itself');

  let callCount = 0;
  global.wx = {
    cloud: {
      callFunction: async () => {
        callCount += 1;
        return { result: { success: true } };
      }
    },
    showToast: () => {},
    navigateBack: () => {}
  };

  const emptyPage = createPage();
  await emptyPage.submitDraft.call(emptyPage);
  assert.strictEqual(callCount, 0);
  assert.strictEqual(emptyPage.data.errorMessage, '请输入词书名称');

  let reservedRequest = null;
  global.wx.cloud.callFunction = async (request) => {
    reservedRequest = request;
    return {
      result: {
        success: false,
        error: 'INVALID_ARGUMENT',
        reason: 'OFFICIAL_NAME_RESERVED'
      }
    };
  };
  const reservedPage = createPage();
  reservedPage.onNameInput.call(reservedPage, {
    detail: { value: '人教版英语八年级上册（新版）' }
  });
  await reservedPage.submitDraft.call(reservedPage);
  assert.deepStrictEqual(reservedRequest, {
    name: 'teacherWordbook',
    data: {
      action: 'createDraft',
      name: '人教版英语八年级上册（新版）',
      category: '',
      description: ''
    }
  });
  assert.strictEqual(
    reservedPage.data.errorMessage,
    '该名称已被官方词书使用，请更换名称'
  );
  assert.strictEqual(reservedPage.data.submitting, false);

  let successToast = null;
  global.wx.cloud.callFunction = async () => ({
    result: {
      success: true,
      book: { wordbookId: 'twb_test', status: 'draft' }
    }
  });
  global.wx.showToast = (options) => {
    successToast = options;
  };
  const successPage = createPage();
  successPage.onNameInput.call(successPage, {
    detail: { value: '高一拓展词汇' }
  });
  successPage.onCategoryInput.call(successPage, {
    detail: { value: '高中' }
  });
  successPage.onDescriptionInput.call(successPage, {
    detail: { value: '高一教学使用' }
  });
  await successPage.submitDraft.call(successPage);
  assert.deepStrictEqual(successToast, {
    title: '草稿创建成功',
    icon: 'success'
  });
  assert.strictEqual(successPage.data.wordbookId, 'twb_test');
  assert.deepStrictEqual(successPage.data.draftBook, {
    wordbookId: 'twb_test',
    status: 'draft'
  });
  assert.strictEqual(successPage.data.uploadStage, 'draft_ready');
  assert.strictEqual(successPage.data.submitting, false);

  const resumePage = createPage();
  resumePage.onLoad.call(resumePage, {
    wordbookId: 'twb_resume',
    title: '%E5%B7%B2%E6%9C%89%E8%8D%89%E7%A8%BF'
  });
  assert.strictEqual(resumePage.data.wordbookId, 'twb_resume');
  assert.strictEqual(resumePage.data.draftBook.title, '已有草稿');

  uploadService.chooseFile = async () => ({
    name: 'words.csv',
    path: 'tmp/words.csv',
    size: 1024,
    extension: 'csv'
  });
  uploadService.prepareAndParse = async ({ onStage }) => {
    onStage('uploading');
    onStage('parsing');
    return {
      uploadId: 'twu_test',
      preview: {
        summary: { totalRows: 3, validRows: 2, invalidRows: 1 },
        validPreview: [
          { word: 'apple', phonetic: '', meaning: '苹果' },
          { word: 'pear', phonetic: '/peə/', meaning: '梨' }
        ],
        errorPreview: [{
          rowNumber: 4,
          reasonCode: 'MISSING_WORD',
          reasonText: '缺少单词'
        }]
      }
    };
  };
  const uploadPage = createPage();
  uploadPage.setData({ wordbookId: 'twb_test' });
  await uploadPage.chooseAndUpload.call(uploadPage);
  assert.strictEqual(uploadPage.data.uploadId, 'twu_test');
  assert.strictEqual(uploadPage.data.uploadStage, 'preview_ready');
  assert.deepStrictEqual(uploadPage.data.summary, {
    totalRows: 3,
    validRows: 2,
    invalidRows: 1
  });
  assert.strictEqual(uploadPage.data.validPreview[0].phonetic, '');
  assert.strictEqual(uploadPage.data.errorPreview[0].reasonCode, 'MISSING_WORD');

  let publishRequest = null;
  uploadService.publish = async (request) => {
    publishRequest = request;
    return {
      success: true,
      version: { versionId: 'twb_test_v1', version: 1, totalWords: 2 }
    };
  };
  global.wx.showModal = ({ success }) => success({ confirm: true });
  await uploadPage.confirmPublish.call(uploadPage);
  assert.strictEqual(publishRequest.wordbookId, 'twb_test');
  assert.strictEqual(publishRequest.uploadId, 'twu_test');
  assert.strictEqual(uploadPage.data.publishedVersion.version, 1);
  assert.strictEqual(uploadPage.data.uploadStage, 'published');

  const pageWxml = fs.readFileSync(
    path.resolve(__dirname, '../subpages/wordbook-create/wordbook-create.wxml'),
    'utf8'
  );
  assert.strictEqual(pageWxml.includes('词书名称'), true);
  assert.strictEqual(pageWxml.includes('分类'), true);
  assert.strictEqual(pageWxml.includes('描述'), true);
  assert.strictEqual(pageWxml.includes('选择文件并解析'), true);
  assert.strictEqual(pageWxml.includes('有效词条预览'), true);
  assert.strictEqual(pageWxml.includes('失败原因'), true);
  assert.strictEqual(pageWxml.includes('bindtap="confirmPublish"'), true);

  console.log('teacher-wordbook-create-page: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  global.Page = originalPage;
  global.wx = originalWx;
  global.setTimeout = originalSetTimeout;
  uploadService.chooseFile = originalUploadMethods.chooseFile;
  uploadService.prepareAndParse = originalUploadMethods.prepareAndParse;
  uploadService.publish = originalUploadMethods.publish;
});
