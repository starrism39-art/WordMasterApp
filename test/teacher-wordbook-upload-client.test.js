'use strict';

const assert = require('assert');
const service = require('../utils/teacher-wordbook-upload.js');

(async () => {
  assert.deepStrictEqual(service.SUPPORTED_EXTENSIONS, ['csv', 'xlsx']);
  assert.strictEqual(service.MAX_FILE_BYTES, 5 * 1024 * 1024);
  assert.throws(() => service.validateFile({
    name: 'words.pdf', path: 'tmp/words.pdf', size: 100
  }), (error) => error.reason === 'UNSUPPORTED_FILE_TYPE');
  assert.throws(() => service.validateFile({
    name: 'words.csv', path: 'tmp/words.csv', size: 0
  }), (error) => error.reason === 'INVALID_FILE_SIZE');

  const calls = [];
  const stages = [];
  const wxApi = {
    cloud: {
      callFunction: async (request) => {
        calls.push(request);
        const action = request.data.action;
        if (action === 'prepareUpload') {
          return {
            result: {
              success: true,
              upload: {
                uploadId: 'twu_client'
              },
              transport: {
                method: 'PUT',
                url: 'https://bucket.cos.ap-shanghai.myqcloud.com/signed-source.csv',
                headers: { 'x-cos-forbid-overwrite': 'true' },
                expiresAt: Date.now() + 300000
              }
            }
          };
        }
        if (action === 'parseUpload') {
          return {
            result: {
              success: true,
              upload: { uploadId: 'twu_client', status: 'preview_ready' },
              summary: { totalRows: 2, validRows: 2, invalidRows: 0 }
            }
          };
        }
        if (action === 'getPreview') {
          return {
            result: {
              success: true,
              summary: { totalRows: 2, validRows: 2, invalidRows: 0 },
              validPreview: [{ word: 'cat', meaning: '猫', phonetic: '' }],
              errorPreview: []
            }
          };
        }
        if (action === 'publish') {
          return {
            result: {
              success: true,
              version: { versionId: 'twb_client_v1', version: 1, totalWords: 2 }
            }
          };
        }
        throw new Error(`unexpected_action:${action}`);
      },
    },
    getFileSystemManager: () => ({
      readFile: ({ filePath, success }) => {
        calls.push({ readFile: { filePath } });
        success({ data: new ArrayBuffer(2048) });
      }
    }),
    request: (request) => {
      calls.push({ request: {
        url: request.url,
        method: request.method,
        header: request.header,
        data: request.data
      } });
      request.success({ statusCode: 200 });
    }
  };

  const outcome = await service.prepareAndParse({
    wxApi,
    wordbookId: 'twb_client',
    file: {
      name: 'words.csv',
      path: 'tmp/words.csv',
      size: 2048,
      extension: 'csv'
    },
    onStage: (stage) => stages.push(stage)
  });
  assert.strictEqual(outcome.uploadId, 'twu_client');
  assert.deepStrictEqual(stages, ['preparing', 'uploading', 'parsing', 'preview']);
  assert.deepStrictEqual(calls[0], {
    name: 'teacherWordbook',
    data: {
      action: 'prepareUpload',
      wordbookId: 'twb_client',
      fileName: 'words.csv',
      fileSize: 2048
    }
  });
  assert.deepStrictEqual(calls[1], { readFile: { filePath: 'tmp/words.csv' } });
  assert.strictEqual(calls[2].request.method, 'PUT');
  assert.strictEqual(calls[2].request.data instanceof ArrayBuffer, true);
  assert.strictEqual(calls.some((call) => Object.hasOwn(call, 'uploadFile')), false);
  assert.deepStrictEqual(calls[3], {
    name: 'teacherWordbook',
    data: {
      action: 'parseUpload',
      wordbookId: 'twb_client',
      uploadId: 'twu_client'
    }
  });
  assert.strictEqual(calls.some((call) => (
    JSON.stringify(call).includes('teacherId')
    || JSON.stringify(call).includes('teacher_id')
  )), false);

  const published = await service.publish({
    wxApi,
    wordbookId: 'twb_client',
    uploadId: 'twu_client'
  });
  assert.strictEqual(published.version.version, 1);
  assert.deepStrictEqual(calls[calls.length - 1], {
    name: 'teacherWordbook',
    data: {
      action: 'publish',
      wordbookId: 'twb_client',
      uploadId: 'twu_client',
      confirmed: true
    }
  });

  console.log('teacher-wordbook-upload-client: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
