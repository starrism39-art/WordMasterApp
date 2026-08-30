'use strict';

const { normalizeBytes } = require('./binary-utils.js');

const readTag = (view, offset) => String.fromCharCode(
  view.getUint8(offset),
  view.getUint8(offset + 1),
  view.getUint8(offset + 2),
  view.getUint8(offset + 3)
);

const createFormat4Lookup = (view, offset) => {
  const segCount = view.getUint16(offset + 6, false) / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + (segCount * 2) + 2;
  const idDeltaOffset = startCodeOffset + (segCount * 2);
  const idRangeOffsetOffset = idDeltaOffset + (segCount * 2);

  return (codePoint) => {
    if (codePoint > 0xFFFF) return 0;
    for (let index = 0; index < segCount; index += 1) {
      const endCode = view.getUint16(endCodeOffset + (index * 2), false);
      if (codePoint > endCode) continue;
      const startCode = view.getUint16(startCodeOffset + (index * 2), false);
      if (codePoint < startCode) return 0;
      const delta = view.getInt16(idDeltaOffset + (index * 2), false);
      const rangeOffsetPosition = idRangeOffsetOffset + (index * 2);
      const rangeOffset = view.getUint16(rangeOffsetPosition, false);
      if (rangeOffset === 0) return (codePoint + delta) & 0xFFFF;
      const glyphPosition = rangeOffsetPosition + rangeOffset + ((codePoint - startCode) * 2);
      if (glyphPosition + 2 > view.byteLength) return 0;
      const glyphId = view.getUint16(glyphPosition, false);
      return glyphId === 0 ? 0 : ((glyphId + delta) & 0xFFFF);
    }
    return 0;
  };
};

const createFormat12Lookup = (view, offset) => {
  const groupCount = view.getUint32(offset + 12, false);
  const groupsOffset = offset + 16;
  return (codePoint) => {
    let low = 0;
    let high = groupCount - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const groupOffset = groupsOffset + (middle * 12);
      const start = view.getUint32(groupOffset, false);
      const end = view.getUint32(groupOffset + 4, false);
      if (codePoint < start) {
        high = middle - 1;
      } else if (codePoint > end) {
        low = middle + 1;
      } else {
        return view.getUint32(groupOffset + 8, false) + (codePoint - start);
      }
    }
    return 0;
  };
};

const createCmapLookup = (view, table) => {
  const recordCount = view.getUint16(table.offset + 2, false);
  const candidates = [];
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = table.offset + 4 + (index * 8);
    const platformId = view.getUint16(recordOffset, false);
    const encodingId = view.getUint16(recordOffset + 2, false);
    const subtableOffset = table.offset + view.getUint32(recordOffset + 4, false);
    const format = view.getUint16(subtableOffset, false);
    const score = (format === 12 ? 100 : (format === 4 ? 50 : 0))
      + (platformId === 3 ? 10 : 0)
      + (encodingId === 10 ? 5 : 0);
    if (format === 4 || format === 12) candidates.push({ format, offset: subtableOffset, score });
  }
  candidates.sort((left, right) => right.score - left.score);
  if (candidates.length === 0) throw new Error('UNSUPPORTED_TTF_CMAP');
  return candidates[0].format === 12
    ? createFormat12Lookup(view, candidates[0].offset)
    : createFormat4Lookup(view, candidates[0].offset);
};

const parseTtfFont = (input) => {
  const bytes = normalizeBytes(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 12) throw new Error('INVALID_TTF');

  const tableCount = view.getUint16(4, false);
  const tables = Object.create(null);
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + (index * 16);
    const tag = readTag(view, recordOffset);
    tables[tag] = {
      offset: view.getUint32(recordOffset + 8, false),
      length: view.getUint32(recordOffset + 12, false)
    };
  }

  ['head', 'hhea', 'hmtx', 'maxp', 'cmap'].forEach((tag) => {
    if (!tables[tag]) throw new Error(`MISSING_TTF_TABLE:${tag}`);
  });

  const head = tables.head.offset;
  const hhea = tables.hhea.offset;
  const maxp = tables.maxp.offset;
  const hmtx = tables.hmtx.offset;
  const unitsPerEm = view.getUint16(head + 18, false);
  const numberOfHMetrics = view.getUint16(hhea + 34, false);
  const glyphCount = view.getUint16(maxp + 4, false);
  const lastAdvance = view.getUint16(hmtx + ((numberOfHMetrics - 1) * 4), false);
  const lookupGlyphId = createCmapLookup(view, tables.cmap);

  const getAdvanceWidth = (glyphId) => {
    if (!Number.isInteger(glyphId) || glyphId < 0 || glyphId >= glyphCount) return lastAdvance;
    return glyphId < numberOfHMetrics
      ? view.getUint16(hmtx + (glyphId * 4), false)
      : lastAdvance;
  };

  const getGlyphId = (char) => lookupGlyphId(String(char || '').codePointAt(0) || 0);
  const measureText = (text, fontSize) => {
    let units = 0;
    for (const char of String(text || '')) units += getAdvanceWidth(getGlyphId(char));
    return (units / unitsPerEm) * fontSize;
  };

  return Object.freeze({
    bytes,
    unitsPerEm,
    ascent: view.getInt16(hhea + 4, false),
    descent: view.getInt16(hhea + 6, false),
    bbox: Object.freeze([
      view.getInt16(head + 36, false),
      view.getInt16(head + 38, false),
      view.getInt16(head + 40, false),
      view.getInt16(head + 42, false)
    ]),
    glyphCount,
    getAdvanceWidth,
    getGlyphId,
    measureText
  });
};

module.exports = { parseTtfFont };
