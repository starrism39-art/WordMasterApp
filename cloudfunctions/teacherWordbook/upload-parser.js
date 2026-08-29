'use strict';

const DEFAULT_MAX_ROWS = 10000;
const SPREADSHEETML_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const WORKBOOK_XML_PATH = 'xl/workbook.xml';

const HEADER_ALIASES = Object.freeze({
  word: Object.freeze(['word', '单词']),
  meaning: Object.freeze(['meaning', '释义', '中文释义', '中文']),
  phonetic: Object.freeze(['phonetic', '音标'])
});

const REASON_TEXT = Object.freeze({
  MISSING_WORD: '缺少单词',
  MISSING_MEANING: '缺少释义',
  DUPLICATE_WORD: '规范化后单词重复',
  INVALID_FORMAT: '格式错误'
});

class UploadParseError extends Error {
  constructor(reasonCode, reasonText, rowNumber = 1) {
    super(reasonText || REASON_TEXT[reasonCode] || reasonCode);
    this.name = 'UploadParseError';
    this.reasonCode = reasonCode;
    this.reasonText = reasonText || REASON_TEXT[reasonCode] || reasonCode;
    this.rowNumber = rowNumber;
  }
}

const normalizeHeader = (value) => (
  String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
);

const normalizeWordIdentity = (value) => (
  String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
);

const normalizeCell = (value) => {
  if (value === undefined || value === null) return { text: '', invalid: false };
  if (typeof value === 'string') return { text: value.trim(), invalid: false };
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { text: String(value).trim(), invalid: false };
  }
  if (value instanceof Date) return { text: value.toISOString(), invalid: false };

  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return normalizeCell(value.result);
    }
    if (Array.isArray(value.richText)) {
      return {
        text: value.richText.map((part) => String(part && part.text || '')).join('').trim(),
        invalid: false
      };
    }
    if (typeof value.text === 'string') {
      return { text: value.text.trim(), invalid: false };
    }
  }

  return { text: '', invalid: true };
};

const decodeUtf8 = (buffer) => {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(buffer)
      .replace(/^\uFEFF/, '');
  } catch (error) {
    throw new UploadParseError('INVALID_FORMAT', 'CSV必须使用UTF-8编码');
  }
};

const parseCsvRecords = (buffer) => {
  const text = decodeUtf8(buffer);
  if (!text.trim()) throw new UploadParseError('INVALID_FORMAT', '文件为空');

  const records = [];
  let cells = [];
  let field = '';
  let inQuotes = false;
  let afterQuote = false;
  let lineNumber = 1;
  let recordStartLine = 1;

  const pushRecord = () => {
    cells.push(field);
    records.push({ rowNumber: recordStartLine, cells });
    cells = [];
    field = '';
    afterQuote = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        field += char;
        if (char === '\n') lineNumber += 1;
      }
      continue;
    }

    if (afterQuote && char !== ',' && char !== '\r' && char !== '\n' && !/\s/.test(char)) {
      throw new UploadParseError('INVALID_FORMAT', 'CSV引号后的格式无效', recordStartLine);
    }

    if (char === '"') {
      if (field.trim()) {
        throw new UploadParseError('INVALID_FORMAT', 'CSV引号位置无效', recordStartLine);
      }
      inQuotes = true;
      afterQuote = false;
    } else if (char === ',') {
      cells.push(field);
      field = '';
      afterQuote = false;
    } else if (char === '\r' && next === '\n') {
      pushRecord();
      index += 1;
      lineNumber += 1;
      recordStartLine = lineNumber;
    } else if (char === '\n' || char === '\r') {
      pushRecord();
      lineNumber += 1;
      recordStartLine = lineNumber;
    } else if (!afterQuote || !/\s/.test(char)) {
      field += char;
    }
  }

  if (inQuotes) {
    throw new UploadParseError('INVALID_FORMAT', 'CSV存在未闭合引号', recordStartLine);
  }
  if (cells.length > 0 || field.length > 0 || records.length === 0) pushRecord();
  return records;
};

