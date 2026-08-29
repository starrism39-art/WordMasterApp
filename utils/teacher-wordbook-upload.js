'use strict';

const SUPPORTED_EXTENSIONS = Object.freeze(['csv', 'xlsx']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ARRAY_BUFFER_TAG = '[object ArrayBuffer]';
const arrayBufferByteLengthGetter = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'byteLength'
).get;

const isArrayBuffer = (value) => {
  if (Object.prototype.toString.call(value) !== ARRAY_BUFFER_TAG) {
    return false;
  }
  try {
    return typeof arrayBufferByteLengthGetter.call(value) === 'number';
  } catch (error) {
    return false;
  }
};

const getExtension = (name) => {
  const value = String(name || '').trim();
  const dotIndex = value.lastIndexOf('.');
  return dotIndex < 0 ? '' : value.slice(dotIndex + 1).toLowerCase();
};

const unwrapResult = (response) => (
  response && response.result ? response.result : response
);

const createBusinessError = (result, fallbackMessage) => {
  const error = new Error(fallbackMessage || '教师词书操作失败');
  error.result = result || null;
  error.code = result && result.error ? result.error : 'REQUEST_FAILED';
  error.reason = result && result.reason ? result.reason : '';
  return error;
};

const callAction = async (cloudApi, action, data = {}) => {
  const response = await cloudApi.callFunction({
    name: 'teacherWordbook',
    data: { action, ...data }
  });
  const result = unwrapResult(response);
  if (!result || result.success !== true) {
    throw createBusinessError(result, `${action}失败`);
  }
  return result;
};

const validateFile = (file) => {
  const name = String(file && file.name || '').trim();
  const path = String(file && (file.path || file.tempFilePath) || '').trim();
  const size = Number(file && file.size);
  const extension = getExtension(name);

  if (!name || !path || !SUPPORTED_EXTENSIONS.includes(extension)) {
    throw createBusinessError({
      success: false,
      error: 'INVALID_ARGUMENT',
      reason: 'UNSUPPORTED_FILE_TYPE'
    });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) {
    throw createBusinessError({
      success: false,
      error: 'INVALID_ARGUMENT',
      reason: 'INVALID_FILE_SIZE'
    });
  }

  return { name, path, size, extension };
};

const chooseFile = (wxApi) => new Promise((resolve, reject) => {
  wxApi.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: SUPPORTED_EXTENSIONS.slice(),
    success: (result) => {
      const file = result && result.tempFiles && result.tempFiles[0];
      try {
        resolve(validateFile(file));
      } catch (error) {
        reject(error);
      }
    },
    fail: reject
  });
});

const readFileAsArrayBuffer = (wxApi, filePath) => new Promise((resolve, reject) => {
  const fileSystem = wxApi.getFileSystemManager();
  fileSystem.readFile({
    filePath,
    success: (result) => resolve(result && result.data),
    fail: reject
  });
});

const createTransportError = ({ error, reason, message, statusCode }) => {
  const businessError = createBusinessError({
    success: false,
    error,
    reason,
    statusCode
  }, message);
  businessError.requiresNewPrepare = true;
  businessError.requiresFileReselection = true;
  return businessError;
};

const ensureTransportIsUsable = (transport) => {
  const expiresAt = Number(transport && transport.expiresAt);
  if (!transport
    || transport.method !== 'PUT'
    || !transport.url
    || !Number.isFinite(expiresAt)
    || Date.now() >= expiresAt) {
    throw createTransportError({
      error: 'UPLOAD_AUTHORIZATION_EXPIRED',
      reason: 'STAGING_FILE_UNAVAILABLE',
      message: '安全上传凭证已过期，请重新选择文件'
    });
  }
};

const putArrayBuffer = ({ wxApi, transport, data }) => new Promise((resolve, reject) => {
  ensureTransportIsUsable(transport);
  wxApi.request({
    url: transport.url,
    method: 'PUT',
    header: { ...(transport.headers || {}) },
    data,
    success: (response) => {
      const statusCode = Number(response && response.statusCode);
      if (statusCode >= 200 && statusCode < 300) {
        resolve({ statusCode, requiresParseConfirmation: false });
        return;
      }
      if (statusCode === 409) {
        resolve({ statusCode, requiresParseConfirmation: true });
        return;
      }
      if (statusCode === 403) {
        reject(createTransportError({
          error: 'UPLOAD_AUTHORIZATION_FAILED',
          reason: 'STAGING_FILE_UNAVAILABLE',
          message: '安全上传鉴权失败或已过期，请重新选择文件',
          statusCode
        }));
        return;
      }
      reject(createBusinessError({
        success: false,
        error: 'UPLOAD_HTTP_FAILED',
        reason: 'STAGING_FILE_UNAVAILABLE',
        statusCode
      }, `安全上传失败（HTTP ${statusCode || 'unknown'}），请重新选择文件`));
    },
    fail: (error) => resolve({
      statusCode: 0,
      requiresParseConfirmation: true,
      networkError: error || null
    })
  });
});

const prepareAndParse = async ({
  wxApi,
  wordbookId,
  file,
  onStage = () => {}
}) => {
  const normalizedFile = validateFile(file);
  onStage('preparing');
  const prepared = await callAction(wxApi.cloud, 'prepareUpload', {
    wordbookId,
    fileName: normalizedFile.name,
    fileSize: normalizedFile.size
  });

  onStage('uploading', prepared.upload);
  ensureTransportIsUsable(prepared.transport);
  const fileData = await readFileAsArrayBuffer(wxApi, normalizedFile.path);
  if (!isArrayBuffer(fileData)) {
    throw createBusinessError({
      success: false,
      error: 'FILE_READ_FAILED',
      reason: 'STAGING_FILE_UNAVAILABLE'
    }, '读取待上传文件失败，请重新选择文件');
  }
  await putArrayBuffer({
    wxApi,
    transport: prepared.transport,
    data: fileData
  });

  onStage('parsing', prepared.upload);
  let parsed;
  try {
    parsed = await callAction(wxApi.cloud, 'parseUpload', {
      wordbookId,
      uploadId: prepared.upload.uploadId
    });
  } catch (error) {
    if (error.result) error.result.uploadId = prepared.upload.uploadId;
    throw error;
  }

  onStage('preview', parsed.upload);
  const preview = await callAction(wxApi.cloud, 'getPreview', {
    wordbookId,
    uploadId: prepared.upload.uploadId
  });
  return {
    file: normalizedFile,
    uploadId: prepared.upload.uploadId,
    publishToken: prepared.upload.publishToken,
    parsed,
    preview
  };
};

const publish = ({ wxApi, wordbookId, uploadId }) => callAction(
  wxApi.cloud,
  'publish',
  { wordbookId, uploadId, confirmed: true }
);

const updateVersion = ({ wxApi, wordbookId, uploadId, publishToken }) => callAction(
  wxApi.cloud,
  'updateVersion',
  { wordbookId, uploadId, publishToken }
);

module.exports = {
  SUPPORTED_EXTENSIONS,
  MAX_FILE_BYTES,
  getExtension,
  validateFile,
  chooseFile,
  readFileAsArrayBuffer,
  putArrayBuffer,
  prepareAndParse,
  publish,
  updateVersion
};
