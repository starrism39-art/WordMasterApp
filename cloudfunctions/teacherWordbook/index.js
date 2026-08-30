'use strict';

const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  TEACHER_WORDBOOK_STATUS,
  TEACHER_WORDBOOK_VERSION_STATUS,
  UPLOAD_STATUS,
  UPLOAD_OPERATION_TYPE,
  SOURCE_TYPE,
  SCHEMA_VERSION,
  ERROR_CODES,
  FEATURES
} = require('./model');
const officialWordbookNames = require('./official-wordbook-names');
const {
  normalizeDisplayText,
  normalizeWordbookName
} = require('./name-utils');
const {
  DEFAULT_MAX_ROWS,
  UploadParseError,
  parseUploadBuffer
} = require('./upload-parser');
const {
  normalizeExtension,
  buildUploadPaths,
  buildVersionPath,
  fileIdMatchesPath
} = require('./storage-paths');
const {
  attachRowKeys,
  matchWordIds
} = require('./word-id-matcher');
const {
  buildCloudFileId,
  createPresignedPut,
  headObject,
  CosObjectNotFoundError
} = require('./cos-upload-authorization');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const OFFICIAL_NAME_KEYS = new Set(
  officialWordbookNames.map(normalizeWordbookName)
);

const INPUT_LIMITS = Object.freeze({
  NAME: 50,
  CATEGORY: 30,
  DESCRIPTION: 500,
  FILE_NAME: 120,
  FILE_BYTES: 5 * 1024 * 1024,
  PREVIEW_VALID: 20,
  PREVIEW_ERRORS: 50
});

const normalizeIdentifier = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

const normalizeDescription = (value) => (
  String(value === undefined || value === null ? '' : value).trim()
);

const normalizeNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const failure = (error, details = {}) => ({
  success: false,
  schemaVersion: SCHEMA_VERSION,
  error,
  ...details
});

const getCallerOpenid = () => {
  const wxContext = cloud.getWXContext();
  return normalizeIdentifier(wxContext && wxContext.OPENID);
};

const findTeacher = async (callerOpenid) => {
  const result = await db.collection('teachers')
    .where({ teacher_id: callerOpenid })
    .limit(1)
    .get();

  return result && Array.isArray(result.data) && result.data.length > 0
    ? result.data[0]
    : null;
};

const createWordbookId = () => `twb_${crypto.randomBytes(12).toString('hex')}`;
const createUploadId = () => `twu_${crypto.randomBytes(12).toString('hex')}`;
const createPublishToken = () => `twp_${crypto.randomBytes(16).toString('hex')}`;

const createVersionId = (wordbookId, version) => `${wordbookId}_v${version}`;

const getFileExtension = (fileName) => {
  const normalizedName = normalizeIdentifier(fileName);
  const dotIndex = normalizedName.lastIndexOf('.');
  return dotIndex < 0 ? '' : normalizeExtension(normalizedName.slice(dotIndex + 1));
};

const sanitizeFileName = (value) => (
  normalizeDisplayText(value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, INPUT_LIMITS.FILE_NAME)
);

const toUploadSummary = (uploadState) => {
  if (!uploadState) return null;
  return {
    uploadId: normalizeIdentifier(uploadState.upload_id),
    status: normalizeIdentifier(uploadState.status),
    fileName: normalizeDisplayText(uploadState.original_file_name),
    operationType: normalizeIdentifier(uploadState.operation_type),
    baseVersion: normalizeNumber(uploadState.base_version, 0),
    targetVersion: normalizeNumber(uploadState.target_version, 0),
    totalRows: normalizeNumber(uploadState.total_rows, 0),
    validRows: normalizeNumber(uploadState.valid_rows, 0),
    invalidRows: normalizeNumber(uploadState.invalid_rows, 0),
    reason: normalizeIdentifier(uploadState.failure_reason)
  };
};

const findOwnedWordbook = async (callerOpenid, wordbookId) => {
  const result = await db.collection(COLLECTIONS.TEACHER_WORDBOOKS)
    .where({
      teacher_id: callerOpenid,
      wordbook_id: wordbookId
    })
    .limit(1)
    .get();
  return result && Array.isArray(result.data) && result.data.length > 0
    ? result.data[0]
    : null;
};

const updateWordbook = async (book, data) => {
  if (!book || !book._id) throw new Error('wordbook_document_id_missing');
  await db.collection(COLLECTIONS.TEACHER_WORDBOOKS)
    .doc(book._id)
    .update({ data });
};

const uploadJson = async (cloudPath, value) => {
  const result = await cloud.uploadFile({
    cloudPath,
    fileContent: Buffer.from(JSON.stringify(value), 'utf8')
  });
  return normalizeIdentifier(result && result.fileID);
};

const downloadJson = async (fileId) => {
  const result = await cloud.downloadFile({ fileID: fileId });
  return JSON.parse(result.fileContent.toString('utf8'));
};

class VersionConflictError extends Error {
  constructor(reason) {
    super(reason || 'VERSION_CONFLICT');
    this.name = 'VersionConflictError';
    this.reason = reason || 'VERSION_CONFLICT';
  }
}

const getDocumentData = (result) => {
  if (!result) return null;
  if (Array.isArray(result.data)) return result.data[0] || null;
  return result.data || null;
};

const isDocumentNotFoundError = (error) => {
  const message = [error && error.message, error && error.errMsg, error && error.errmsg]
    .filter(Boolean)
    .join(' ');
  return /document\.get:fail\s+document with _id\s+.+\s+does not exist/i.test(message);
};

const getOptionalTransactionDocument = async (reference) => {
  try {
    return getDocumentData(await reference.get());
  } catch (error) {
    if (isDocumentNotFoundError(error)) return null;
    throw error;
  }
};

const findPublishedVersion = async (callerOpenid, wordbookId, version) => {
  const result = await db.collection(COLLECTIONS.TEACHER_WORDBOOK_VERSIONS)
    .where({
      teacher_id: callerOpenid,
      wordbook_id: wordbookId,
      version
    })
    .limit(1)
    .get();
  return result && Array.isArray(result.data) && result.data.length > 0
    ? result.data[0]
    : null;
};

const findPublishedVersionByToken = async (callerOpenid, wordbookId, uploadId, publishToken) => {
  const result = await db.collection(COLLECTIONS.TEACHER_WORDBOOK_VERSIONS)
    .where({
      teacher_id: callerOpenid,
      wordbook_id: wordbookId
    })
    .limit(100)
    .get();
  return result && Array.isArray(result.data)
    ? result.data.find((version) => (
      version.upload_id === uploadId
      && version.publish_token === publishToken
      && version.source_type === SOURCE_TYPE
      && version.status === TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED
    )) || null
    : null;
};

