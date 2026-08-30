'use strict';

const { buildFiveRoundDates } = require('../../../utils/anti-forgetting-filter.js');
const { asciiEncode, concatBytes, normalizeBytes } = require('./binary-utils.js');
const { parseTtfFont } = require('./ttf-font.js');
const { normalizePhonetic } = require('./xlsx-generator.js');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const TABLE_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const WORD_COLUMN_WIDTH = 182;
const HEADER_HEIGHT = 26;
const BODY_FONT_SIZE = 9;
const BODY_LINE_HEIGHT = 12;

const formatNumber = (value) => Number(value.toFixed(2)).toString();
const toHex = (value, length = 4) => Number(value).toString(16).toUpperCase().padStart(length, '0');

const utf16Hex = (codePoint) => {
  if (codePoint <= 0xFFFF) return toHex(codePoint, 4);
  const normalized = codePoint - 0x10000;
  const high = 0xD800 + (normalized >> 10);
  const low = 0xDC00 + (normalized & 0x3FF);
  return `${toHex(high, 4)}${toHex(low, 4)}`;
};

const createPdfError = (code, details) => {
  const error = new Error(details ? `${code}:${details}` : code);
  error.code = code;
  return error;
};

const wrapText = (font, value, maxWidth, fontSize) => {
  const text = String(value === undefined || value === null ? '' : value);
  const lines = [];
  text.split(/\r?\n/).forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }
    let current = '';
    let width = 0;
    for (const char of paragraph) {
      const charWidth = font.measureText(char, fontSize);
      if (current && width + charWidth > maxWidth) {
        lines.push(current);
        current = char;
        width = charWidth;
      } else {
        current += char;
        width += charWidth;
      }
    }
    if (current || lines.length === 0) lines.push(current);
  });
  return lines.length ? lines : [''];
};

const collectTextValues = ({ studentName, wordbookTitle, words, rounds }) => {
  const values = [
    '学生姓名：', '词书名称：', '单词', '中文释义',
    '五轮抗遗忘复习计划', '复习日期', '复习词数',
    '第1轮', '第2轮', '第3轮', '第4轮', '第5轮',
    studentName, wordbookTitle
  ];
  words.forEach((word) => {
    values.push(word.word, word.meaning, normalizePhonetic(word.phonetic));
  });
  rounds.forEach((round) => values.push(round.date));
  return values;
};

const assertFontCoverage = (fonts, values) => {
  const missing = new Set();
  values.forEach((value) => {
    for (const char of String(value || '')) {
      if (char === '\n' || char === '\r' || char === '\t') continue;
      if (!fonts.some((font) => font.getGlyphId(char))) missing.add(char);
    }
  });
  if (missing.size) {
    throw createPdfError('FONT_GLYPH_MISSING', Array.from(missing).join(''));
  }
};

class PdfObjectBuilder {
  constructor() {
    this.objects = [null];
  }

  reserve() {
    this.objects.push(null);
    return this.objects.length - 1;
  }

  add(body) {
    const id = this.reserve();
    this.set(id, body);
    return id;
  }

  set(id, body) {
    this.objects[id] = typeof body === 'string' ? asciiEncode(body) : normalizeBytes(body);
  }

  build(rootId) {
    const header = concatBytes([
      asciiEncode('%PDF-1.7\n%'),
      Uint8Array.from([0xE2, 0xE3, 0xCF, 0xD3, 0x0A])
    ]);
    const parts = [header];
    const offsets = [0];
    let currentOffset = header.length;

    for (let id = 1; id < this.objects.length; id += 1) {
      if (!this.objects[id]) throw new Error(`PDF_OBJECT_MISSING:${id}`);
      const objectBytes = concatBytes([
        asciiEncode(`${id} 0 obj\n`),
        this.objects[id],
        asciiEncode('\nendobj\n')
      ]);
      offsets[id] = currentOffset;
      currentOffset += objectBytes.length;
      parts.push(objectBytes);
    }

    const xrefOffset = currentOffset;
    const xrefLines = [`xref\n0 ${this.objects.length}\n`, '0000000000 65535 f \n'];
    for (let id = 1; id < this.objects.length; id += 1) {
      xrefLines.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
    }
    xrefLines.push(
      `trailer\n<< /Size ${this.objects.length} /Root ${rootId} 0 R >>\n`,
      `startxref\n${xrefOffset}\n%%EOF\n`
    );
    parts.push(asciiEncode(xrefLines.join('')));
    return concatBytes(parts);
  }
}

const createStreamBody = (dictionary, data) => {
  const bytes = normalizeBytes(data);
  return concatBytes([
    asciiEncode(`<< ${dictionary ? `${dictionary} ` : ''}/Length ${bytes.length} >>\nstream\n`),
    bytes,
    asciiEncode('\nendstream')
  ]);
};

