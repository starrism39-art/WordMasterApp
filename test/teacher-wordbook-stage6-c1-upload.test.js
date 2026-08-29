'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const vm = require('vm');
const { execFileSync } = require('child_process');
const ExcelJS = require('../cloudfunctions/teacherWordbook/node_modules/exceljs');
const uploadClient = require('../utils/teacher-wordbook-upload');

const ENV_ID = 'cloudbase-4gafzdch60ad597b';
const BUCKET = '636c-cloudbase-4gafzdch60ad597b-1390590336';
const MAX_BYTES = 5 * 1024 * 1024;
const clone = (value) => JSON.parse(JSON.stringify(value));
const toFileId = (key) => `cloud://${ENV_ID}.${BUCKET}/${key}`;

const results = [];
const verify = async (number, name, action) => {
  await action();
  results.push({ number, name });
};

const draftBook = (wordbookId = 'twb_c1', teacherId = 'teacher-a') => ({
  _id: `doc-${wordbookId}`,
  teacher_id: teacherId,
  source_type: 'teacher_custom',
  wordbook_id: wordbookId,
  name: `Draft ${wordbookId}`,
  version: 0,
  current_version_id: '',
  current_file_id: '',
  total_words: 0,
  status: 'draft',
  schema_version: 1
});

const createBackendHarness = ({
  openid = 'teacher-a',
  book = draftBook(),
  headMode = 'storage',
  headSize,
  downloadContent
} = {}) => {
  const books = [clone(book)];
  const storage = new Map();
  const signCalls = [];
  const headCalls = [];
  const downloadCalls = [];
  let callerOpenid = openid;
  let sequence = 0;

  class CosObjectNotFoundError extends Error {}
  const cosMock = {
    buildCloudFileId: toFileId,
    createPresignedPut: ({ objectKey }) => {
      signCalls.push(objectKey);
      const issuedAt = Date.now();
      const expiresAt = issuedAt + 300000;
      return {
        issuedAt,
        expiresAt,
        transport: {
          method: 'PUT',
          url: `https://${BUCKET}.cos.ap-shanghai.myqcloud.com/${objectKey}?signed=1`,
          headers: { 'x-cos-forbid-overwrite': 'true' },
          expiresAt
        }
      };
    },
    headObject: async ({ objectKey }) => {
      headCalls.push(objectKey);
      if (headMode === 'missing') throw new CosObjectNotFoundError();
      const stored = storage.get(toFileId(objectKey));
      if (!stored && headMode === 'storage') throw new CosObjectNotFoundError();
      const size = headSize === undefined ? stored.length : headSize;
      return { size, etag: 'etag-c1' };
    },
    CosObjectNotFoundError
  };

  const collections = {
    teachers: [{ teacher_id: 'teacher-a' }, { teacher_id: 'teacher-b' }],
    teacher_wordbooks: books,
    teacher_wordbook_versions: []
  };
  const matches = (item, query) => Object.keys(query).every((key) => item[key] === query[key]);
  const database = {
    serverDate: () => `SERVER_DATE_${++sequence}`,
    collection: (name) => ({
      where: (query) => ({
        limit: (limit) => ({
          get: async () => ({ data: collections[name].filter((item) => matches(item, query)).slice(0, limit) })
        }),
        get: async () => ({ data: collections[name].filter((item) => matches(item, query)) })
      }),
      doc: (id) => ({
        update: async ({ data }) => {
          const target = collections[name].find((item) => item._id === id);
          if (!target) throw new Error('document_missing');
          Object.assign(target, clone(data));
        },
        set: async ({ data }) => {
          const target = collections[name].find((item) => item._id === id);
          if (target) Object.assign(target, clone(data));
          else collections[name].push({ _id: id, ...clone(data) });
        }
      })
    })
  };
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: ENV_ID,
    init: () => {},
    getWXContext: () => ({ OPENID: callerOpenid }),
    database: () => database,
    uploadFile: async ({ cloudPath, fileContent }) => {
      const fileID = toFileId(cloudPath);
      storage.set(fileID, Buffer.from(fileContent));
      return { fileID };
    },
    downloadFile: async ({ fileID }) => {
      downloadCalls.push(fileID);
      if (downloadContent !== undefined) return { fileContent: Buffer.from(downloadContent) };
      if (!storage.has(fileID)) throw new Error('storage_missing');
      return { fileContent: Buffer.from(storage.get(fileID)) };
    }
  };

  const modulePath = require.resolve('../cloudfunctions/teacherWordbook/index');
  const originalLoad = Module._load;
  delete require.cache[modulePath];
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock;
    if (request === './cos-upload-authorization') return cosMock;
    return originalLoad.call(this, request, parent, isMain);
  };
  let loaded;
  try {
    loaded = require(modulePath);
  } finally {
    Module._load = originalLoad;
  }

  return {
    main: loaded.main,
    state: () => ({ books, storage, signCalls, headCalls, downloadCalls }),
    put: (key, content) => storage.set(toFileId(key), Buffer.from(content)),
    setOpenid: (value) => { callerOpenid = value; }
  };
};

