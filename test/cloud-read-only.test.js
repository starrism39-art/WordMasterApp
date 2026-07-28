'use strict';

const assert = require('assert');
const modulePath = require.resolve('../utils/cloud-mode.js');

function loadMode({ platform, query, globalMode }) {
  delete require.cache[modulePath];
  global.wx = {
    getLaunchOptionsSync: () => ({ query: query || {} }),
    getDeviceInfo: () => ({ platform: platform || '' }),
    getSystemInfoSync: () => ({ platform: platform || '' })
  };
  global.getApp = () => globalMode === undefined
    ? null
    : { globalData: { cloudReadOnly: globalMode } };
  return require('../utils/cloud-mode.js');
}

let mode = loadMode({ platform: 'devtools' });
assert.strictEqual(mode.resolveCloudReadOnlyMode(), true, '开发者工具必须默认只读');
assert.strictEqual(mode.isCloudReadOnlyMode(), true, '无 app 实例时也必须识别开发者工具');

mode = loadMode({ platform: 'devtools', query: { cloudWriteTest: '1' } });
assert.strictEqual(mode.resolveCloudReadOnlyMode(), false, '开发者工具显式授权后才允许写入');

mode = loadMode({ platform: 'ios' });
assert.strictEqual(mode.resolveCloudReadOnlyMode(), false, '真机默认保持正常同步');

mode = loadMode({ platform: 'android', query: { cloudReadOnly: '1' } });
assert.strictEqual(mode.resolveCloudReadOnlyMode(), true, '真机显式只读参数必须生效');

mode = loadMode({ platform: 'ios', globalMode: true });
assert.strictEqual(mode.isCloudReadOnlyMode(), true, 'app 级只读状态优先于运行环境');

const result = mode.createCloudReadOnlyResult('sync-test');
assert.deepStrictEqual(result, {
  ok: true,
  skipped: true,
  reason: 'cloud_read_only',
  operation: 'sync-test'
});

process.stdout.write('cloud-read-only: PASS\n');
