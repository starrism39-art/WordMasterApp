'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { performance } = require('perf_hooks');

const ExcelJS = require('../cloudfunctions/teacherWordbook/node_modules/exceljs');
const {
  EXPORT_RESOLUTION_STATES,
  RECORD_KINDS,
  resolveRecordExportSnapshot
} = require('../utils/record-export-contract.js');
const { buildFiveRoundDates } = require('../utils/anti-forgetting-filter.js');
const { generateLocalExportPdf } = require('../subpages/records/export/pdf-generator.js');
const { generateLocalExportXlsx } = require('../subpages/records/export/xlsx-generator.js');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'test-output', 'stage2d-local-export');
const fontPath = path.join(
  projectRoot,
  'subpages',
  'records',
  'export',
  'assets',
  'WordMasterExportSans-Regular.ttf.br'
);
const ipaFontPath = path.join(
  projectRoot,
  'subpages',
  'records',
  'export',
  'assets',
  'WordMasterExportSans-IPA-Regular.ttf.br'
);

const WORDS = [
  ['apple', '/ˈæpəl/', '苹果；苹果树的果实'],
  ['environment', '/ɪnˈvaɪrənmənt/', '环境；周围的自然条件'],
  ['education', '/ˌedʒuˈkeɪʃn/', '教育；培养与学习的过程'],
  ['knowledge', '/ˈnɒlɪdʒ/', '知识；通过学习获得的认识'],
  ['example', '', '例子；用于说明规则的事物'],
  ['third', '/θɜːd/', '第三；三分之一'],
  ['judge', '/dʒʌdʒ/', '判断；法官'],
  ['language', '/ˈlæŋɡwɪdʒ/', '语言；表达和交流的系统']
];

const createWords = (count) => Array.from({ length: count }, (_, index) => {
  const source = WORDS[index % WORDS.length];
  return {
    wordId: `probe-word-${index + 1}`,
    word: `${source[0]}${String(index + 1).padStart(4, '0')}`,
    phonetic: source[1],
    meaning: `${source[2]}（技术探针第${index + 1}项）`,
    masteryStatus: index % 2 === 0 ? 'mastered' : 'notMastered'
  };
});

const resolveFixture = async (count) => {
  const completedAt = '2026-08-29T23:30:00+08:00';
  const result = await resolveRecordExportSnapshot({
    id: `local-export-core-${count}`,
    recordSchemaVersion: 1,
    recordKind: RECORD_KINDS.LEARNING,
    completedAt,
    studentSnapshot: { id: 'probe-student', name: '本地导出测试学生' },
    wordbookSnapshot: {
      id: 'probe-wordbook',
      title: '本地导出技术探针词书',
      sourceType: 'official',
      version: null
    },
    wordsSnapshot: createWords(count)
  });
  assert.strictEqual(result.state, EXPORT_RESOLUTION_STATES.COMPLETE);
  assert.strictEqual(result.snapshot.wordsSnapshot.length, count);
  return result.snapshot;
};

const sampleMemory = (tracker) => {
  const current = process.memoryUsage();
  tracker.peakRssBytes = Math.max(tracker.peakRssBytes, current.rss);
  tracker.peakHeapUsedBytes = Math.max(tracker.peakHeapUsedBytes, current.heapUsed);
  tracker.peakArrayBuffersBytes = Math.max(tracker.peakArrayBuffersBytes, current.arrayBuffers || 0);
};

const measure = async (kind, count, create) => {
  if (typeof global.gc === 'function') global.gc();
  const before = process.memoryUsage();
  const tracker = {
    peakRssBytes: before.rss,
    peakHeapUsedBytes: before.heapUsed,
    peakArrayBuffersBytes: before.arrayBuffers || 0
  };
  const startedAt = performance.now();
  const result = await create(() => sampleMemory(tracker));
  const elapsedMs = performance.now() - startedAt;
  sampleMemory(tracker);
  return {
    kind,
    count,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    fileBytes: result.bytes.length,
    peakRssBytes: tracker.peakRssBytes,
    peakHeapUsedBytes: tracker.peakHeapUsedBytes,
    peakArrayBuffersBytes: tracker.peakArrayBuffersBytes,
    incrementalPeakRssBytes: Math.max(0, tracker.peakRssBytes - before.rss),
    incrementalPeakHeapUsedBytes: Math.max(0, tracker.peakHeapUsedBytes - before.heapUsed),
    incrementalPeakArrayBuffersBytes: Math.max(0, tracker.peakArrayBuffersBytes - (before.arrayBuffers || 0)),
    result
  };
};