const getHeaderMap = (record) => {
  const map = {};
  record.cells.forEach((cell, index) => {
    const normalized = normalizeHeader(normalizeCell(cell).text);
    Object.keys(HEADER_ALIASES).forEach((field) => {
      if (!HEADER_ALIASES[field].includes(normalized)) return;
      if (map[field] !== undefined) {
        throw new UploadParseError('INVALID_FORMAT', `表头${field}重复`, record.rowNumber);
      }
      map[field] = index;
    });
  });

  if (map.word === undefined || map.meaning === undefined) {
    throw new UploadParseError(
      'INVALID_FORMAT',
      '必须包含word/单词和meaning/释义表头',
      record.rowNumber
    );
  }
  return map;
};

const validateRecords = (records, { maxRows = DEFAULT_MAX_ROWS } = {}) => {
  const headerIndex = records.findIndex((record) => record.cells.some((cell) => (
    normalizeCell(cell).text !== ''
  )));
  if (headerIndex < 0) throw new UploadParseError('INVALID_FORMAT', '文件为空');

  const header = records[headerIndex];
  const headerMap = getHeaderMap(header);
  const valid = [];
  const candidates = [];
  const errors = [];
  let totalRows = 0;

  records.slice(headerIndex + 1).forEach((record) => {
    const normalizedCells = record.cells.map(normalizeCell);
    if (normalizedCells.every((cell) => !cell.text && !cell.invalid)) return;

    totalRows += 1;
    if (totalRows > maxRows) {
      throw new UploadParseError('INVALID_FORMAT', `数据行不能超过${maxRows}行`, record.rowNumber);
    }

    const wordCell = normalizedCells[headerMap.word] || { text: '', invalid: false };
    const meaningCell = normalizedCells[headerMap.meaning] || { text: '', invalid: false };
    const phoneticCell = headerMap.phonetic === undefined
      ? { text: '', invalid: false }
      : (normalizedCells[headerMap.phonetic] || { text: '', invalid: false });

    let reasonCode = '';
    if (wordCell.invalid || meaningCell.invalid || phoneticCell.invalid) {
      reasonCode = 'INVALID_FORMAT';
    } else if (!wordCell.text) {
      reasonCode = 'MISSING_WORD';
    } else if (!meaningCell.text) {
      reasonCode = 'MISSING_MEANING';
    }

    if (reasonCode) {
      errors.push({
        rowNumber: record.rowNumber,
        reasonCode,
        reasonText: REASON_TEXT[reasonCode]
      });
      return;
    }

    candidates.push({
      rowNumber: record.rowNumber,
      normalizedWord: normalizeWordIdentity(wordCell.text),
      word: wordCell.text,
      meaning: meaningCell.text,
      phonetic: phoneticCell.text || ''
    });
  });

  const rowsByWord = new Map();
  candidates.forEach((candidate) => {
    const rows = rowsByWord.get(candidate.normalizedWord) || [];
    rows.push(candidate.rowNumber);
    rowsByWord.set(candidate.normalizedWord, rows);
  });
  candidates.forEach((candidate) => {
    const duplicateRows = rowsByWord.get(candidate.normalizedWord) || [];
    if (duplicateRows.length > 1) {
      errors.push({
        rowNumber: candidate.rowNumber,
        reasonCode: 'DUPLICATE_WORD',
        reasonText: `规范化后单词重复（重复行：${duplicateRows.join('、')}）`
      });
      return;
    }
    valid.push({
      word: candidate.word,
      meaning: candidate.meaning,
      phonetic: candidate.phonetic
    });
  });
  errors.sort((left, right) => left.rowNumber - right.rowNumber);

  return {
    totalRows,
    validRows: valid.length,
    invalidRows: errors.length,
    valid,
    errors
  };
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const spreadsheetMlPrefixes = (xml) => {
  const prefixes = [];
  const namespacePattern = /\sxmlns:([A-Za-z_][\w.-]*)=(["'])([^"']+)\2/g;
  let match;
  while ((match = namespacePattern.exec(xml))) {
    if (match[3] === SPREADSHEETML_NAMESPACE) prefixes.push(match[1]);
  }
  return prefixes;
};

const normalizeSpreadsheetMlElementQNames = (xml) => {
  let normalized = xml;
  spreadsheetMlPrefixes(xml).forEach((prefix) => {
    const elementQName = new RegExp(
      `(<\\/?)(?:${escapeRegExp(prefix)}):([A-Za-z_][\\w.-]*)(?=[\\s/>])`,
      'g'
    );
    normalized = normalized.replace(elementQName, '$1$2');
  });
  return normalized;
};

const isSpreadsheetMlQNameLoadError = (error) => (
  error instanceof TypeError
  && /Cannot read properties of undefined \(reading ['"]sheets['"]\)/.test(String(error.message || ''))
);

const createQNameCompatibleXlsxBuffer = async (buffer, JSZip) => {
  const archive = await JSZip.loadAsync(buffer);
  const workbookEntry = archive.file(WORKBOOK_XML_PATH);
  if (!workbookEntry) return null;

  const workbookXml = await workbookEntry.async('string');
  const workbookHasPrefixedRoot = spreadsheetMlPrefixes(workbookXml).some((prefix) => (
    new RegExp(`<${escapeRegExp(prefix)}:workbook(?=[\\s/>])`).test(workbookXml)
  ));
  if (!workbookHasPrefixedRoot) return null;

  let changedEntries = 0;
  const xmlPaths = Object.keys(archive.files).filter((entryPath) => (
    /^xl\/.*\.xml$/i.test(entryPath) && !archive.files[entryPath].dir
  ));
  await Promise.all(xmlPaths.map(async (entryPath) => {
    const entry = archive.file(entryPath);
    if (!entry) return;
    const xml = await entry.async('string');
    const normalized = normalizeSpreadsheetMlElementQNames(xml);
    if (normalized === xml) return;
    archive.file(entryPath, normalized);
    changedEntries += 1;
  }));
  if (!changedEntries) return null;

  return archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const loadXlsxWorkbook = async (buffer, ExcelJS) => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch (initialError) {
    if (!isSpreadsheetMlQNameLoadError(initialError)) throw initialError;

    let compatibleBuffer;
    try {
      compatibleBuffer = await createQNameCompatibleXlsxBuffer(buffer, require('jszip'));
    } catch (fallbackPreparationError) {
      throw initialError;
    }
    if (!compatibleBuffer) throw initialError;

    const compatibleWorkbook = new ExcelJS.Workbook();
    await compatibleWorkbook.xlsx.load(compatibleBuffer, { ignoreNodes: ['tableParts'] });
    return compatibleWorkbook;
  }
};

const parseXlsxRecords = async (buffer, ExcelJS) => {
  let workbook;
  try {
    workbook = await loadXlsxWorkbook(buffer, ExcelJS);
  } catch (error) {
    throw new UploadParseError('INVALID_FORMAT', 'XLSX文件无法解析');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new UploadParseError('INVALID_FORMAT', 'XLSX没有工作表');

  const records = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells = [];
    for (let column = 1; column <= Math.max(row.cellCount, 1); column += 1) {
      cells.push(row.getCell(column).value);
    }
    records.push({ rowNumber, cells });
  });
  return records;
};

const parseUploadBuffer = async ({ buffer, extension, maxRows, ExcelJS }) => {
  const normalizedExtension = String(extension || '').toLowerCase();
  let records;

  if (normalizedExtension === 'csv') {
    records = parseCsvRecords(buffer);
  } else if (normalizedExtension === 'xlsx') {
    const WorkbookLibrary = ExcelJS || require('exceljs');
    records = await parseXlsxRecords(buffer, WorkbookLibrary);
  } else {
    throw new UploadParseError('INVALID_FORMAT', '仅支持CSV或XLSX文件');
  }

  return validateRecords(records, { maxRows });
};

module.exports = {
  DEFAULT_MAX_ROWS,
  HEADER_ALIASES,
  REASON_TEXT,
  UploadParseError,
  normalizeHeader,
  normalizeWordIdentity,
  parseCsvRecords,
  validateRecords,
  parseUploadBuffer
};