const prepare = async (harness, {
  wordbookId = 'twb_c1',
  fileName = 'words.csv',
  fileSize = 27,
  extra = {}
} = {}) => harness.main({
  action: 'prepareUpload', wordbookId, fileName, fileSize, ...extra
});

const prepareAndStore = async (harness, content, options = {}) => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const prepared = await prepare(harness, { ...options, fileSize: buffer.length });
  assert.strictEqual(prepared.success, true);
  const state = harness.state().books[0].upload_state;
  harness.put(state.staging_path, buffer);
  return prepared;
};

const parse = (harness, prepared, extra = {}) => harness.main({
  action: 'parseUpload',
  wordbookId: harness.state().books[0].wordbook_id,
  uploadId: prepared.upload.uploadId,
  ...extra
});

const createClientHarness = (options = {}) => {
  const { requestStatus = 200, requestFailure = null, expiresAt } = options;
  const fileData = Object.prototype.hasOwnProperty.call(options, 'fileData')
    ? options.fileData
    : new ArrayBuffer(27);
  const calls = [];
  const transportExpiry = expiresAt === undefined ? Date.now() + 300000 : expiresAt;
  const wxApi = {
    cloud: {
      callFunction: async (request) => {
        calls.push(clone(request));
        if (request.data.action === 'prepareUpload') {
          return { result: {
            success: true,
            upload: { uploadId: 'twu_client', publishToken: 'twp_client' },
            transport: {
              method: 'PUT',
              url: 'https://bucket.cos.ap-shanghai.myqcloud.com/source.csv?signed=1',
              headers: { 'x-cos-forbid-overwrite': 'true' },
              expiresAt: transportExpiry
            }
          } };
        }
        if (request.data.action === 'parseUpload') {
          return { result: { success: true, upload: { status: 'preview_ready' } } };
        }
        if (request.data.action === 'getPreview') {
          return { result: {
            success: true,
            summary: { totalRows: 1, validRows: 1, invalidRows: 0 },
            validPreview: [{ word: 'cat', meaning: '猫', phonetic: '' }],
            errorPreview: []
          } };
        }
        throw new Error(`unexpected_action:${request.data.action}`);
      }
    },
    getFileSystemManager: () => ({
      readFile: ({ filePath, success }) => {
        calls.push({ readFile: filePath });
        success({ data: fileData });
      }
    }),
    request: (request) => {
      calls.push({ request });
      if (requestFailure) request.fail(requestFailure);
      else request.success({ statusCode: requestStatus });
    }
  };
  return { wxApi, calls };
};