const listEarlierPublishedVersions = async (callerOpenid, wordbookId, baseVersion) => {
  if (baseVersion > 100) throw new Error('VERSION_HISTORY_LIMIT_EXCEEDED');
  const result = await db.collection(COLLECTIONS.TEACHER_WORDBOOK_VERSIONS)
    .where({
      teacher_id: callerOpenid,
      wordbook_id: wordbookId
    })
    .limit(100)
    .get();
  return result && Array.isArray(result.data)
    ? result.data
      .filter((version) => (
        version.source_type === SOURCE_TYPE
        && version.status === TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED
        && normalizeNumber(version.version, 0) >= 1
        && normalizeNumber(version.version, 0) < baseVersion
      ))
      .sort((left, right) => normalizeNumber(left.version, 0) - normalizeNumber(right.version, 0))
    : [];
};

const getUploadOperation = (book) => {
  const version = normalizeNumber(book && book.version, 0);
  const status = normalizeIdentifier(book && book.status);
  if (status === TEACHER_WORDBOOK_STATUS.DRAFT && version === 0) {
    return {
      operationType: UPLOAD_OPERATION_TYPE.INITIAL_PUBLISH,
      baseVersion: 0,
      targetVersion: 1
    };
  }
  if (status === TEACHER_WORDBOOK_STATUS.ACTIVE && version >= 1) {
    return {
      operationType: UPLOAD_OPERATION_TYPE.VERSION_UPDATE,
      baseVersion: version,
      targetVersion: version + 1
    };
  }
  return null;
};

const validateUploadOperation = (book, uploadState) => {
  const currentVersion = normalizeNumber(book && book.version, 0);
  const currentStatus = normalizeIdentifier(book && book.status);
  const operationType = normalizeIdentifier(uploadState && uploadState.operation_type)
    || (currentStatus === TEACHER_WORDBOOK_STATUS.DRAFT && currentVersion === 0
      ? UPLOAD_OPERATION_TYPE.INITIAL_PUBLISH
      : '');
  const baseVersion = normalizeNumber(uploadState && uploadState.base_version, -1);
  const targetVersion = normalizeNumber(uploadState && uploadState.target_version, -1);

  if (operationType === UPLOAD_OPERATION_TYPE.INITIAL_PUBLISH) {
    return currentStatus === TEACHER_WORDBOOK_STATUS.DRAFT
      && currentVersion === 0
      && (baseVersion === 0 || baseVersion === -1)
      && (targetVersion === 1 || targetVersion === -1);
  }
  if (operationType === UPLOAD_OPERATION_TYPE.VERSION_UPDATE) {
    if (currentStatus !== TEACHER_WORDBOOK_STATUS.ACTIVE) return false;
    if (targetVersion !== baseVersion + 1) return false;
    if (currentVersion !== baseVersion) throw new VersionConflictError('BASE_VERSION_CHANGED');
    return baseVersion >= 1;
  }
  return false;
};

const toCatalogBook = (book) => ({
  wordbookId: normalizeIdentifier(book && (book.wordbook_id || book.wordbookId)),
  title: normalizeDisplayText(book && (book.name || book.title)),
  category: normalizeDisplayText(book && book.category),
  description: normalizeDescription(book && book.description),
  sourceType: SOURCE_TYPE,
  status: normalizeIdentifier(book && book.status),
  version: normalizeNumber(book && book.version, 0),
  totalWords: normalizeNumber(
    book && (book.total_words === undefined ? book.totalWords : book.total_words),
    0
  ),
  currentVersionId: normalizeIdentifier(
    book && (book.current_version_id || book.currentVersionId)
  ),
  updatedAt: book && book.updatedAt ? book.updatedAt : null
});

const validatePublishedWords = (words, wordbookId, expectedTotal) => {
  if (!Array.isArray(words) || words.length !== expectedTotal) {
    return false;
  }

  const seenIds = Object.create(null);
  return words.every((entry, index) => {
    const id = normalizeIdentifier(entry && entry.id);
    const entryWordbookId = normalizeIdentifier(entry && entry.wordbookId);
    const word = normalizeDisplayText(entry && entry.word);
    const meaning = normalizeDisplayText(entry && entry.meaning);
    const order = normalizeNumber(entry && entry.order, 0);
    const valid = id.startsWith(`${wordbookId}_w_`)
      && entryWordbookId === wordbookId
      && !!word
      && !!meaning
      && order === index + 1
      && !seenIds[id];
    if (valid) seenIds[id] = true;
    return valid;
  });
};

const validateDraftInput = (event) => {
  const name = normalizeDisplayText(event && event.name);
  const nameKey = normalizeWordbookName(name);
  const category = normalizeDisplayText(event && event.category);
  const description = normalizeDescription(event && event.description);

  if (!name) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'NAME_REQUIRED' });
  }

  if (name.length > INPUT_LIMITS.NAME) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'NAME_TOO_LONG' });
  }

  if (category.length > INPUT_LIMITS.CATEGORY) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'CATEGORY_TOO_LONG' });
  }

  if (description.length > INPUT_LIMITS.DESCRIPTION) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'DESCRIPTION_TOO_LONG' });
  }

  if (OFFICIAL_NAME_KEYS.has(nameKey)) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'OFFICIAL_NAME_RESERVED' });
  }

  return { name, nameKey, category, description };
};

const handleHealth = async () => {
  const callerOpenid = getCallerOpenid();

  if (!callerOpenid) {
    return failure(ERROR_CODES.UNAUTHORIZED, {
      authenticated: false,
      isTeacher: false
    });
  }

  try {
    const teacher = await findTeacher(callerOpenid);

    if (!teacher) {
      return failure(ERROR_CODES.TEACHER_NOT_FOUND, {
        authenticated: true,
        isTeacher: false
      });
    }

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      authenticated: true,
      isTeacher: true
    };
  } catch (error) {
    console.error('[teacherWordbook] health check failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR, {
      authenticated: true,
      isTeacher: false
    });
  }
};

