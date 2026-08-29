'use strict';

const COS = require('cos-nodejs-sdk-v5');

const ENV_ID = 'cloudbase-4gafzdch60ad597b';
const BUCKET = '636c-cloudbase-4gafzdch60ad597b-1390590336';
const REGION = 'ap-shanghai';
const AUTHORIZATION_TTL_SECONDS = 300;
const FORBID_OVERWRITE_HEADER = 'x-cos-forbid-overwrite';
const FORBID_OVERWRITE_VALUE = 'true';
const HOST = `${BUCKET}.cos.${REGION}.myqcloud.com`;

class CosObjectNotFoundError extends Error {
  constructor() {
    super('cos_object_not_found');
    this.name = 'CosObjectNotFoundError';
  }
}

const readRuntimeCredentials = () => {
  const SecretId = String(process.env.TENCENTCLOUD_SECRETID || '').trim();
  const SecretKey = String(process.env.TENCENTCLOUD_SECRETKEY || '').trim();
  const SecurityToken = String(process.env.TENCENTCLOUD_SESSIONTOKEN || '').trim();
  if (!SecretId || !SecretKey || !SecurityToken) {
    throw new Error('runtime_temporary_credentials_unavailable');
  }
  return { SecretId, SecretKey, SecurityToken };
};

const createCosClient = () => new COS({
  ...readRuntimeCredentials(),
  ForceSignHost: true
});

const normalizeObjectKey = (value) => {
  const key = String(value || '').trim().replace(/^\/+/, '');
  if (!key || key.includes('..')) throw new Error('invalid_cos_object_key');
  return key;
};

const buildCloudFileId = (objectKey) => (
  `cloud://${ENV_ID}.${BUCKET}/${normalizeObjectKey(objectKey)}`
);

const createPresignedPut = ({ objectKey }) => {
  const key = normalizeObjectKey(objectKey);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + AUTHORIZATION_TTL_SECONDS * 1000;
  const client = createCosClient();
  const url = client.getObjectUrl({
    Bucket: BUCKET,
    Region: REGION,
    Key: key,
    Method: 'PUT',
    Expires: AUTHORIZATION_TTL_SECONDS,
    Headers: {
      Host: HOST,
      [FORBID_OVERWRITE_HEADER]: FORBID_OVERWRITE_VALUE
    },
    ForceSignHost: true
  });
  if (!url || typeof url !== 'string') throw new Error('cos_presigned_url_unavailable');
  return {
    transport: {
      method: 'PUT',
      url,
      headers: {
        [FORBID_OVERWRITE_HEADER]: FORBID_OVERWRITE_VALUE
      },
      expiresAt
    },
    issuedAt,
    expiresAt
  };
};

const isNotFoundError = (error) => {
  const statusCode = Number(error && (error.statusCode || error.status));
  const code = String(error && (error.code || error.errorCode) || '');
  return statusCode === 404 || code === 'NoSuchKey' || code === 'NotFound';
};

const headObject = async ({ objectKey }) => {
  const key = normalizeObjectKey(objectKey);
  let result;
  try {
    result = await createCosClient().headObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key
    });
  } catch (error) {
    if (isNotFoundError(error)) throw new CosObjectNotFoundError();
    throw error;
  }

  const headers = result && result.headers ? result.headers : {};
  const size = Number(
    headers['content-length'] === undefined ? result && result.ContentLength : headers['content-length']
  );
  const etag = String(result && result.ETag || headers.etag || '').trim().replace(/^"|"$/g, '');
  if (!Number.isFinite(size) || size < 0) throw new Error('cos_object_size_unavailable');
  if (!etag) throw new Error('cos_object_etag_unavailable');
  return { size, etag };
};

module.exports = {
  ENV_ID,
  BUCKET,
  REGION,
  AUTHORIZATION_TTL_SECONDS,
  FORBID_OVERWRITE_HEADER,
  FORBID_OVERWRITE_VALUE,
  buildCloudFileId,
  createPresignedPut,
  headObject,
  CosObjectNotFoundError
};