const createToUnicodeCmap = (glyphUnicodeMap) => {
  const entries = Array.from(glyphUnicodeMap.entries()).sort((left, right) => left[0] - right[0]);
  const parts = [
    '/CIDInit /ProcSet findresource begin\n',
    '12 dict begin\n',
    'begincmap\n',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n',
    '/CMapName /WordMasterExportSans-UCS def\n',
    '/CMapType 2 def\n',
    '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'
  ];
  for (let index = 0; index < entries.length; index += 100) {
    const chunk = entries.slice(index, index + 100);
    parts.push(`${chunk.length} beginbfchar\n`);
    chunk.forEach(([glyphId, codePoint]) => {
      parts.push(`<${toHex(glyphId, 4)}> <${utf16Hex(codePoint)}>\n`);
    });
    parts.push('endbfchar\n');
  }
  parts.push('endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n');
  return asciiEncode(parts.join(''));
};

const addEmbeddedFont = (builder, {
  font,
  baseFontName,
  usedGlyphIds,
  glyphUnicodeMap
}) => {
  const fontFileId = builder.add(createStreamBody(`/Length1 ${font.bytes.length}`, font.bytes));
  const scaleMetric = (value) => Math.round((value / font.unitsPerEm) * 1000);
  const bbox = font.bbox.map(scaleMetric);
  const fontDescriptorId = builder.add(
    `<< /Type /FontDescriptor /FontName /${baseFontName} /Flags 4 /FontBBox [${bbox.join(' ')}] `
    + `/ItalicAngle 0 /Ascent ${scaleMetric(font.ascent)} /Descent ${scaleMetric(font.descent)} `
    + `/CapHeight ${scaleMetric(font.ascent)} /StemV 80 /MissingWidth ${scaleMetric(font.getAdvanceWidth(0))} `
    + `/FontFile2 ${fontFileId} 0 R >>`
  );
  const widths = Array.from(usedGlyphIds).sort((left, right) => left - right).map((glyphId) => (
    `${glyphId} [${scaleMetric(font.getAdvanceWidth(glyphId))}]`
  )).join(' ');
  const cidFontId = builder.add(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseFontName} `
    + '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> '
    + `/FontDescriptor ${fontDescriptorId} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap /Identity >>`
  );
  const toUnicodeId = builder.add(createStreamBody('', createToUnicodeCmap(glyphUnicodeMap)));
  return builder.add(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${baseFontName} /Encoding /Identity-H `
    + `/DescendantFonts [${cidFontId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`
  );
};