const handleList = async (event) => {
  const callerOpenid = getCallerOpenid();

  if (!callerOpenid) {
    return failure(ERROR_CODES.UNAUTHORIZED);
  }

  try {
    const teacher = await findTeacher(callerOpenid);

    if (!teacher) {
      return failure(ERROR_CODES.TEACHER_NOT_FOUND);
    }

    const managementScope = normalizeIdentifier(event && event.scope) === 'manage';
    const criteria = managementScope
      ? { teacher_id: callerOpenid }
      : {
          teacher_id: callerOpenid,
          status: TEACHER_WORDBOOK_STATUS.ACTIVE
        };
    const booksResult = await db.collection(COLLECTIONS.TEACHER_WORDBOOKS)
      .where(criteria)
      .get();
    const books = booksResult && Array.isArray(booksResult.data)
      ? booksResult.data.map(toCatalogBook)
      : [];

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      books
    };
  } catch (error) {
    console.error('[teacherWordbook] list failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const handleDisable = async (event) => {
  const callerOpenid = getCallerOpenid();
  if (!callerOpenid) return failure(ERROR_CODES.UNAUTHORIZED);

  try {
    const teacher = await findTeacher(callerOpenid);
    if (!teacher) return failure(ERROR_CODES.TEACHER_NOT_FOUND);

    const wordbookId = normalizeIdentifier(event && event.wordbookId);
    if (!wordbookId) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_ID_REQUIRED' });
    }

    const book = await findOwnedWordbook(callerOpenid, wordbookId);
    if (!book) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_NOT_FOUND' });
    }
    if (normalizeIdentifier(book.source_type) !== SOURCE_TYPE) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'TEACHER_CUSTOM_REQUIRED' });
    }

    const currentStatus = normalizeIdentifier(book.status);
    if (currentStatus === TEACHER_WORDBOOK_STATUS.DISABLED) {
      return {
        success: true,
        schemaVersion: SCHEMA_VERSION,
        idempotent: true,
        book: toCatalogBook(book)
      };
    }
    if (currentStatus !== TEACHER_WORDBOOK_STATUS.ACTIVE) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'ACTIVE_WORDBOOK_REQUIRED' });
    }

    const disabledBook = {
      ...book,
      status: TEACHER_WORDBOOK_STATUS.DISABLED
    };
    await updateWordbook(book, {
      status: TEACHER_WORDBOOK_STATUS.DISABLED,
      updatedAt: db.serverDate()
    });

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      idempotent: false,
      book: toCatalogBook(disabledBook)
    };
  } catch (error) {
    console.error('[teacherWordbook] disable failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const handleGetPublished = async (event) => {
  const callerOpenid = getCallerOpenid();
  if (!callerOpenid) return failure(ERROR_CODES.UNAUTHORIZED);

  try {
    const teacher = await findTeacher(callerOpenid);
    if (!teacher) return failure(ERROR_CODES.TEACHER_NOT_FOUND);

    const wordbookId = normalizeIdentifier(event && event.wordbookId);
    if (!wordbookId) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_ID_REQUIRED' });
    }

    const book = await findOwnedWordbook(callerOpenid, wordbookId);
    if (!book) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_NOT_FOUND' });
    }
    if (normalizeIdentifier(book.source_type) !== SOURCE_TYPE
      || normalizeIdentifier(book.status) !== TEACHER_WORDBOOK_STATUS.ACTIVE) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'ACTIVE_WORDBOOK_REQUIRED' });
    }

    const currentVersion = normalizeNumber(book.version, 0);
    const requestedVersion = event && event.version !== undefined
      ? normalizeNumber(event.version, 0)
      : currentVersion;
    if (requestedVersion < 1 || requestedVersion !== currentVersion) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'VERSION_NOT_ACTIVE' });
    }

    const versionDocument = await findPublishedVersion(
      callerOpenid,
      wordbookId,
      requestedVersion
    );
    if (!versionDocument
      || normalizeIdentifier(versionDocument.source_type) !== SOURCE_TYPE
      || normalizeIdentifier(versionDocument.status) !== TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'PUBLISHED_VERSION_NOT_FOUND' });
    }

    const wordsFileId = normalizeIdentifier(versionDocument.words_file_id);
    const currentFileId = normalizeIdentifier(book.current_file_id);
    const expectedPath = buildVersionPath({
      teacherId: callerOpenid,
      wordbookId,
      version: requestedVersion
    });
    if (!wordsFileId
      || wordsFileId !== currentFileId
      || !fileIdMatchesPath(wordsFileId, expectedPath)) {
      return failure(ERROR_CODES.INTERNAL_ERROR, { reason: 'PUBLISHED_FILE_MISMATCH' });
    }

    const words = await downloadJson(wordsFileId);
    const expectedTotal = normalizeNumber(book.total_words, 0);
    if (expectedTotal < 1
      || expectedTotal !== normalizeNumber(versionDocument.total_words, 0)
      || !validatePublishedWords(words, wordbookId, expectedTotal)) {
      return failure(ERROR_CODES.INTERNAL_ERROR, { reason: 'PUBLISHED_WORDS_INVALID' });
    }

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      teacherId: callerOpenid,
      book: {
        ...toCatalogBook(book),
        words
      }
    };
  } catch (error) {
    console.error('[teacherWordbook] getPublished failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

// 历史导出专用只读入口：只按调用者身份 + 词书 ID + 明确版本读取。
// 不回退 currentVersion，也不修改既有 getPublished 的“仅当前活跃版本”契约。
const handleGetPublishedVersion = async (event) => {
  const callerOpenid = getCallerOpenid();
  if (!callerOpenid) return failure(ERROR_CODES.UNAUTHORIZED);

  try {
    const teacher = await findTeacher(callerOpenid);
    if (!teacher) return failure(ERROR_CODES.TEACHER_NOT_FOUND);

    const wordbookId = normalizeIdentifier(event && event.wordbookId);
    const requestedVersion = normalizeNumber(event && event.version, 0);
    if (!wordbookId || requestedVersion < 1) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'HISTORICAL_VERSION_REQUIRED' });
    }

    const book = await findOwnedWordbook(callerOpenid, wordbookId);
    if (!book || normalizeIdentifier(book.source_type) !== SOURCE_TYPE) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_NOT_FOUND' });
    }

    const versionDocument = await findPublishedVersion(
      callerOpenid,
      wordbookId,
      requestedVersion
    );
    if (!versionDocument
      || normalizeIdentifier(versionDocument.source_type) !== SOURCE_TYPE
      || normalizeIdentifier(versionDocument.status) !== TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED
      || normalizeNumber(versionDocument.version, 0) !== requestedVersion) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'PUBLISHED_VERSION_NOT_FOUND' });
    }

    const wordsFileId = normalizeIdentifier(versionDocument.words_file_id);
    const expectedPath = buildVersionPath({
      teacherId: callerOpenid,
      wordbookId,
      version: requestedVersion
    });
    if (!wordsFileId || !fileIdMatchesPath(wordsFileId, expectedPath)) {
      return failure(ERROR_CODES.INTERNAL_ERROR, { reason: 'PUBLISHED_FILE_MISMATCH' });
    }

    const words = await downloadJson(wordsFileId);
    const expectedTotal = normalizeNumber(versionDocument.total_words, 0);
    if (expectedTotal < 1 || !validatePublishedWords(words, wordbookId, expectedTotal)) {
      return failure(ERROR_CODES.INTERNAL_ERROR, { reason: 'PUBLISHED_WORDS_INVALID' });
    }

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      teacherId: callerOpenid,
      historicalVersion: true,
      book: {
        ...toCatalogBook(book),
        version: requestedVersion,
        totalWords: expectedTotal,
        words
      }
    };
  } catch (error) {
    console.error('[teacherWordbook] getPublishedVersion failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const handleCreateDraft = async (event) => {
  const callerOpenid = getCallerOpenid();

  if (!callerOpenid) {
    return failure(ERROR_CODES.UNAUTHORIZED);
  }

  try {
    const teacher = await findTeacher(callerOpenid);

    if (!teacher) {
      return failure(ERROR_CODES.TEACHER_NOT_FOUND);
    }

    const input = validateDraftInput(event);
    if (input.success === false) return input;

    const duplicateResult = await db.collection(COLLECTIONS.TEACHER_WORDBOOKS)
      .where({
        teacher_id: callerOpenid,
        name_key: input.nameKey
      })
      .limit(1)
      .get();
    const duplicateExists = duplicateResult
      && Array.isArray(duplicateResult.data)
      && duplicateResult.data.length > 0;

    if (duplicateExists) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'DUPLICATE_NAME' });
    }

    const now = db.serverDate();
    const draft = {
      teacher_id: callerOpenid,
      source_type: SOURCE_TYPE,
      wordbook_id: createWordbookId(),
      name: input.name,
      name_key: input.nameKey,
      category: input.category,
      description: input.description,
      version: 0,
      current_version_id: '',
      current_file_id: '',
      total_words: 0,
      status: TEACHER_WORDBOOK_STATUS.DRAFT,
      schema_version: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now
    };

    await db.collection(COLLECTIONS.TEACHER_WORDBOOKS).add({ data: draft });

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      book: toCatalogBook(draft)
    };
  } catch (error) {
    console.error('[teacherWordbook] createDraft failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const resolveOwnedDraft = async (event) => {
  const callerOpenid = getCallerOpenid();
  if (!callerOpenid) return { response: failure(ERROR_CODES.UNAUTHORIZED) };

  const teacher = await findTeacher(callerOpenid);
  if (!teacher) return { response: failure(ERROR_CODES.TEACHER_NOT_FOUND) };

  const wordbookId = normalizeIdentifier(event && event.wordbookId);
  if (!wordbookId) {
    return {
      response: failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_ID_REQUIRED' })
    };
  }

  const book = await findOwnedWordbook(callerOpenid, wordbookId);
  if (!book) {
    return {
      response: failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_NOT_FOUND' })
    };
  }

  return { callerOpenid, wordbookId, book };
};

const handlePrepareUpload = async (event) => {
  try {
    const context = await resolveOwnedDraft(event);
    if (context.response) return context.response;

    const operation = getUploadOperation(context.book);
    if (!operation) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPLOAD_NOT_ALLOWED' });
    }
    if (context.book.upload_state
      && context.book.upload_state.status === UPLOAD_STATUS.PUBLISHING) {
      return failure(ERROR_CODES.VERSION_CONFLICT, { reason: 'PUBLISH_IN_PROGRESS' });
    }

    const fileName = sanitizeFileName(event && event.fileName);
    const extension = getFileExtension(fileName);
    const fileSize = Number(event && event.fileSize);
    if (!fileName || !extension) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UNSUPPORTED_FILE_TYPE' });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > INPUT_LIMITS.FILE_BYTES) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'INVALID_FILE_SIZE' });
    }

    const uploadId = createUploadId();
    const publishToken = operation.operationType === UPLOAD_OPERATION_TYPE.INITIAL_PUBLISH
      ? uploadId
      : createPublishToken();
    const paths = buildUploadPaths({
      teacherId: context.callerOpenid,
      wordbookId: context.wordbookId,
      uploadId,
      extension
    });
    const sourceFileId = buildCloudFileId(paths.source);
    const authorization = createPresignedPut({ objectKey: paths.source });
    const uploadState = {
      upload_id: uploadId,
      status: UPLOAD_STATUS.CREATED,
      operation_type: operation.operationType,
      base_version: operation.baseVersion,
      target_version: operation.targetVersion,
      original_file_name: fileName,
      extension,
      file_size: fileSize,
      staging_path: paths.source,
      source_file_id: sourceFileId,
      authorization_issued_at: authorization.issuedAt,
      authorization_expires_at: authorization.expiresAt,
      valid_rows_file_id: '',
      error_report_file_id: '',
      total_rows: 0,
      valid_rows: 0,
      invalid_rows: 0,
      failure_reason: '',
      publish_token: publishToken,
      updated_at: db.serverDate()
    };

    await updateWordbook(context.book, {
      upload_state: uploadState,
      updatedAt: db.serverDate()
    });

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      upload: {
        uploadId,
        publishToken,
        status: UPLOAD_STATUS.CREATED,
        operationType: operation.operationType,
        baseVersion: operation.baseVersion,
        targetVersion: operation.targetVersion,
        maxBytes: INPUT_LIMITS.FILE_BYTES
      },
      transport: authorization.transport
    };
  } catch (error) {
    console.error('[teacherWordbook] prepareUpload failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const saveFailedPreview = async ({ context, uploadState, paths, error }) => {
  const errorEntry = {
    rowNumber: Number(error && error.rowNumber) || 1,
    reasonCode: 'INVALID_FORMAT',
    reasonText: error && error.reasonText ? error.reasonText : '格式错误'
  };
  let errorReportFileId = '';
  try {
    errorReportFileId = await uploadJson(paths.errorReport, {
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
      errors: [errorEntry]
    });
  } catch (storageError) {
    console.error('[teacherWordbook] failed to save parse error report:', storageError);
  }

  const failedState = {
    ...uploadState,
    status: UPLOAD_STATUS.FAILED,
    error_report_file_id: errorReportFileId,
    total_rows: 1,
    valid_rows: 0,
    invalid_rows: 1,
    failure_reason: 'INVALID_FORMAT',
    updated_at: db.serverDate()
  };
  await updateWordbook(context.book, {
    upload_state: failedState,
    updatedAt: db.serverDate()
  });
  return failure(ERROR_CODES.INVALID_ARGUMENT, {
    reason: 'INVALID_FORMAT',
    upload: toUploadSummary(failedState),
    summary: { totalRows: 1, validRows: 0, invalidRows: 1 },
    errors: [errorEntry]
  });
};

const saveUploadFailure = async ({ context, uploadState, reason }) => {
  const failedState = {
    ...uploadState,
    status: UPLOAD_STATUS.FAILED,
    failure_reason: reason,
    updated_at: db.serverDate()
  };
  await updateWordbook(context.book, {
    upload_state: failedState,
    updatedAt: db.serverDate()
  });
  return failure(ERROR_CODES.INVALID_ARGUMENT, {
    reason,
    upload: toUploadSummary(failedState)
  });
};

const handleParseUpload = async (event) => {
  try {
    const context = await resolveOwnedDraft(event);
    if (context.response) return context.response;

    const uploadId = normalizeIdentifier(event && event.uploadId);
    const uploadState = context.book.upload_state;
    if (!uploadState || uploadState.upload_id !== uploadId) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPLOAD_NOT_FOUND' });
    }
    if (!validateUploadOperation(context.book, uploadState)) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPLOAD_OPERATION_INVALID' });
    }

    const paths = buildUploadPaths({
      teacherId: context.callerOpenid,
      wordbookId: context.wordbookId,
      uploadId,
      extension: uploadState.extension
    });
    const expectedFileId = buildCloudFileId(paths.source);
    if (uploadState.staging_path !== paths.source
      || uploadState.source_file_id !== expectedFileId) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'INVALID_STAGING_FILE' });
    }
    if (uploadState.status === UPLOAD_STATUS.PREVIEW_READY) {
      return {
        success: true,
        schemaVersion: SCHEMA_VERSION,
        idempotent: true,
        upload: toUploadSummary(uploadState),
        summary: {
          totalRows: normalizeNumber(uploadState.total_rows, 0),
          validRows: normalizeNumber(uploadState.valid_rows, 0),
          invalidRows: normalizeNumber(uploadState.invalid_rows, 0)
        }
      };
    }
    if (![UPLOAD_STATUS.CREATED, UPLOAD_STATUS.UPLOADED, UPLOAD_STATUS.FAILED]
      .includes(uploadState.status)) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPLOAD_STATE_INVALID' });
    }

    let objectMetadata;
    try {
      objectMetadata = await headObject({ objectKey: paths.source });
    } catch (error) {
      const reason = error instanceof CosObjectNotFoundError
        ? 'STAGING_FILE_UNAVAILABLE'
        : 'STAGING_HEAD_FAILED';
      return saveUploadFailure({ context, uploadState, reason });
    }
    if (objectMetadata.size <= 0 || objectMetadata.size > INPUT_LIMITS.FILE_BYTES) {
      return saveUploadFailure({
        context,
        uploadState,
        reason: 'ACTUAL_FILE_SIZE_INVALID'
      });
    }
    if (objectMetadata.size !== normalizeNumber(uploadState.file_size, -1)) {
      return saveUploadFailure({ context, uploadState, reason: 'FILE_SIZE_MISMATCH' });
    }

    const uploadedState = {
      ...uploadState,
      status: UPLOAD_STATUS.UPLOADED,
      source_file_id: expectedFileId,
      object_size: objectMetadata.size,
      object_etag: objectMetadata.etag,
      failure_reason: '',
      updated_at: db.serverDate()
    };
    await updateWordbook(context.book, {
      upload_state: uploadedState,
      updatedAt: db.serverDate()
    });
    const parsingState = {
      ...uploadedState,
      status: UPLOAD_STATUS.PARSING,
      updated_at: db.serverDate()
    };
    await updateWordbook(context.book, {
      upload_state: parsingState,
      updatedAt: db.serverDate()
    });

    let fileContent;
    try {
      const downloaded = await cloud.downloadFile({ fileID: expectedFileId });
      fileContent = downloaded && downloaded.fileContent;
    } catch (error) {
      console.error('[teacherWordbook] staging download failed:', error);
      const failedState = {
        ...parsingState,
        status: UPLOAD_STATUS.FAILED,
        failure_reason: 'STAGING_FILE_UNAVAILABLE',
        updated_at: db.serverDate()
      };
      await updateWordbook(context.book, {
        upload_state: failedState,
        updatedAt: db.serverDate()
      });
      return failure(ERROR_CODES.INVALID_ARGUMENT, {
        reason: 'STAGING_FILE_UNAVAILABLE',
        upload: toUploadSummary(failedState)
      });
    }

    if (!Buffer.isBuffer(fileContent)) fileContent = Buffer.from(fileContent || '');
    if (fileContent.length !== objectMetadata.size) {
      return saveUploadFailure({
        context,
        uploadState: parsingState,
        reason: 'FILE_SIZE_MISMATCH'
      });
    }

    let parsed;
    try {
      parsed = await parseUploadBuffer({
        buffer: fileContent,
        extension: uploadState.extension,
        maxRows: DEFAULT_MAX_ROWS
      });
    } catch (error) {
      if (error instanceof UploadParseError) {
        return saveFailedPreview({ context, uploadState: parsingState, paths, error });
      }
      throw error;
    }

    const validRows = attachRowKeys(parsed.valid);
    const validRowsFileId = await uploadJson(paths.validRows, validRows);
    const errorReportFileId = await uploadJson(paths.errorReport, {
      totalRows: parsed.totalRows,
      validRows: parsed.validRows,
      invalidRows: parsed.invalidRows,
      errors: parsed.errors
    });
    const readyState = {
      ...parsingState,
      status: UPLOAD_STATUS.PREVIEW_READY,
      valid_rows_file_id: validRowsFileId,
      error_report_file_id: errorReportFileId,
      total_rows: parsed.totalRows,
      valid_rows: parsed.validRows,
      invalid_rows: parsed.invalidRows,
      failure_reason: '',
      updated_at: db.serverDate()
    };
    await updateWordbook(context.book, {
      upload_state: readyState,
      updatedAt: db.serverDate()
    });

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      upload: toUploadSummary(readyState),
      summary: {
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows
      }
    };
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return failure(ERROR_CODES.VERSION_CONFLICT, { reason: error.reason });
    }
    console.error('[teacherWordbook] parseUpload failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const handleGetPreview = async (event) => {
  try {
    const context = await resolveOwnedDraft(event);
    if (context.response) return context.response;

    const uploadId = normalizeIdentifier(event && event.uploadId);
    const uploadState = context.book.upload_state;
    if (!uploadState || uploadState.upload_id !== uploadId) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPLOAD_NOT_FOUND' });
    }
    if (!validateUploadOperation(context.book, uploadState)) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPLOAD_OPERATION_INVALID' });
    }
    if (uploadState.status !== UPLOAD_STATUS.PREVIEW_READY) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, {
        reason: 'PREVIEW_NOT_READY',
        upload: toUploadSummary(uploadState)
      });
    }

    const [validRows, errorReport] = await Promise.all([
      downloadJson(uploadState.valid_rows_file_id),
      downloadJson(uploadState.error_report_file_id)
    ]);
    const errors = errorReport && Array.isArray(errorReport.errors)
      ? errorReport.errors
      : [];

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      upload: toUploadSummary(uploadState),
      summary: {
        totalRows: normalizeNumber(uploadState.total_rows, 0),
        validRows: normalizeNumber(uploadState.valid_rows, 0),
        invalidRows: normalizeNumber(uploadState.invalid_rows, 0)
      },
      validPreview: Array.isArray(validRows)
        ? validRows.slice(0, INPUT_LIMITS.PREVIEW_VALID).map((entry) => ({
          word: normalizeDisplayText(entry && entry.word),
          meaning: normalizeDisplayText(entry && entry.meaning),
          phonetic: normalizeDisplayText(entry && entry.phonetic)
        }))
        : [],
      errorPreview: errors.slice(0, INPUT_LIMITS.PREVIEW_ERRORS)
    };
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return failure(ERROR_CODES.VERSION_CONFLICT, { reason: error.reason });
    }
    console.error('[teacherWordbook] getPreview failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const activatePublishedBook = async ({ book, uploadState, versionId, wordsFileId, totalWords }) => {
  const publishedState = {
    ...uploadState,
    status: UPLOAD_STATUS.PUBLISHED,
    failure_reason: '',
    updated_at: db.serverDate()
  };
  await updateWordbook(book, {
    status: TEACHER_WORDBOOK_STATUS.ACTIVE,
    version: 1,
    total_words: totalWords,
    current_version_id: versionId,
    current_file_id: wordsFileId,
    upload_state: publishedState,
    updatedAt: db.serverDate()
  });
  return publishedState;
};

