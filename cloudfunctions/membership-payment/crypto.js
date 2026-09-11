'use strict';
const crypto = require('node:crypto');
const { canonical } = require('../membership-core/model');
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const hmac = (key, body) => crypto.createHmac('sha256', key).update(body, 'utf8').digest('hex');
const paySignature = (key, uri, body) => hmac(key, `${uri}&${body}`);
const messageSignature = (...parts) => crypto.createHash('sha1').update(parts.sort().join('')).digest('hex');
function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
// Security-mode JSON only. No plaintext or caller-selected verification bypass.
function decryptNotification({ body, query }, config) {
  if (typeof body !== 'string' || Buffer.byteLength(body) > 65536) throw new Error('INVALID_ENVELOPE');
  const envelope = JSON.parse(body);
  const encrypted = envelope.Encrypt;
  if (!config.token || !/^[A-Za-z0-9+/]{43}$/.test(config.encodingAESKey || '') || !config.appId) throw new Error('NOTIFICATION_NOT_CONFIGURED');
  if (typeof encrypted !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted) || !/^\d{1,12}$/.test(query?.timestamp || '') || typeof query?.nonce !== 'string' || query.nonce.length > 128) throw new Error('INVALID_ENVELOPE');
  if (!equal(messageSignature(config.token, query.timestamp, query.nonce, encrypted), query.msg_signature)) throw new Error('INVALID_SIGNATURE');
  const key = Buffer.from(`${config.encodingAESKey}=`, 'base64');
  const decoder = crypto.createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  decoder.setAutoPadding(false);
  const padded = Buffer.concat([decoder.update(Buffer.from(encrypted, 'base64')), decoder.final()]);
  const padding = padded.at(-1);
  if (!padding || padding > 32 || padded.length < padding + 20 || !padded.subarray(-padding).every(byte => byte === padding)) throw new Error('INVALID_PADDING');
  const plain = padded.subarray(0, -padding);
  const length = plain.readUInt32BE(16);
  if (20 + length > plain.length || !equal(plain.subarray(20 + length).toString('utf8'), config.appId)) throw new Error('WRONG_APPLICATION');
  const result = JSON.parse(plain.subarray(20, 20 + length).toString('utf8'));
  if (result.ToUserName !== config.originalId || result.MsgType !== 'event') throw new Error('WRONG_APPLICATION');
  return result;
}
module.exports = { hash, hmac, paySignature, messageSignature, equal, decryptNotification };
