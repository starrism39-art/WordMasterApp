'use strict';

const {
  EXPORT_RESOLUTION_STATES,
  findOriginalRecordById,
  resolveRecordExportSnapshot
} = require('../../../utils/record-export-contract.js');
const {
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  buildRecordExportFilename,
  createExportError,
  filterWordsForExport
} = require('../../../utils/local-record-export.js');
const { generateLocalExportPdf } = require('./pdf-generator.js');
const { generateLocalExportXlsx } = require('./xlsx-generator.js');

const FONT_PATHS = Object.freeze({
  chinese: 'subpages/records/export/assets/WordMasterExportSans-Regular.ttf.br',
  ipa: 'subpages/records/export/assets/WordMasterExportSans-IPA-Regular.ttf.br'
});

let fontCache = null;

const normalizeBytes = (value) => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw createExportError('UNSUPPORTED_BINARY_VALUE', '文件生成失败');
};

const toExactArrayBuffer = (value) => {
  const bytes = normalizeBytes(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const loadFonts = (platform) => {
  if (fontCache) return fontCache;
  const fs = platform.getFileSystemManager();
  fontCache = Object.freeze({
    chineseFontBytes: normalizeBytes(fs.readCompressedFileSync({
      filePath: FONT_PATHS.chinese,
      compressionAlgorithm: 'br'
    })),
    ipaFontBytes: normalizeBytes(fs.readCompressedFileSync({
      filePath: FONT_PATHS.ipa,
      compressionAlgorithm: 'br'
    }))
  });
  return fontCache;
};

const getBlockedMessage = (resolution) => {
  if (resolution && resolution.state === EXPORT_RESOLUTION_STATES.BLOCKED) {
    return '该历史记录缺少完整词条数据，无法完整导出';
  }
  if (resolution && resolution.state === EXPORT_RESOLUTION_STATES.HISTORICAL_VERSION_UNAVAILABLE) {
    return '该记录的精确历史词书版本暂时无法读取';
  }
  return '该记录暂时无法导出';
};

const prepareRecordExport = async ({
  recordId,
  records,
  scope = EXPORT_SCOPES.ALL,
  format,
  currentStudent,
  allowPartial = false,
  loadHistoricalWordbook
} = {}) => {
  const rawRecord = findOriginalRecordById(recordId, records);
  const resolution = await resolveRecordExportSnapshot(rawRecord, {
    currentStudent,
    loadHistoricalWordbook
  });

  if (
    resolution.state === EXPORT_RESOLUTION_STATES.BLOCKED
    || resolution.state === EXPORT_RESOLUTION_STATES.HISTORICAL_VERSION_REQUIRED
    || resolution.state === EXPORT_RESOLUTION_STATES.HISTORICAL_VERSION_UNAVAILABLE
  ) {
    throw createExportError('RECORD_EXPORT_BLOCKED', getBlockedMessage(resolution));
  }
  if (resolution.state === EXPORT_RESOLUTION_STATES.PARTIAL && !allowPartial) {
    const error = createExportError(
      'PARTIAL_EXPORT_CONFIRMATION_REQUIRED',
      '该记录属于历史兼容记录，部分历史字段不可保证'
    );
    error.resolution = resolution;
    throw error;
  }

  const wordsSnapshot = filterWordsForExport(resolution.snapshot, scope);
  if (wordsSnapshot.length === 0) {
    throw createExportError('EMPTY_EXPORT_SCOPE', '该范围没有可导出的单词');
  }

  const studentName = resolution.display.studentName.value || '学生';
  const wordbookTitle = resolution.display.wordbookTitle.value || '词书';
  const filename = buildRecordExportFilename({
    studentName,
    wordbookTitle,
    recordKind: resolution.recordKind,
    scope,
    completedAt: resolution.snapshot.completedAt,
    extension: format
  });

  return Object.freeze({
    rawRecord,
    resolution,
    scope,
    format,
    studentName,
    wordbookTitle,
    wordsSnapshot: Object.freeze(wordsSnapshot.slice()),
    filename,
    isPartial: resolution.state === EXPORT_RESOLUTION_STATES.PARTIAL
  });
};

const openDocument = (platform, filePath, format) => new Promise((resolve, reject) => {
  platform.openDocument({
    filePath,
    fileType: format,
    showMenu: true,
    success: () => resolve({ filePath, format, showMenu: true }),
    fail: reject
  });
});

const generateAndOpenRecordExport = async (options = {}, dependencies = {}) => {
  const platform = dependencies.platform || wx;
  const prepared = await prepareRecordExport(options);
  const generatePdf = dependencies.generatePdf || generateLocalExportPdf;
  const generateXlsx = dependencies.generateXlsx || generateLocalExportXlsx;
  let generated;

  if (prepared.format === EXPORT_FORMATS.PDF) {
    const fonts = dependencies.fonts || loadFonts(platform);
    generated = generatePdf({
      studentName: prepared.studentName,
      wordbookTitle: prepared.wordbookTitle,
      completedAt: prepared.resolution.snapshot.completedAt,
      wordsSnapshot: prepared.wordsSnapshot,
      chineseFontBytes: fonts.chineseFontBytes,
      ipaFontBytes: fonts.ipaFontBytes
    });
  } else if (prepared.format === EXPORT_FORMATS.XLSX) {
    generated = generateXlsx({
      wordsSnapshot: prepared.wordsSnapshot,
      createdAt: new Date()
    });
  } else {
    throw createExportError('UNSUPPORTED_EXPORT_FORMAT', '不支持的导出格式');
  }

  const filePath = `${platform.env.USER_DATA_PATH}/${prepared.filename}`;
  platform.getFileSystemManager().writeFileSync(filePath, toExactArrayBuffer(generated.bytes));
  const openResult = await openDocument(platform, filePath, prepared.format);
  return Object.freeze({
    ...prepared,
    filePath,
    fileBytes: generated.bytes.length,
    pageCount: generated.pageCount || null,
    rowCount: generated.rowCount || null,
    openResult
  });
};

module.exports = {
  FONT_PATHS,
  generateAndOpenRecordExport,
  getBlockedMessage,
  loadFonts,
  openDocument,
  prepareRecordExport,
  toExactArrayBuffer
};