const handlePublish = async (event) => {
  try {
    const context = await resolveOwnedDraft(event);
    if (context.response) return context.response;
    if (!event || event.confirmed !== true) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'CONFIRMATION_REQUIRED' });
    }

    const uploadId = normalizeIdentifier(event.uploadId);
    const uploadState = context.book.upload_state;
    if (!uploadState || uploadState.upload_id !== uploadId) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPLOAD_NOT_FOUND' });
    }
    const publishToken = normalizeIdentifier(uploadState.publish_token) || uploadId;

    const version = 1;
    const versionId = createVersionId(context.wordbookId, version);
    const existingVersion = await findPublishedVersion(
      context.callerOpenid,
      context.wordbookId,
      version
    );
    if (existingVersion) {
      if (existingVersion.publish_token !== publishToken) {
        return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'VERSION_ALREADY_PUBLISHED' });
      }
      const publishedState = await activatePublishedBook({
        book: context.book,
        uploadState,
        versionId,
        wordsFileId: existingVersion.words_file_id,
        totalWords: existingVersion.total_words
      });
      return {
        success: true,
        schemaVersion: SCHEMA_VERSION,
        idempotent: true,
        version: {
          versionId,
          version,
          totalWords: existingVersion.total_words,
          status: TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED
        },
        upload: toUploadSummary(publishedState)
      };
    }

    if (!validateUploadOperation(context.book, uploadState)) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'INITIAL_PUBLISH_REQUIRED' });
    }

    if (uploadState.status !== UPLOAD_STATUS.PREVIEW_READY) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'PREVIEW_NOT_READY' });
    }
    const validCount = normalizeNumber(uploadState.valid_rows, 0);
    if (validCount < 1) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'NO_VALID_ROWS' });
    }

    const validRows = await downloadJson(uploadState.valid_rows_file_id);
    if (!Array.isArray(validRows) || validRows.length !== validCount) {
      return failure(ERROR_CODES.INTERNAL_ERROR, { reason: 'PREVIEW_DATA_MISMATCH' });
    }
    const words = matchWordIds({
      wordbookId: context.wordbookId,
      previousWords: [],
      nextRows: validRows,
      publishToken
    });
    const versionPath = buildVersionPath({
      teacherId: context.callerOpenid,
      wordbookId: context.wordbookId,
      version
    });
    const wordsFileId = await uploadJson(versionPath, words);
    const now = db.serverDate();
    const versionDocument = {
      teacher_id: context.callerOpenid,
      source_type: SOURCE_TYPE,
      wordbook_id: context.wordbookId,
      version_id: versionId,
      version,
      status: TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED,
      upload_id: uploadId,
      publish_token: publishToken,
      words_file_id: wordsFileId,
      total_words: words.length,
      schema_version: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now
    };
    await db.collection(COLLECTIONS.TEACHER_WORDBOOK_VERSIONS)
      .doc(versionId)
      .set({ data: versionDocument });
    const publishedState = await activatePublishedBook({
      book: context.book,
      uploadState,
      versionId,
      wordsFileId,
      totalWords: words.length
    });

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      idempotent: false,
      version: {
        versionId,
        version,
        totalWords: words.length,
        status: TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED
      },
      upload: toUploadSummary(publishedState)
    };
  } catch (error) {
    console.error('[teacherWordbook] publish failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

const toVersionResult = (versionDocument) => ({
  versionId: normalizeIdentifier(versionDocument && versionDocument.version_id),
  version: normalizeNumber(versionDocument && versionDocument.version, 0),
  previousVersion: normalizeNumber(versionDocument && versionDocument.previous_version, 0),
  totalWords: normalizeNumber(versionDocument && versionDocument.total_words, 0),
  status: normalizeIdentifier(versionDocument && versionDocument.status)
});

const restoreVersionUpdatePreview = async ({ bookId, uploadId, publishToken, baseVersion, reason }) => {
  try {
    await db.runTransaction(async (transaction) => {
      const reference = transaction.collection(COLLECTIONS.TEACHER_WORDBOOKS).doc(bookId);
      const liveBook = getDocumentData(await reference.get());
      const liveState = liveBook && liveBook.upload_state;
      if (!liveBook
        || normalizeNumber(liveBook.version, 0) !== baseVersion
        || !liveState
        || liveState.upload_id !== uploadId
        || liveState.publish_token !== publishToken
        || liveState.status !== UPLOAD_STATUS.PUBLISHING) {
        return;
      }
      await reference.update({
        data: {
          upload_state: {
            ...liveState,
            status: UPLOAD_STATUS.PREVIEW_READY,
            failure_reason: reason,
            updated_at: db.serverDate()
          },
          updatedAt: db.serverDate()
        }
      });
    });
  } catch (error) {
    console.error('[teacherWordbook] failed to restore version preview state:', error);
  }
};

const reserveVersionUpdate = async ({ context, uploadId, publishToken }) => (
  db.runTransaction(async (transaction) => {
    const reference = transaction.collection(COLLECTIONS.TEACHER_WORDBOOKS)
      .doc(context.book._id);
    const liveBook = getDocumentData(await reference.get());
    const liveState = liveBook && liveBook.upload_state;
    if (!liveBook
      || liveBook.teacher_id !== context.callerOpenid
      || liveBook.wordbook_id !== context.wordbookId
      || liveBook.source_type !== SOURCE_TYPE
      || liveBook.status !== TEACHER_WORDBOOK_STATUS.ACTIVE) {
      throw new VersionConflictError('ACTIVE_WORDBOOK_CHANGED');
    }
    if (!liveState
      || liveState.operation_type !== UPLOAD_OPERATION_TYPE.VERSION_UPDATE
      || liveState.upload_id !== uploadId
      || liveState.publish_token !== publishToken) {
      throw new VersionConflictError('UPDATE_TASK_CHANGED');
    }

    const baseVersion = normalizeNumber(liveState.base_version, 0);
    const targetVersion = normalizeNumber(liveState.target_version, 0);
    if (baseVersion < 1
      || targetVersion !== baseVersion + 1
      || normalizeNumber(liveBook.version, 0) !== baseVersion) {
      throw new VersionConflictError('BASE_VERSION_CHANGED');
    }
    if (![UPLOAD_STATUS.PREVIEW_READY, UPLOAD_STATUS.PUBLISHING].includes(liveState.status)) {
      throw new VersionConflictError('UPDATE_TASK_NOT_READY');
    }

    const publishingState = {
      ...liveState,
      status: UPLOAD_STATUS.PUBLISHING,
      failure_reason: '',
      updated_at: db.serverDate()
    };
    await reference.update({
      data: {
        upload_state: publishingState,
        updatedAt: db.serverDate()
      }
    });
    return { book: liveBook, uploadState: publishingState, baseVersion, targetVersion };
  })
);

const commitVersionUpdate = async ({
  context,
  uploadId,
  publishToken,
  baseVersion,
  targetVersion,
  wordsFileId,
  words
}) => db.runTransaction(async (transaction) => {
  const bookReference = transaction.collection(COLLECTIONS.TEACHER_WORDBOOKS)
    .doc(context.book._id);
  const liveBook = getDocumentData(await bookReference.get());
  const versionId = createVersionId(context.wordbookId, targetVersion);
  const versionReference = transaction.collection(COLLECTIONS.TEACHER_WORDBOOK_VERSIONS)
    .doc(versionId);

  if (liveBook && normalizeNumber(liveBook.version, 0) === targetVersion) {
    const existing = await getOptionalTransactionDocument(versionReference);
    if (existing
      && existing.upload_id === uploadId
      && existing.publish_token === publishToken
      && existing.words_file_id === wordsFileId) {
      return { versionDocument: existing, idempotent: true };
    }
    throw new VersionConflictError('TARGET_VERSION_ALREADY_PUBLISHED');
  }

  const liveState = liveBook && liveBook.upload_state;
  if (!liveBook
    || liveBook.teacher_id !== context.callerOpenid
    || liveBook.wordbook_id !== context.wordbookId
    || liveBook.source_type !== SOURCE_TYPE
    || liveBook.status !== TEACHER_WORDBOOK_STATUS.ACTIVE
    || normalizeNumber(liveBook.version, 0) !== baseVersion
    || !liveState
    || liveState.status !== UPLOAD_STATUS.PUBLISHING
    || liveState.operation_type !== UPLOAD_OPERATION_TYPE.VERSION_UPDATE
    || liveState.upload_id !== uploadId
    || liveState.publish_token !== publishToken
    || normalizeNumber(liveState.base_version, 0) !== baseVersion
    || normalizeNumber(liveState.target_version, 0) !== targetVersion) {
    throw new VersionConflictError('PUBLISH_RESERVATION_LOST');
  }

  const existingVersion = await getOptionalTransactionDocument(versionReference);
  if (existingVersion) throw new VersionConflictError('TARGET_VERSION_ALREADY_PUBLISHED');

  const now = db.serverDate();
  const versionDocument = {
    teacher_id: context.callerOpenid,
    source_type: SOURCE_TYPE,
    wordbook_id: context.wordbookId,
    version_id: versionId,
    version: targetVersion,
    previous_version: baseVersion,
    status: TEACHER_WORDBOOK_VERSION_STATUS.PUBLISHED,
    upload_id: uploadId,
    publish_token: publishToken,
    words_file_id: wordsFileId,
    total_words: words.length,
    schema_version: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };
  const publishedState = {
    ...liveState,
    status: UPLOAD_STATUS.PUBLISHED,
    failure_reason: '',
    updated_at: now
  };

  await versionReference.set({ data: versionDocument });
  await bookReference.update({
    data: {
      version: targetVersion,
      current_version_id: versionId,
      current_file_id: wordsFileId,
      total_words: words.length,
      upload_state: publishedState,
      updatedAt: now
    }
  });
  return { versionDocument, idempotent: false };
});

const handleUpdateVersion = async (event) => {
  const callerOpenid = getCallerOpenid();
  if (!callerOpenid) return failure(ERROR_CODES.UNAUTHORIZED);

  try {
    const teacher = await findTeacher(callerOpenid);
    if (!teacher) return failure(ERROR_CODES.TEACHER_NOT_FOUND);

    const wordbookId = normalizeIdentifier(event && event.wordbookId);
    const uploadId = normalizeIdentifier(event && event.uploadId);
    const publishToken = normalizeIdentifier(event && event.publishToken);
    if (!wordbookId || !uploadId || !publishToken) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'UPDATE_ARGUMENTS_REQUIRED' });
    }

    const book = await findOwnedWordbook(callerOpenid, wordbookId);
    if (!book) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'WORDBOOK_NOT_FOUND' });
    }

    const existingVersion = await findPublishedVersionByToken(
      callerOpenid,
      wordbookId,
      uploadId,
      publishToken
    );
    if (existingVersion) {
      return {
        success: true,
        schemaVersion: SCHEMA_VERSION,
        idempotent: true,
        version: toVersionResult(existingVersion),
        upload: toUploadSummary(book.upload_state)
      };
    }

    if (book.source_type !== SOURCE_TYPE
      || book.status !== TEACHER_WORDBOOK_STATUS.ACTIVE
      || normalizeNumber(book.version, 0) < 1) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'ACTIVE_WORDBOOK_REQUIRED' });
    }

    const uploadState = book.upload_state;
    if (!uploadState
      || uploadState.operation_type !== UPLOAD_OPERATION_TYPE.VERSION_UPDATE) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'VERSION_UPDATE_REQUIRED' });
    }
    if (uploadState.upload_id !== uploadId || uploadState.publish_token !== publishToken) {
      return failure(ERROR_CODES.VERSION_CONFLICT, { reason: 'UPDATE_TASK_CHANGED' });
    }
    if (![UPLOAD_STATUS.PREVIEW_READY, UPLOAD_STATUS.PUBLISHING].includes(uploadState.status)) {
      return failure(ERROR_CODES.INVALID_ARGUMENT, { reason: 'PREVIEW_NOT_READY' });
    }

    const context = { callerOpenid, wordbookId, book };
    const reservation = await reserveVersionUpdate({ context, uploadId, publishToken });
    const { baseVersion, targetVersion } = reservation;

    let wordsFileId;
    let words;
    try {
      const historicalVersionDocuments = await listEarlierPublishedVersions(
        callerOpenid,
        wordbookId,
        baseVersion
      );
      const [previousWords, nextRows, historicalWordSets] = await Promise.all([
        downloadJson(reservation.book.current_file_id),
        downloadJson(reservation.uploadState.valid_rows_file_id),
        Promise.all(historicalVersionDocuments.map((version) => downloadJson(version.words_file_id)))
      ]);
      const expectedPreviousTotal = normalizeNumber(reservation.book.total_words, 0);
      const expectedPreviousPath = buildVersionPath({
        teacherId: callerOpenid,
        wordbookId,
        version: baseVersion
      });
      if (!fileIdMatchesPath(reservation.book.current_file_id, expectedPreviousPath)
        || !validatePublishedWords(previousWords, wordbookId, expectedPreviousTotal)
        || !Array.isArray(nextRows)
        || historicalVersionDocuments.some((version, index) => {
          const versionNumber = normalizeNumber(version.version, 0);
          const expectedPath = buildVersionPath({
            teacherId: callerOpenid,
            wordbookId,
            version: versionNumber
          });
          return !fileIdMatchesPath(version.words_file_id, expectedPath)
            || !validatePublishedWords(
              historicalWordSets[index],
              wordbookId,
              normalizeNumber(version.total_words, -1)
            );
        })
        || nextRows.length !== normalizeNumber(reservation.uploadState.valid_rows, 0)
        || nextRows.length < 1) {
        throw new Error('VERSION_SOURCE_INVALID');
      }

      words = matchWordIds({
        wordbookId,
        previousWords,
        historicalWordSets,
        nextRows,
        publishToken
      });
      const versionPath = buildVersionPath({
        teacherId: callerOpenid,
        wordbookId,
        version: targetVersion
      });
      wordsFileId = await uploadJson(versionPath, words);
      if (!wordsFileId || !fileIdMatchesPath(wordsFileId, versionPath)) {
        throw new Error('VERSION_FILE_ID_INVALID');
      }
      const verifiedWords = await downloadJson(wordsFileId);
      if (!validatePublishedWords(verifiedWords, wordbookId, words.length)) {
        throw new Error('VERSION_FILE_VALIDATION_FAILED');
      }
    } catch (error) {
      console.error('[teacherWordbook] version storage preparation failed:', error);
      await restoreVersionUpdatePreview({
        bookId: book._id,
        uploadId,
        publishToken,
        baseVersion,
        reason: 'VERSION_STORAGE_FAILED'
      });
      return failure(ERROR_CODES.INTERNAL_ERROR, { reason: 'VERSION_STORAGE_FAILED' });
    }

    let committed;
    try {
      committed = await commitVersionUpdate({
        context,
        uploadId,
        publishToken,
        baseVersion,
        targetVersion,
        wordsFileId,
        words
      });
    } catch (error) {
      await restoreVersionUpdatePreview({
        bookId: book._id,
        uploadId,
        publishToken,
        baseVersion,
        reason: 'VERSION_COMMIT_FAILED'
      });
      if (error instanceof VersionConflictError) {
        return failure(ERROR_CODES.VERSION_CONFLICT, { reason: error.reason });
      }
      console.error('[teacherWordbook] version commit failed:', error);
      return failure(ERROR_CODES.INTERNAL_ERROR, { reason: 'VERSION_COMMIT_FAILED' });
    }

    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      idempotent: committed.idempotent,
      version: toVersionResult(committed.versionDocument),
      upload: {
        ...toUploadSummary(reservation.uploadState),
        status: UPLOAD_STATUS.PUBLISHED
      }
    };
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return failure(ERROR_CODES.VERSION_CONFLICT, { reason: error.reason });
    }
    console.error('[teacherWordbook] updateVersion failed:', error);
    return failure(ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.main = async (event) => {
  const action = normalizeIdentifier(event && event.action);

  if (action === 'capabilities') {
    return {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      features: FEATURES.slice()
    };
  }

  if (action === 'health') {
    return handleHealth();
  }

  if (action === 'list') {
    return handleList(event);
  }

  if (action === 'disable') {
    return handleDisable(event);
  }

  if (action === 'getPublished') {
    return handleGetPublished(event);
  }

  if (action === 'getPublishedVersion') {
    return handleGetPublishedVersion(event);
  }

  if (action === 'createDraft') {
    return handleCreateDraft(event);
  }

  if (action === 'prepareUpload') {
    return handlePrepareUpload(event);
  }

  if (action === 'parseUpload') {
    return handleParseUpload(event);
  }

  if (action === 'getPreview') {
    return handleGetPreview(event);
  }

  if (action === 'publish') {
    return handlePublish(event);
  }

  if (action === 'updateVersion') {
    return handleUpdateVersion(event);
  }

  return failure(ERROR_CODES.INVALID_ACTION);
};