const verifyXlsx = async (filePath, count) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  assert.strictEqual(workbook.worksheets.length, 1);
  const worksheet = workbook.worksheets[0];
  assert.strictEqual(worksheet.name, '学习记录');
  assert.strictEqual(worksheet.actualColumnCount, 2);
  assert.strictEqual(worksheet.actualRowCount, count + 1);
  assert.strictEqual(worksheet.getCell('A1').value, '单词');
  assert.strictEqual(worksheet.getCell('B1').value, '中文释义');
  assert.strictEqual(worksheet.getCell('A2').value, 'apple0001\n/ˈæpəl/');
  assert.strictEqual(worksheet.getCell('A6').value, 'example0005');
  assert.strictEqual(worksheet.getCell('A2').alignment.wrapText, true);
  assert.strictEqual(worksheet.getCell('B2').alignment.wrapText, true);
  const buffer = fs.readFileSync(filePath);
  assert.strictEqual(buffer.includes(Buffer.from('五轮抗遗忘复习计划', 'utf8')), false);
};

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const compressedFont = fs.readFileSync(fontPath);
  const compressedIpaFont = fs.readFileSync(ipaFontPath);
  const chineseFontBytes = zlib.brotliDecompressSync(compressedFont);
  const ipaFontBytes = zlib.brotliDecompressSync(compressedIpaFont);
  assert(chineseFontBytes.length > compressedFont.length);
  assert(ipaFontBytes.length > compressedIpaFont.length);
  const performanceRows = [];

  for (const count of [100, 500, 1000]) {
    const snapshot = await resolveFixture(count);
    const pdfMeasurement = await measure('pdf', count, async (onProgress) => (
      generateLocalExportPdf({
        studentName: snapshot.studentSnapshot.name,
        wordbookTitle: snapshot.wordbookSnapshot.title,
        completedAt: snapshot.completedAt,
        wordsSnapshot: snapshot.wordsSnapshot,
        chineseFontBytes,
        ipaFontBytes,
        onProgress
      })
    ));
    const pdfPath = path.join(outputDir, `local-export-${count}.pdf`);
    fs.writeFileSync(pdfPath, pdfMeasurement.result.bytes);
    const pdfText = Buffer.from(pdfMeasurement.result.bytes).toString('latin1');
    assert(pdfText.startsWith('%PDF-1.7'));
    assert(pdfText.includes('/MediaBox [0 0 595.28 841.89]'));
    assert(pdfText.includes('/FontFile2'));
    assert(pdfText.includes('/ToUnicode'));
    assert(pdfText.endsWith('%%EOF\n'));
    assert(pdfMeasurement.result.pageCount >= (count === 100 ? 2 : 5));
    assert(pdfMeasurement.result.repeatedHeaderCount >= pdfMeasurement.result.pageCount - 1);
    assert.deepStrictEqual(
      pdfMeasurement.result.fiveRoundDates,
      buildFiveRoundDates(snapshot.completedAt).map((item) => item.date)
    );
    performanceRows.push({
      ...pdfMeasurement,
      result: {
        pageCount: pdfMeasurement.result.pageCount,
        repeatedHeaderCount: pdfMeasurement.result.repeatedHeaderCount
      }
    });

    const xlsxMeasurement = await measure('xlsx', count, async (onProgress) => (
      generateLocalExportXlsx({
        wordsSnapshot: snapshot.wordsSnapshot,
        createdAt: new Date('2026-08-30T00:00:00Z'),
        onProgress
      })
    ));
    const xlsxPath = path.join(outputDir, `local-export-${count}.xlsx`);
    fs.writeFileSync(xlsxPath, xlsxMeasurement.result.bytes);
    await verifyXlsx(xlsxPath, count);
    performanceRows.push({
      ...xlsxMeasurement,
      result: {
        rowCount: xlsxMeasurement.result.rowCount,
        columnCount: xlsxMeasurement.result.columnCount
      }
    });
  }

  const performanceReport = performanceRows.map(({ result, ...row }) => ({ ...row, ...result }));
  fs.writeFileSync(
    path.join(outputDir, 'performance.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      font: {
        packagedBytes: compressedFont.length + compressedIpaFont.length,
        runtimeBytes: chineseFontBytes.length + ipaFontBytes.length,
        license: 'SIL Open Font License 1.1'
      },
      results: performanceReport
    }, null, 2)
  );

  const largestPdf = performanceReport.find((row) => row.kind === 'pdf' && row.count === 1000);
  const largestXlsx = performanceReport.find((row) => row.kind === 'xlsx' && row.count === 1000);
  assert(largestPdf.elapsedMs < 30000, `1000-word PDF too slow: ${largestPdf.elapsedMs}ms`);
  assert(largestXlsx.elapsedMs < 30000, `1000-word XLSX too slow: ${largestXlsx.elapsedMs}ms`);
  assert(largestPdf.fileBytes < 10 * 1024 * 1024);
  assert(largestXlsx.fileBytes < 10 * 1024 * 1024);
  process.stdout.write(`local-export-core: PASS\n${JSON.stringify(performanceReport, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