const exerciseAuthorizationModule = () => {
  const modulePath = require.resolve('../cloudfunctions/teacherWordbook/cos-upload-authorization');
  const originalLoad = Module._load;
  const saved = {
    id: process.env.TENCENTCLOUD_SECRETID,
    key: process.env.TENCENTCLOUD_SECRETKEY,
    token: process.env.TENCENTCLOUD_SESSIONTOKEN
  };
  const constructorCalls = [];
  const urlCalls = [];
  class CosMock {
    constructor(options) { constructorCalls.push(options); }
    getObjectUrl(options) {
      urlCalls.push(options);
      return 'https://safe.example/source.csv?signed=1';
    }
    async headObject() { return { headers: { 'content-length': '27', etag: '"etag"' } }; }
  }
  process.env.TENCENTCLOUD_SECRETID = 'temporary-id';
  process.env.TENCENTCLOUD_SECRETKEY = 'temporary-key';
  process.env.TENCENTCLOUD_SESSIONTOKEN = 'temporary-token';
  delete require.cache[modulePath];
  Module._load = function load(request, parent, isMain) {
    if (request === 'cos-nodejs-sdk-v5') return CosMock;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const authorization = require(modulePath);
    const signed = authorization.createPresignedPut({ objectKey: 'teacher-wordbooks/a/b/staging/c/source.csv' });
    assert.strictEqual(constructorCalls[0].SecurityToken, 'temporary-token');
    assert.strictEqual(urlCalls[0].Method, 'PUT');
    assert.strictEqual(urlCalls[0].Expires, 300);
    assert.strictEqual(urlCalls[0].Headers['x-cos-forbid-overwrite'], 'true');
    assert.strictEqual(urlCalls[0].ForceSignHost, true);
    assert.ok(urlCalls[0].Headers.Host.includes(BUCKET));
    assert.ok(signed.expiresAt - signed.issuedAt === 300000);
    delete process.env.TENCENTCLOUD_SESSIONTOKEN;
    assert.throws(
      () => authorization.createPresignedPut({ objectKey: 'teacher-wordbooks/a/b/staging/c/source.csv' }),
      /runtime_temporary_credentials_unavailable/
    );
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
    if (saved.id === undefined) delete process.env.TENCENTCLOUD_SECRETID;
    else process.env.TENCENTCLOUD_SECRETID = saved.id;
    if (saved.key === undefined) delete process.env.TENCENTCLOUD_SECRETKEY;
    else process.env.TENCENTCLOUD_SECRETKEY = saved.key;
    if (saved.token === undefined) delete process.env.TENCENTCLOUD_SESSIONTOKEN;
    else process.env.TENCENTCLOUD_SESSIONTOKEN = saved.token;
  }
};

