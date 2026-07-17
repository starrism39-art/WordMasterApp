'use strict';

const path = require('path');
const childProcess = require('child_process');
const net = require('net');

const projectPath = path.resolve(__dirname, '..');
const cliPath = process.env.WECHAT_DEVTOOLS_CLI || [
  'D:',
  '__01_\u5f00\u53d1\u5de5\u5177',
  '\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177',
  '\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177',
  'cli.bat'
].join('\\');
const autoPort = Number(process.env.WECHAT_DEVTOOLS_AUTO_PORT || 9420);
const appConfig = require(path.join(projectPath, 'app.json'));
const tabPagePaths = new Set(((appConfig.tabBar && appConfig.tabBar.list) || [])
  .map(item => item && item.pagePath)
  .filter(Boolean));

const routes = (process.env.WECHAT_SMOKE_ROUTES || [
  '/pages/index/index',
  '/pages/students/students',
  '/pages/learning/learning',
  '/pages/review/review',
  '/subpages/wordbook/wordbook',
  '/subpages/stats/stats',
  '/subpages/records/records'
].join(','))
  .split(',')
  .map(route => route.trim())
  .filter(Boolean);

function loadAutomator() {
  const tempInstallPath = path.join(process.env.TEMP || '', 'wordmaster-automator-check');
  const candidates = [
    'miniprogram-automator',
    path.join(tempInstallPath, 'node_modules', 'miniprogram-automator')
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known location.
    }
  }

  installAutomator(tempInstallPath);
  return require(path.join(tempInstallPath, 'node_modules', 'miniprogram-automator'));
}

function installAutomator(targetPath) {
  const result = childProcess.spawnSync('npm', [
    'install',
    '--prefix',
    targetPath,
    'miniprogram-automator@0.12.1'
  ], {
    stdio: 'inherit',
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Failed to install miniprogram-automator, exit code ${result.status}`);
  }
}

function enableAutomation() {
  const args = [
    'auto',
    '--project',
    projectPath,
    '--auto-port',
    String(autoPort),
    '--trust-project',
    '--lang',
    'zh'
  ];
  const command = [cliPath, ...args].map(quoteCommandPart).join(' ');
  const result = childProcess.spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
    stdio: 'inherit',
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Failed to enable WeChat DevTools automation, exit code ${result.status}`);
  }
}

function quoteCommandPart(value) {
  const text = String(value);
  if (!/[\s"&<>|^]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '\\"')}"`;
}

function waitForPort(port, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function tryConnect() {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(1000);

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('timeout', () => {
        socket.destroy();
        retry();
      });
      socket.once('error', () => {
        socket.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for WeChat DevTools automation port ${port}`));
        return;
      }
      setTimeout(tryConnect, 500);
    }

    tryConnect();
  });
}

async function run() {
  const automator = loadAutomator();
  enableAutomation();
  await waitForPort(autoPort, 15000);

  const miniProgram = await automator.connect({
    wsEndpoint: `ws://127.0.0.1:${autoPort}`
  });
  await new Promise(resolve => setTimeout(resolve, 3000));

  const results = [];
  try {
    for (const route of routes) {
      const expectedPath = route.replace(/^\//, '');
      try {
        const preferredMethod = tabPagePaths.has(expectedPath) ? 'switchTab' : 'reLaunch';
        const methods = preferredMethod === 'switchTab'
          ? ['switchTab', 'reLaunch']
          : ['reLaunch'];
        const result = await openRoute(miniProgram, route, expectedPath, methods);
        results.push({
          route,
          method: result.method,
          actual: result.actual,
          ok: result.ok
        });
      } catch (error) {
        results.push({
          route,
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      }
    }
  } finally {
    await miniProgram.disconnect();
  }

  console.log(JSON.stringify(results, null, 2));

  const failed = results.filter(item => !item.ok);
  if (failed.length > 0) {
    throw new Error(`${failed.length} route smoke check(s) failed`);
  }
}

async function openRoute(miniProgram, route, expectedPath, methods) {
  let last = { method: methods[0], actual: '' };

  for (const method of methods) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const page = await miniProgram[method](route);
      await page.waitFor(1800);
      last = { method, actual: page.path };
      if (page.path === expectedPath) {
        return { ...last, ok: true };
      }
    }
  }

  return { ...last, ok: false };
}

run().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
