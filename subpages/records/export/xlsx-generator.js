'use strict';

const {
  concatBytes,
  crc32,
  utf8Encode,
  writeUint16LE,
  writeUint32LE
} = require('./binary-utils.js');

const xmlEscape = (value) => String(value === undefined || value === null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const normalizePhonetic = (value) => {
  const phonetic = String(value === undefined || value === null ? '' : value).trim();
  if (!phonetic) return '';
  return phonetic.startsWith('/') && phonetic.endsWith('/') ? phonetic : `/${phonetic.replace(/^\/+|\/+$/g, '')}/`;
};

const formatWordCell = (word) => {
  const text = String(word && word.word || '').trim();
  const phonetic = normalizePhonetic(word && word.phonetic);
  return phonetic ? `${text}\n${phonetic}` : text;
};

const createStoredZip = (entries, now = new Date('2026-01-01T00:00:00Z')) => {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const year = Math.max(1980, now.getUTCFullYear());
  const dosTime = ((now.getUTCHours() & 0x1F) << 11)
    | ((now.getUTCMinutes() & 0x3F) << 5)
    | ((Math.floor(now.getUTCSeconds() / 2)) & 0x1F);
  const dosDate = (((year - 1980) & 0x7F) << 9)
    | (((now.getUTCMonth() + 1) & 0x0F) << 5)
    | (now.getUTCDate() & 0x1F);

  entries.forEach((entry) => {
    const name = utf8Encode(entry.name);
    const data = utf8Encode(entry.content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + name.length);
    writeUint32LE(localHeader, 0, 0x04034B50);
    writeUint16LE(localHeader, 4, 20);
    writeUint16LE(localHeader, 6, 0x0800);
    writeUint16LE(localHeader, 8, 0);
    writeUint16LE(localHeader, 10, dosTime);
    writeUint16LE(localHeader, 12, dosDate);
    writeUint32LE(localHeader, 14, checksum);
    writeUint32LE(localHeader, 18, data.length);
    writeUint32LE(localHeader, 22, data.length);
    writeUint16LE(localHeader, 26, name.length);
    localHeader.set(name, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + name.length);
    writeUint32LE(centralHeader, 0, 0x02014B50);
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 8, 0x0800);
    writeUint16LE(centralHeader, 10, 0);
    writeUint16LE(centralHeader, 12, dosTime);
    writeUint16LE(centralHeader, 14, dosDate);
    writeUint32LE(centralHeader, 16, checksum);
    writeUint32LE(centralHeader, 20, data.length);
    writeUint32LE(centralHeader, 24, data.length);
    writeUint16LE(centralHeader, 28, name.length);
    writeUint32LE(centralHeader, 42, localOffset);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + data.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32LE(end, 0, 0x06054B50);
  writeUint16LE(end, 8, entries.length);
  writeUint16LE(end, 10, entries.length);
  writeUint32LE(end, 12, centralDirectory.length);
  writeUint32LE(end, 16, localOffset);
  return concatBytes([...localParts, centralDirectory, end]);
};

const generateLocalExportXlsx = ({ wordsSnapshot, createdAt, onProgress } = {}) => {
  const words = Array.isArray(wordsSnapshot) ? wordsSnapshot : [];
  const rows = [
    '<row r="1" ht="24" customHeight="1"><c r="A1" t="inlineStr" s="1"><is><t>单词</t></is></c><c r="B1" t="inlineStr" s="1"><is><t>中文释义</t></is></c></row>'
  ];
  words.forEach((word, index) => {
    const rowNumber = index + 2;
    rows.push(
      `<row r="${rowNumber}" ht="32" customHeight="1">`
      + `<c r="A${rowNumber}" t="inlineStr" s="2"><is><t xml:space="preserve">${xmlEscape(formatWordCell(word))}</t></is></c>`
      + `<c r="B${rowNumber}" t="inlineStr" s="2"><is><t xml:space="preserve">${xmlEscape(String(word && word.meaning || '').trim())}</t></is></c>`
      + '</row>'
    );
    if (typeof onProgress === 'function' && ((index + 1) % 50 === 0 || index + 1 === words.length)) {
      onProgress({ phase: 'xlsx_rows', completed: index + 1, total: words.length });
    }
  });

  const lastRow = Math.max(1, words.length + 1);
  const entries = [
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '</Types>'
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>'
    },
    {
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<sheets><sheet name="学习记录" sheetId="1" r:id="rId1"/></sheets></workbook>'
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '</Relationships>'
    },
    {
      name: 'xl/styles.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/><bgColor indexed="64"/></patternFill></fill></fills>'
        + '<borders count="2"><border/><border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom></border></borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        + '<xf numFmtId="0" fontId="1" fillId="1" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>'
        + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
        + '</cellXfs></styleSheet>'
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + `<dimension ref="A1:B${lastRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>`
        + '<cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="56" customWidth="1"/></cols>'
        + `<sheetData>${rows.join('')}</sheetData>`
        + '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
        + '</worksheet>'
    }
  ];

  const bytes = createStoredZip(entries, createdAt instanceof Date ? createdAt : undefined);
  return Object.freeze({ bytes, rowCount: words.length, columnCount: 2 });
};

module.exports = {
  createStoredZip,
  formatWordCell,
  generateLocalExportXlsx,
  normalizePhonetic
};