const generateLocalExportPdf = ({
  studentName,
  wordbookTitle,
  completedAt,
  wordsSnapshot,
  chineseFontBytes,
  ipaFontBytes,
  onProgress
} = {}) => {
  const words = Array.isArray(wordsSnapshot) ? wordsSnapshot.map((word) => ({
    word: String(word && word.word || '').trim(),
    meaning: String(word && word.meaning || '').trim(),
    phonetic: String(word && word.phonetic || '').trim()
  })) : [];
  const rounds = buildFiveRoundDates(completedAt);
  const chineseFont = parseTtfFont(chineseFontBytes);
  const ipaFont = parseTtfFont(ipaFontBytes);
  const selectableFonts = [
    { key: 'F2', font: ipaFont },
    { key: 'F1', font: chineseFont }
  ];
  const selectFont = (char) => selectableFonts.find((candidate) => candidate.font.getGlyphId(char));
  const compositeFont = {
    measureText(text, fontSize) {
      let width = 0;
      for (const char of String(text || '')) {
        const selected = selectFont(char);
        if (selected) width += selected.font.measureText(char, fontSize);
      }
      return width;
    }
  };
  const safeStudentName = String(studentName || '').trim();
  const safeWordbookTitle = String(wordbookTitle || '').trim();
  assertFontCoverage([ipaFont, chineseFont], collectTextValues({
    studentName: safeStudentName,
    wordbookTitle: safeWordbookTitle,
    words,
    rounds
  }));

  const pages = [];
  const fontUsage = {
    F1: { font: chineseFont, glyphUnicodeMap: new Map(), usedGlyphIds: new Set() },
    F2: { font: ipaFont, glyphUnicodeMap: new Map(), usedGlyphIds: new Set() }
  };
  let repeatedHeaderCount = 0;
  let metadataLayout = null;

  const createPage = () => {
    const page = { commands: [] };
    pages.push(page);
    return page;
  };

  const drawText = (page, text, x, baseline, fontSize) => {
    if (!text) return;
    const runs = [];
    for (const char of String(text)) {
      const selected = selectFont(char);
      if (!selected) throw createPdfError('FONT_GLYPH_MISSING', char);
      const last = runs[runs.length - 1];
      if (last && last.key === selected.key) last.text += char;
      else runs.push({ key: selected.key, text: char, font: selected.font });
    }
    let cursor = x;
    runs.forEach((run) => {
      let hex = '';
      const usage = fontUsage[run.key];
      for (const char of run.text) {
        const glyphId = run.font.getGlyphId(char);
        usage.usedGlyphIds.add(glyphId);
        if (!usage.glyphUnicodeMap.has(glyphId)) usage.glyphUnicodeMap.set(glyphId, char.codePointAt(0));
        hex += toHex(glyphId, 4);
      }
      page.commands.push(
        `BT /${run.key} ${formatNumber(fontSize)} Tf 1 0 0 1 ${formatNumber(cursor)} ${formatNumber(baseline)} Tm <${hex}> Tj ET\n`
      );
      cursor += run.font.measureText(run.text, fontSize);
    });
  };

  const drawRect = (page, x, bottom, width, height, fillGray) => {
    if (fillGray !== undefined) {
      page.commands.push(`${formatNumber(fillGray)} g ${formatNumber(x)} ${formatNumber(bottom)} ${formatNumber(width)} ${formatNumber(height)} re f 0 g\n`);
    }
    page.commands.push(`0.75 G 0.5 w ${formatNumber(x)} ${formatNumber(bottom)} ${formatNumber(width)} ${formatNumber(height)} re S 0 G\n`);
  };

  const drawVerticalLine = (page, x, bottom, top) => {
    page.commands.push(`0.75 G 0.5 w ${formatNumber(x)} ${formatNumber(bottom)} m ${formatNumber(x)} ${formatNumber(top)} l S 0 G\n`);
  };

  const drawWordHeader = (page, top) => {
    const bottom = top - HEADER_HEIGHT;
    drawRect(page, MARGIN, bottom, TABLE_WIDTH, HEADER_HEIGHT, 0.94);
    drawVerticalLine(page, MARGIN + WORD_COLUMN_WIDTH, bottom, top);
    drawText(page, '单词', MARGIN + 8, bottom + 8, 10);
    drawText(page, '中文释义', MARGIN + WORD_COLUMN_WIDTH + 8, bottom + 8, 10);
    repeatedHeaderCount += 1;
    return bottom;
  };

  const drawMetadata = (page) => {
    const fontSize = 10.5;
    const lineHeight = 14;
    const columnGap = 20;
    const studentText = `学生姓名：${safeStudentName}`;
    const wordbookText = `词书名称：${safeWordbookTitle}`;
    const desiredStudentWidth = compositeFont.measureText(studentText, fontSize) + 4;
    const studentColumnWidth = Math.min(190, Math.max(140, desiredStudentWidth));
    const wordbookColumnWidth = TABLE_WIDTH - studentColumnWidth - columnGap;
    const wordbookX = MARGIN + studentColumnWidth + columnGap;
    const studentLines = wrapText(compositeFont, studentText, studentColumnWidth, fontSize);
    const wordbookLines = wrapText(compositeFont, wordbookText, wordbookColumnWidth, fontSize);
    const firstBaseline = PAGE_HEIGHT - MARGIN - 10;

    studentLines.forEach((line, index) => {
      drawText(page, line, MARGIN, firstBaseline - (index * lineHeight), fontSize);
    });
    wordbookLines.forEach((line, index) => {
      drawText(page, line, wordbookX, firstBaseline - (index * lineHeight), fontSize);
    });

    const lineCount = Math.max(studentLines.length, wordbookLines.length);
    const tableTop = firstBaseline - (lineCount * lineHeight) - 4;
    metadataLayout = Object.freeze({
      studentX: MARGIN,
      studentColumnWidth,
      studentLineCount: studentLines.length,
      studentMaxLineWidth: Math.max(...studentLines.map((line) => compositeFont.measureText(line, fontSize))),
      wordbookX,
      wordbookColumnWidth,
      wordbookLineCount: wordbookLines.length,
      wordbookMaxLineWidth: Math.max(...wordbookLines.map((line) => compositeFont.measureText(line, fontSize))),
      columnGap,
      firstBaseline,
      tableTop
    });
    return tableTop;
  };

  const startWordPage = (firstPage) => {
    const page = createPage();
    const headerTop = firstPage ? drawMetadata(page) : (PAGE_HEIGHT - MARGIN);
    return { page, currentTop: drawWordHeader(page, headerTop) };
  };

  let state = startWordPage(true);
  words.forEach((word, wordIndex) => {
    const phonetic = normalizePhonetic(word.phonetic);
    const meaningLines = wrapText(compositeFont, word.meaning, TABLE_WIDTH - WORD_COLUMN_WIDTH - 16, BODY_FONT_SIZE);
    const wordHeight = phonetic ? 34 : 26;
    const meaningHeight = Math.max(1, meaningLines.length) * BODY_LINE_HEIGHT + 10;
    const rowHeight = Math.max(wordHeight, meaningHeight);
    if (state.currentTop - rowHeight < MARGIN) state = startWordPage(false);

    const bottom = state.currentTop - rowHeight;
    drawRect(state.page, MARGIN, bottom, TABLE_WIDTH, rowHeight);
    drawVerticalLine(state.page, MARGIN + WORD_COLUMN_WIDTH, bottom, state.currentTop);
    if (phonetic) {
      drawText(state.page, word.word, MARGIN + 8, state.currentTop - 13, BODY_FONT_SIZE);
      drawText(state.page, phonetic, MARGIN + 8, state.currentTop - 26, 8);
    } else {
      drawText(state.page, word.word, MARGIN + 8, state.currentTop - 17, BODY_FONT_SIZE);
    }
    meaningLines.forEach((line, lineIndex) => {
      drawText(
        state.page,
        line,
        MARGIN + WORD_COLUMN_WIDTH + 8,
        state.currentTop - 13 - (lineIndex * BODY_LINE_HEIGHT),
        BODY_FONT_SIZE
      );
    });
    state.currentTop = bottom;
    if (typeof onProgress === 'function' && ((wordIndex + 1) % 50 === 0 || wordIndex + 1 === words.length)) {
      onProgress({ phase: 'pdf_rows', completed: wordIndex + 1, total: words.length });
    }
  });

  const roundTableHeight = 92;
  if (state.currentTop - roundTableHeight < MARGIN) {
    state = { page: createPage(), currentTop: PAGE_HEIGHT - MARGIN };
  } else {
    state.currentTop -= 16;
  }
  drawText(state.page, '五轮抗遗忘复习计划', MARGIN, state.currentTop - 11, 11);
  state.currentTop -= 22;

  const roundRowHeight = 23;
  const labelWidth = 72;
  const roundWidth = (TABLE_WIDTH - labelWidth) / 5;
  const roundRows = [
    ['', '第1轮', '第2轮', '第3轮', '第4轮', '第5轮'],
    ['复习日期', ...rounds.map((round) => round.date)],
    ['复习词数', '', '', '', '', '']
  ];
  roundRows.forEach((cells, rowIndex) => {
    const top = state.currentTop;
    const bottom = top - roundRowHeight;
    drawRect(state.page, MARGIN, bottom, TABLE_WIDTH, roundRowHeight, rowIndex === 0 ? 0.94 : undefined);
    let x = MARGIN;
    cells.forEach((cell, cellIndex) => {
      const width = cellIndex === 0 ? labelWidth : roundWidth;
      if (cellIndex > 0) drawVerticalLine(state.page, x, bottom, top);
      const fontSize = rowIndex === 1 && cellIndex > 0 ? 7.5 : 8.5;
      const textWidth = compositeFont.measureText(cell, fontSize);
      drawText(state.page, cell, x + Math.max(4, (width - textWidth) / 2), bottom + 7, fontSize);
      x += width;
    });
    state.currentTop = bottom;
  });

  const builder = new PdfObjectBuilder();
  const catalogId = builder.reserve();
  const pagesId = builder.reserve();
  const chineseFontId = addEmbeddedFont(builder, {
    font: chineseFont,
    baseFontName: 'WordMasterExportSansSC',
    ...fontUsage.F1
  });
  const ipaFontId = addEmbeddedFont(builder, {
    font: ipaFont,
    baseFontName: 'WordMasterExportSansIPA',
    ...fontUsage.F2
  });

  const pageIds = pages.map((page) => {
    const contentId = builder.add(createStreamBody('', asciiEncode(page.commands.join(''))));
    return builder.add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${formatNumber(PAGE_WIDTH)} ${formatNumber(PAGE_HEIGHT)}] `
      + `/Resources << /Font << /F1 ${chineseFontId} 0 R /F2 ${ipaFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
  });
  builder.set(pagesId, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
  builder.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const bytes = builder.build(catalogId);

  return Object.freeze({
    bytes,
    pageCount: pageIds.length,
    wordCount: words.length,
    repeatedHeaderCount,
    metadataLayout,
    fiveRoundDates: Object.freeze(rounds.map((round) => round.date))
  });
};

module.exports = {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  generateLocalExportPdf,
  wrapText
};
