'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { generateLocalExportPdf } = require('../subpages/records/export/pdf-generator.js');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'test-output', 'stage2e-pdf-layout');
const assetDir = path.join(projectRoot, 'subpages', 'records', 'export', 'assets');
const chineseFontBytes = zlib.brotliDecompressSync(
  fs.readFileSync(path.join(assetDir, 'WordMasterExportSans-Regular.ttf.br'))
);
const ipaFontBytes = zlib.brotliDecompressSync(
  fs.readFileSync(path.join(assetDir, 'WordMasterExportSans-IPA-Regular.ttf.br'))
);

const wordsSnapshot = [
  { wordId: 'w1', word: 'apple', meaning: '苹果', phonetic: '/ˈæpəl/' },
  { wordId: 'w2', word: 'example', meaning: '例子', phonetic: '' },
  { wordId: 'w3', word: 'language', meaning: '语言', phonetic: '/ˈlæŋɡwɪdʒ/' }
];

const generate = (filename, wordbookTitle) => {
  const result = generateLocalExportPdf({
    studentName: '张三',
    wordbookTitle,
    completedAt: '2026-08-30T09:30:00+08:00',
    wordsSnapshot,
    chineseFontBytes,
    ipaFontBytes
  });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, filename), result.bytes);
  return result;
};

const assertSafeColumns = (layout) => {
  assert(layout, 'metadata layout evidence must exist');
  assert(layout.studentColumnWidth >= layout.studentMaxLineWidth);
  assert(layout.wordbookColumnWidth >= layout.wordbookMaxLineWidth);
  assert(layout.wordbookX >= layout.studentX + layout.studentColumnWidth + layout.columnGap);
  assert(layout.tableTop < layout.firstBaseline - 10);
};

const normal = generate('normal-names.pdf', '人教版英语九年级全一册');
assert.strictEqual(normal.metadataLayout.studentLineCount, 1);
assert.strictEqual(normal.metadataLayout.wordbookLineCount, 1);
assertSafeColumns(normal.metadataLayout);
assert.strictEqual(normal.pageCount, 1);
assert.deepStrictEqual(normal.fiveRoundDates, [
  '2026-08-31', '2026-09-01', '2026-09-03', '2026-09-06', '2026-09-14'
]);

const longTitle = '人教版英语九年级全一册教师自定义历史版本'.repeat(4);
const long = generate('long-wordbook-title.pdf', longTitle);
assert.strictEqual(long.metadataLayout.studentLineCount, 1);
assert(long.metadataLayout.wordbookLineCount > 1, 'long wordbook title must wrap safely');
assertSafeColumns(long.metadataLayout);
assert(long.metadataLayout.tableTop < normal.metadataLayout.tableTop);
assert.strictEqual(Buffer.from(long.bytes).toString('latin1').startsWith('%PDF-1.7'), true);

process.stdout.write(`pdf-header-layout: PASS\n${JSON.stringify({
  normal: normal.metadataLayout,
  long: long.metadataLayout
}, null, 2)}\n`);
