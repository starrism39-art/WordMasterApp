'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const uploadService = require('../utils/teacher-wordbook-upload.js');

const originalPage = global.Page;
const originalWx = global.wx;
const originalGetApp = global.getApp;
const originalUploadMethods = {
  chooseFile: uploadService.chooseFile,
  prepareAndParse: uploadService.prepareAndParse,
  publish: uploadService.publish,
  updateVersion: uploadService.updateVersion
};

const createPage = (definition) => ({
  ...definition,
  data: { ...definition.data },
  setData(update) {
    this.data = { ...this.data, ...update };
  }
});

const loadPage = (relativePath) => {
  let definition = null;
  global.Page = (value) => {
    definition = value;
  };
  const modulePath = require.resolve(relativePath);
  delete require.cache[modulePath];
  require(modulePath);
  assert.ok(definition, `${relativePath} must register a page`);
  return definition;
};

(async () => {
  const navigations = [];
  const toasts = [];
  let cloudCallCount = 0;
  global.getApp = () => ({
    globalData: {
      currentUser: { id: 'teacher-a' },
      currentStudent: null
    }
  });
  global.wx = {
    cloud: {
      callFunction: async () => {
        cloudCallCount += 1;
        return { result: { success: true } };
      }
    },
    getStorageSync: () => ({}),
    setStorageSync: () => {},
    navigateTo: (request) => navigations.push(request),
    showToast: (request) => toasts.push(request),
    showModal: ({ success }) => success({ confirm: true })
  };

  const wordbookDefinition = loadPage('../subpages/wordbook/wordbook.js');
  const wordbookPage = createPage(wordbookDefinition);
  wordbookPage.setData({
    teacherWordbooks: [
      {
        id: 'twb_active',
        wordbookId: 'twb_active',
        title: 'Active 教师词书',
        sourceType: 'teacher_custom',
        status: 'active',
        version: 1,
        totalWords: 100
      },
      {
        id: 'twb_draft',
        wordbookId: 'twb_draft',
        title: 'Draft 教师词书',
        sourceType: 'teacher_custom',
        status: 'draft',
        version: 0,
        totalWords: 0
      },
      {
        id: 'official_injected',
        wordbookId: 'official_injected',
        title: '官方词书',
        sourceType: 'official',
        status: 'active',
        version: 1,
        totalWords: 100
      }
    ]
  });

  let learningStarts = 0;
  wordbookPage.startLearning = () => {
    learningStarts += 1;
  };
  wordbookPage.goToUpdateTeacherWordbook.call(wordbookPage, {
    currentTarget: { dataset: { id: 'twb_active' } }
  });
  assert.strictEqual(navigations.length, 1, 'active teacher book must open update page');
  assert.strictEqual(learningStarts, 0, 'update action must not call startLearning');
  assert.ok(navigations[0].url.includes('mode=update'));
  assert.ok(navigations[0].url.includes('wordbookId=twb_active'));
  assert.ok(navigations[0].url.includes('version=1'));
  assert.ok(navigations[0].url.includes('totalWords=100'));
  assert.strictEqual(/teacherId|teacher_id/.test(navigations[0].url), false);

  wordbookPage.goToUpdateTeacherWordbook.call(wordbookPage, {
    currentTarget: { dataset: { id: 'twb_draft' } }
  });
  wordbookPage.goToUpdateTeacherWordbook.call(wordbookPage, {
    currentTarget: { dataset: { id: 'official_injected' } }
  });
  assert.strictEqual(navigations.length, 1, 'draft and official books must not open update page');

  const catalogWxml = fs.readFileSync(
    path.resolve(__dirname, '../subpages/wordbook/wordbook.wxml'),
    'utf8'
  );
  const updateCondition = "wx:if=\"{{!selectMode && item.sourceType === 'teacher_custom' && item.status === 'active'}}\"";
  assert.ok(catalogWxml.includes(updateCondition), 'update button must be active teacher_custom only');
  assert.ok(catalogWxml.includes('catchtap="goToUpdateTeacherWordbook"'), 'update button must stop bubbling');
  assert.strictEqual(
    catalogWxml.slice(0, catalogWxml.indexOf('teacher-section')).includes('goToUpdateTeacherWordbook'),
    false,
    'official section must not render update action'
  );

  const createDefinition = loadPage('../subpages/wordbook-create/wordbook-create.js');
  const updatePage = createPage(createDefinition);
  updatePage.onLoad.call(updatePage, {
    mode: 'update',
    wordbookId: 'twb_active',
    title: encodeURIComponent('Active 教师词书'),
    version: '1',
    totalWords: '100'
  });
  assert.strictEqual(updatePage.data.mode, 'update');
  assert.strictEqual(updatePage.data.draftBook.title, 'Active 教师词书');
  assert.strictEqual(updatePage.data.currentVersion, 1);
  assert.strictEqual(updatePage.data.currentTotalWords, 100);

  await updatePage.submitDraft.call(updatePage);
  assert.strictEqual(cloudCallCount, 0, 'update mode must not call createDraft');

  uploadService.chooseFile = async () => ({
    name: 'v2.csv',
    path: 'tmp/v2.csv',
    size: 1024,
    extension: 'csv'
  });
  uploadService.prepareAndParse = async () => ({
    uploadId: 'twu_update',
    publishToken: 'twp_update',
    preview: {
      summary: { totalRows: 2, validRows: 2, invalidRows: 0 },
      validPreview: [
        { word: 'apple', phonetic: '', meaning: '苹果' },
        { word: 'pear', phonetic: '/peə/', meaning: '梨' }
      ],
      errorPreview: []
    }
  });
  await updatePage.chooseAndUpload.call(updatePage);
  assert.strictEqual(updatePage.data.uploadId, 'twu_update');
  assert.strictEqual(updatePage.data.publishToken, 'twp_update');
  assert.strictEqual(updatePage.data.uploadStage, 'preview_ready');

  let updateRequest = null;
  let publishCalls = 0;
  uploadService.publish = async () => {
    publishCalls += 1;
    return { success: true };
  };
  uploadService.updateVersion = async (request) => {
    updateRequest = request;
    return {
      success: true,
      version: { versionId: 'twb_active_v2', version: 2, totalWords: 2 }
    };
  };
  await updatePage.confirmPublish.call(updatePage);
  assert.strictEqual(publishCalls, 0, 'update mode must not call initial publish');
  assert.strictEqual(updateRequest.wordbookId, 'twb_active');
  assert.strictEqual(updateRequest.uploadId, 'twu_update');
  assert.strictEqual(updateRequest.publishToken, 'twp_update');
  assert.strictEqual(/teacherId|teacher_id/.test(JSON.stringify(updateRequest)), false);
  assert.strictEqual(updatePage.data.publishedVersion.version, 2);
  assert.strictEqual(updatePage.data.currentVersion, 2);
  assert.strictEqual(updatePage.data.uploadStatusText, '词书已更新至v2');
  assert.ok(toasts.some((item) => item.title === '词书更新成功'));

  const createPageInstance = createPage(createDefinition);
  createPageInstance.setData({
    wordbookId: 'twb_create',
    uploadId: 'twu_create',
    summary: { totalRows: 1, validRows: 1, invalidRows: 0 }
  });
  let createPublishRequest = null;
  uploadService.publish = async (request) => {
    createPublishRequest = request;
    return {
      success: true,
      version: { versionId: 'twb_create_v1', version: 1, totalWords: 1 }
    };
  };
  uploadService.updateVersion = async () => {
    throw new Error('create mode must not call updateVersion');
  };
  await createPageInstance.confirmPublish.call(createPageInstance);
  assert.strictEqual(createPublishRequest.wordbookId, 'twb_create');
  assert.strictEqual(createPublishRequest.uploadId, 'twu_create');
  assert.strictEqual(createPageInstance.data.publishedVersion.version, 1);

  const conflictPage = createPage(createDefinition);
  conflictPage.onLoad.call(conflictPage, {
    mode: 'update', wordbookId: 'twb_active', title: 'Active', version: '1', totalWords: '100'
  });
  conflictPage.setData({
    uploadId: 'twu_conflict',
    publishToken: 'twp_conflict',
    summary: { totalRows: 1, validRows: 1, invalidRows: 0 }
  });
  uploadService.updateVersion = async () => {
    const error = new Error('conflict');
    error.result = { success: false, error: 'VERSION_CONFLICT' };
    throw error;
  };
  await conflictPage.confirmPublish.call(conflictPage);
  assert.strictEqual(conflictPage.data.errorMessage, '版本已更新，请刷新后重试。');

  const actionCalls = [];
  await originalUploadMethods.updateVersion({
    wxApi: {
      cloud: {
        callFunction: async (request) => {
          actionCalls.push(request);
          return {
            result: {
              success: true,
              version: { versionId: 'twb_active_v2', version: 2, totalWords: 2 }
            }
          };
        }
      }
    },
    wordbookId: 'twb_active',
    uploadId: 'twu_update',
    publishToken: 'twp_update'
  });
  assert.deepStrictEqual(actionCalls[0], {
    name: 'teacherWordbook',
    data: {
      action: 'updateVersion',
      wordbookId: 'twb_active',
      uploadId: 'twu_update',
      publishToken: 'twp_update'
    }
  });

  const preparedOutcome = await originalUploadMethods.prepareAndParse({
    wxApi: {
      cloud: {
        callFunction: async (request) => {
          if (request.data.action === 'prepareUpload') {
            return {
              result: {
                success: true,
                upload: {
                  uploadId: 'twu_token',
                  publishToken: 'twp_token'
                },
                transport: {
                  method: 'PUT',
                  url: 'https://bucket.cos.ap-shanghai.myqcloud.com/source.csv?signed=1',
                  headers: { 'x-cos-forbid-overwrite': 'true' },
                  expiresAt: Date.now() + 300000
                }
              }
            };
          }
          if (request.data.action === 'parseUpload') {
            return { result: { success: true, upload: { status: 'preview_ready' } } };
          }
          if (request.data.action === 'getPreview') {
            return {
              result: {
                success: true,
                summary: { totalRows: 1, validRows: 1, invalidRows: 0 },
                validPreview: [{ word: 'cat', phonetic: '', meaning: '猫' }],
                errorPreview: []
              }
            };
          }
          throw new Error(`unexpected action: ${request.data.action}`);
        }
      },
      getFileSystemManager: () => ({
        readFile: ({ success }) => success({ data: new ArrayBuffer(1024) })
      }),
      request: ({ success }) => success({ statusCode: 200 })
    },
    wordbookId: 'twb_active',
    file: { name: 'v2.csv', path: 'tmp/v2.csv', size: 1024 }
  });
  assert.strictEqual(preparedOutcome.uploadId, 'twu_token');
  assert.strictEqual(preparedOutcome.publishToken, 'twp_token');

  console.log('teacher-wordbook-stage6-update-page: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  global.Page = originalPage;
  global.wx = originalWx;
  global.getApp = originalGetApp;
  uploadService.chooseFile = originalUploadMethods.chooseFile;
  uploadService.prepareAndParse = originalUploadMethods.prepareAndParse;
  uploadService.publish = originalUploadMethods.publish;
  uploadService.updateVersion = originalUploadMethods.updateVersion;
});
