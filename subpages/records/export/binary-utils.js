'use strict';

const normalizeBytes = (value) => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value && value.buffer instanceof ArrayBuffer) {
    return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
  }
  throw new TypeError('BYTE_SOURCE_REQUIRED');
};

const concatBytes = (parts) => {
  const normalized = parts.map(normalizeBytes);
  const total = normalized.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  normalized.forEach((part) => {
    output.set(part, offset);
    offset += part.byteLength;
  });
  return output;
};

const utf8Encode = (value) => {
  const bytes = [];
  for (const char of String(value === undefined || value === null ? '' : value)) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0x7F) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7FF) {
      bytes.push(0xC0 | (codePoint >> 6), 0x80 | (codePoint & 0x3F));
    } else if (codePoint <= 0xFFFF) {
      bytes.push(
        0xE0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3F),
        0x80 | (codePoint & 0x3F)
      );
    } else {
      bytes.push(
        0xF0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3F),
        0x80 | ((codePoint >> 6) & 0x3F),
        0x80 | (codePoint & 0x3F)
      );
    }
  }
  return Uint8Array.from(bytes);
};

const asciiEncode = (value) => {
  const text = String(value === undefined || value === null ? '' : value);
  const output = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0x7F) throw new Error('ASCII_TEXT_REQUIRED');
    output[index] = code;
  }
  return output;
};

const writeUint16LE = (target, offset, value) => {
  target[offset] = value & 0xFF;
  target[offset + 1] = (value >>> 8) & 0xFF;
};

const writeUint32LE = (target, offset, value) => {
  target[offset] = value & 0xFF;
  target[offset + 1] = (value >>> 8) & 0xFF;
  target[offset + 2] = (value >>> 16) & 0xFF;
  target[offset + 3] = (value >>> 24) & 0xFF;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (value) => {
  const bytes = normalizeBytes(value);
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const toArrayBuffer = (value) => {
  const bytes = normalizeBytes(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

module.exports = {
  asciiEncode,
  concatBytes,
  crc32,
  normalizeBytes,
  toArrayBuffer,
  utf8Encode,
  writeUint16LE,
  writeUint32LE
};