(async () => {
  exerciseAuthorizationModule();
  const packageJson = require('../cloudfunctions/teacherWordbook/package.json');
  assert.strictEqual(packageJson.dependencies['cos-nodejs-sdk-v5'], '3.0.0');

  await verify(1, 'prepare uses server-derived staging path', async () => {
    const h = createBackendHarness();
    const r = await prepare(h, { extra: { storagePath: 'forged', key: 'forged' } });
    assert.ok(h.state().books[0].upload_state.staging_path.startsWith('teacher-wordbooks/teacher-a/twb_c1/staging/'));
    assert.strictEqual(h.state().signCalls[0], h.state().books[0].upload_state.staging_path);
    assert.strictEqual(r.success, true);
  });
  await verify(2, 'client teacherId cannot change owner path', async () => {
    const h = createBackendHarness();
    await prepare(h, { extra: { teacherId: 'teacher-b', teacher_id: 'teacher-b' } });
    assert.ok(h.state().books[0].upload_state.staging_path.includes('/teacher-a/'));
  });
  await verify(3, 'prepare does not return explicit Key', async () => {
    const r = await prepare(createBackendHarness());
    assert.strictEqual(Object.hasOwn(r.upload, 'key'), false);
    assert.strictEqual(Object.hasOwn(r.transport, 'key'), false);
  });
  await verify(4, 'prepare does not return cloudPath', async () => {
    const r = await prepare(createBackendHarness());
    assert.strictEqual(Object.hasOwn(r.upload, 'cloudPath'), false);
  });
  await verify(5, 'prepare does not return fileId', async () => {
    const r = await prepare(createBackendHarness());
    assert.strictEqual(/fileId|fileID/.test(JSON.stringify(r)), false);
  });
  await verify(6, 'prepare rejects over 5MB before signing', async () => {
    const h = createBackendHarness();
    const r = await prepare(h, { fileSize: MAX_BYTES + 1 });
    assert.strictEqual(r.reason, 'INVALID_FILE_SIZE');
    assert.strictEqual(h.state().signCalls.length, 0);
  });
  await verify(7, 'prepare rejects non CSV/XLSX before signing', async () => {
    const h = createBackendHarness();
    const r = await prepare(h, { fileName: 'words.pdf' });
    assert.strictEqual(r.reason, 'UNSUPPORTED_FILE_TYPE');
    assert.strictEqual(h.state().signCalls.length, 0);
  });
  await verify(8, 'authorization expires in about 300 seconds', async () => {
    const before = Date.now();
    const r = await prepare(createBackendHarness());
    assert.ok(r.transport.expiresAt - before >= 299000);
    assert.ok(r.transport.expiresAt - before <= 301000);
  });
  await verify(9, 'transport requires forbid-overwrite header', async () => {
    const r = await prepare(createBackendHarness());
    assert.deepStrictEqual(r.transport.headers, { 'x-cos-forbid-overwrite': 'true' });
  });

  const clientSource = fs.readFileSync(path.resolve(__dirname, '../utils/teacher-wordbook-upload.js'), 'utf8');
  await verify(10, 'formal client has no wx.cloud.uploadFile', async () => {
    assert.strictEqual(/cloud\.uploadFile\s*\(/.test(clientSource), false);
  });
  await verify(11, 'client uses wx.request PUT', async () => {
    const h = createClientHarness();
    await uploadClient.prepareAndParse({ wxApi: h.wxApi, wordbookId: 'twb_client', file: { name: 'words.csv', path: 'tmp.csv', size: 27 } });
    const request = h.calls.find((item) => item.request).request;
    assert.strictEqual(request.method, 'PUT');
  });
  await verify(12, 'client uploads an ArrayBuffer', async () => {
    const h = createClientHarness();
    await uploadClient.prepareAndParse({ wxApi: h.wxApi, wordbookId: 'twb_client', file: { name: 'words.csv', path: 'tmp.csv', size: 27 } });
    assert.strictEqual(h.calls.find((item) => item.request).request.data instanceof ArrayBuffer, true);
  });
  await verify(13, 'client parse call sends no fileId', async () => {
    const h = createClientHarness();
    await uploadClient.prepareAndParse({ wxApi: h.wxApi, wordbookId: 'twb_client', file: { name: 'words.csv', path: 'tmp.csv', size: 27 } });
    const call = h.calls.find((item) => item.data && item.data.action === 'parseUpload');
    assert.deepStrictEqual(Object.keys(call.data).sort(), ['action', 'uploadId', 'wordbookId']);
  });
  await verify(14, '403 gives authorization/reselection error', async () => {
    const h = createClientHarness({ requestStatus: 403 });
    await assert.rejects(
      uploadClient.prepareAndParse({ wxApi: h.wxApi, wordbookId: 'twb_client', file: { name: 'words.csv', path: 'tmp.csv', size: 27 } }),
      (error) => error.code === 'UPLOAD_AUTHORIZATION_FAILED'
        && error.requiresNewPrepare === true
        && /重新选择文件/.test(error.message)
    );
    assert.strictEqual(h.calls.some((item) => item.data && item.data.action === 'parseUpload'), false);
  });
  await verify(15, 'uncertain network result proceeds to parse confirmation', async () => {
    const h = createClientHarness({ requestFailure: { errMsg: 'request:fail timeout' } });
    const result = await uploadClient.prepareAndParse({ wxApi: h.wxApi, wordbookId: 'twb_client', file: { name: 'words.csv', path: 'tmp.csv', size: 27 } });
    assert.strictEqual(result.preview.success, true);
    assert.ok(h.calls.some((item) => item.data && item.data.action === 'parseUpload'));
  });
  await verify(16, 'expired URL requires a new prepare/reselection', async () => {
    const h = createClientHarness({ expiresAt: Date.now() - 1 });
    await assert.rejects(
      uploadClient.prepareAndParse({ wxApi: h.wxApi, wordbookId: 'twb_client', file: { name: 'words.csv', path: 'tmp.csv', size: 27 } }),
      (error) => error.code === 'UPLOAD_AUTHORIZATION_EXPIRED' && error.requiresNewPrepare === true
    );
    assert.strictEqual(h.calls.some((item) => item.request), false);
  });

  const csv = Buffer.from('word,meaning,phonetic\ncat,猫,/kæt/\ndog,狗,\n', 'utf8');
  await verify(17, 'parse ignores forged client fileId', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    assert.strictEqual((await parse(h, p, { fileId: 'cloud://evil/forged.csv' })).success, true);
  });
  await verify(18, 'parse ignores forged teacherId', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    assert.strictEqual((await parse(h, p, { teacherId: 'teacher-b', teacher_id: 'teacher-b' })).success, true);
  });
  await verify(19, 'parse recomputes the object key', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    await parse(h, p, { key: 'evil.csv', cloudPath: 'evil.csv' });
    assert.strictEqual(h.state().headCalls[0], h.state().books[0].upload_state.staging_path);
  });
  await verify(20, 'parse rejects mismatched uploadId', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    const r = await h.main({ action: 'parseUpload', wordbookId: 'twb_c1', uploadId: `${p.upload.uploadId}_forged` });
    assert.strictEqual(r.reason, 'UPLOAD_NOT_FOUND');
  });
  await verify(21, 'parse rejects missing HeadObject', async () => {
    const h = createBackendHarness({ headMode: 'missing' });
    const p = await prepare(h, { fileSize: csv.length });
    assert.strictEqual((await parse(h, p)).reason, 'STAGING_FILE_UNAVAILABLE');
  });
  await verify(22, 'parse rejects actual object over 5MB', async () => {
    const h = createBackendHarness({ headMode: 'override', headSize: MAX_BYTES + 1 });
    const p = await prepare(h, { fileSize: csv.length });
    assert.strictEqual((await parse(h, p)).reason, 'ACTUAL_FILE_SIZE_INVALID');
  });
  await verify(23, 'parse rejects declared/actual size mismatch', async () => {
    const h = createBackendHarness({ headMode: 'override', headSize: csv.length + 1 });
    const p = await prepare(h, { fileSize: csv.length });
    assert.strictEqual((await parse(h, p)).reason, 'FILE_SIZE_MISMATCH');
  });
  await verify(24, 'normal exact size passes', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    assert.strictEqual((await parse(h, p)).success, true);
  });
  await verify(25, 'ETag is recorded in upload_state', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    await parse(h, p);
    assert.strictEqual(h.state().books[0].upload_state.object_etag, 'etag-c1');
  });
  await verify(26, 'cloud.downloadFile uses server-derived fileID', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    const expected = h.state().books[0].upload_state.source_file_id;
    await parse(h, p, { fileId: 'cloud://evil/forged.csv' });
    assert.strictEqual(h.state().downloadCalls[0], expected);
  });
  await verify(27, 'CSV continues through existing parser', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    const r = await parse(h, p);
    assert.deepStrictEqual(r.summary, { totalRows: 2, validRows: 2, invalidRows: 0 });
  });
  await verify(28, 'XLSX continues through existing parser', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('words');
    sheet.addRow(['word', 'meaning', 'phonetic']);
    sheet.addRow(['cat', '猫', '/kæt/']);
    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    const h = createBackendHarness({ book: draftBook('twb_xlsx') });
    const p = await prepareAndStore(h, content, { wordbookId: 'twb_xlsx', fileName: 'words.xlsx' });
    const r = await parse(h, p);
    assert.deepStrictEqual(r.summary, { totalRows: 1, validRows: 1, invalidRows: 0 });
  });
  await verify(29, 'repeat parse is safe and idempotent', async () => {
    const h = createBackendHarness();
    const p = await prepareAndStore(h, csv);
    assert.strictEqual((await parse(h, p)).success, true);
    const second = await parse(h, p, { fileId: 'forged' });
    assert.strictEqual(second.success, true);
    assert.strictEqual(second.idempotent, true);
    assert.strictEqual(h.state().headCalls.length, 1);
  });

  const stage4Output = execFileSync(process.execPath, [path.resolve(__dirname, 'teacher-wordbook-stage4.test.js')], { encoding: 'utf8' });
  const stage6Output = execFileSync(process.execPath, [path.resolve(__dirname, 'teacher-wordbook-stage6-version-update.test.js')], { encoding: 'utf8' });
  await verify(30, 'initial publish regression suite passes', async () => assert.ok(stage4Output.includes('PASS')));
  await verify(31, 'version update regression suite passes', async () => assert.ok(stage6Output.includes('PASS')));
  await verify(32, 'VERSION_CONFLICT regression suite passes', async () => assert.ok(stage6Output.includes('PASS')));
  await verify(33, 'v1 immutability regression suite passes', async () => assert.ok(stage6Output.includes('PASS')));
  await verify(34, 'official wordbook count remains 46', async () => {
    const official = require('../data/wordbooks-simple');
    assert.strictEqual(['primary', 'junior', 'senior'].reduce((sum, key) => sum + official[key].length, 0), 46);
  });
  await verify(35, 'client accepts cross-realm ArrayBuffer and rejects invalid binary values', async () => {
    const crossRealmBuffer = vm.runInNewContext('new ArrayBuffer(27)');
    assert.strictEqual(Object.prototype.toString.call(crossRealmBuffer), '[object ArrayBuffer]');
    assert.strictEqual(crossRealmBuffer instanceof ArrayBuffer, false);

    const crossRealmHarness = createClientHarness({ fileData: crossRealmBuffer });
    await uploadClient.prepareAndParse({
      wxApi: crossRealmHarness.wxApi,
      wordbookId: 'twb_client',
      file: { name: 'words.csv', path: 'tmp.csv', size: 27 }
    });
    const request = crossRealmHarness.calls.find((item) => item.request).request;
    assert.strictEqual(request.data, crossRealmBuffer);

    const invalidValues = [
      null,
      undefined,
      'not-binary',
      27,
      {},
      { byteLength: 27 },
      { byteLength: 27, [Symbol.toStringTag]: 'ArrayBuffer' },
      new Uint8Array(27),
      new DataView(new ArrayBuffer(27))
    ];
    for (const invalidValue of invalidValues) {
      const invalidHarness = createClientHarness({ fileData: invalidValue });
      await assert.rejects(
        uploadClient.prepareAndParse({
          wxApi: invalidHarness.wxApi,
          wordbookId: 'twb_client',
          file: { name: 'words.csv', path: 'tmp.csv', size: 27 }
        }),
        (error) => error.code === 'FILE_READ_FAILED'
          && error.reason === 'STAGING_FILE_UNAVAILABLE'
      );
      assert.strictEqual(invalidHarness.calls.some((item) => item.request), false);
    }
  });

  assert.deepStrictEqual(results.map((item) => item.number), Array.from({ length: 35 }, (_, index) => index + 1));
  process.stdout.write(`teacher-wordbook-stage6-c1-upload: PASS (${results.length}/35)\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
