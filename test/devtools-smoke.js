'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const {
  collectPageRoutes,
  normalizeRoute,
  readJson,
  resolveMiniProgramRoot
} = require('./page-manifest');
const smokeConfig = require('./page-smoke.config');

const projectPath = path.resolve(__dirname, '..');
const { miniProgramRoot } = resolveMiniProgramRoot(projectPath);
const appConfig = readJson(path.join(miniProgramRoot, 'app.json'));
const registeredRoutes = new Set(collectPageRoutes(appConfig));
const cliPath = process.env.WECHAT_DEVTOOLS_CLI || [
  'D:',
  '__01_\u5f00\u53d1\u5de5\u5177',
  '\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177',
  '\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177',
  'cli.bat'
].join('\\');
const autoPort = Number(process.env.WECHAT_DEVTOOLS_AUTO_PORT || 9420);
const options = parseOptions(process.argv.slice(2));
const artifactPath = path.resolve(
  projectPath,
  options.artifacts || process.env.WECHAT_SMOKE_ARTIFACTS || 'test-results/page-smoke'
);

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
    throw new Error(`安装 miniprogram-automator 失败，退出码 ${result.status}`);
  }
}

function enableAutomation() {
  if (!fs.existsSync(cliPath)) {
    throw new Error(
      `找不到微信开发者工具 CLI: ${cliPath}\n` +
      '请设置 WECHAT_DEVTOOLS_CLI 为 cli.bat（Windows）或 cli（macOS）的完整路径。'
    );
  }

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
  const child = childProcess.spawn('cmd.exe', ['/d', '/s', '/c', command], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  child.unref();

  if (child.pid) {
    process.stdout.write(`WeChat DevTools automation starting on port ${autoPort} (pid ${child.pid})\n`);
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
        reject(new Error(`等待微信开发者工具自动化端口 ${port} 超时`));
        return;
      }
      setTimeout(tryConnect, 500);
    }

    tryConnect();
  });
}

async function run() {
  const scenarios = resolveScenarios(options);
  validateScenarios(scenarios);
  const automator = loadAutomator();

  enableAutomation();
  await waitForPort(autoPort, 30000);

  const miniProgram = await automator.connect({
    wsEndpoint: `ws://127.0.0.1:${autoPort}`
  });
  await settleMiniProgramLaunch(miniProgram);

  const runtimeEvents = [];
  let activeScenario = null;
  miniProgram.on('console', event => {
    const level = getConsoleLevel(event);
    if (activeScenario && ['error', 'assert'].includes(level)) {
      runtimeEvents.push(normalizeRuntimeEvent('console', activeScenario.name, event));
    }
  });
  miniProgram.on('exception', event => {
    if (activeScenario) {
      runtimeEvents.push(normalizeRuntimeEvent('exception', activeScenario.name, event));
    }
  });

  const results = [];
  try {
    for (let index = 0; index < scenarios.length; index += 1) {
      const scenario = scenarios[index];
      activeScenario = scenario;
      process.stdout.write(`[${index + 1}/${scenarios.length}] ${scenario.name} ... `);
      const eventStart = runtimeEvents.length;
      const result = await checkScenario(miniProgram, scenario);
      const scenarioEvents = runtimeEvents.slice(eventStart);
      result.runtimeErrors = findRuntimeErrors(scenarioEvents, scenario.ignoreConsoleErrors || []);
      result.ok = result.pathOk && result.renderOk && result.runtimeErrors.length === 0;

      if (!result.ok) {
        result.screenshot = await captureFailure(miniProgram, scenario);
      }
      results.push(result);
      process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'}\n`);
    }
  } finally {
    activeScenario = null;
    await miniProgram.disconnect();
  }

  printResults(results, options.profile);
  const failed = results.filter(item => !item.ok);
  if (failed.length > 0) {
    throw new Error(`${failed.length} 个页面烟测失败`);
  }
}

async function settleMiniProgramLaunch(miniProgram) {
  try {
    await miniProgram.reLaunch('/pages/index/index');
  } catch (error) {
    process.stdout.write(`Warm-up launch failed, continuing: ${formatValue(error)}\n`);
  }
  await new Promise(resolve => setTimeout(resolve, smokeConfig.initialSettleMs || 3000));
}

async function checkScenario(miniProgram, scenario) {
  const expectedPath = normalizeRoute(scenario.expectedPath || scenario.route);
  const methods = scenario.navigation || ['reLaunch'];
  let page = null;
  let method = methods[0];
  let navigationError = null;

  for (const candidate of methods) {
    method = candidate;
    try {
      page = await miniProgram[candidate](scenario.route);
      if (page && page.path === expectedPath) {
        break;
      }
    } catch (error) {
      navigationError = error;
    }
  }

  if (page) {
    await page.waitFor(scenario.settleMs || smokeConfig.settleMs || 1000);
  }

  const actualPath = page ? page.path : '';
  const pathOk = actualPath === expectedPath;
  const selectorResults = [];

  if (pathOk) {
    for (const selector of scenario.selectors || []) {
      const elements = await page.$$(selector);
      selectorResults.push({ selector, count: elements.length });
    }
  }

  const minimumElements = Number(scenario.minimumElements || 1);
  const renderOk = pathOk && selectorResults.every(item => item.count >= minimumElements);

  return {
    name: scenario.name,
    route: scenario.route,
    method,
    expected: expectedPath,
    actual: actualPath,
    pathOk,
    renderOk,
    selectors: selectorResults,
    navigationError: navigationError ? formatValue(navigationError) : null
  };
}

function findRuntimeErrors(events, ignorePatterns) {
  const patterns = ignorePatterns.map(pattern => pattern instanceof RegExp ? pattern : new RegExp(pattern));

  return events.filter(event => {
    const isError = event.kind === 'exception' ||
      (event.kind === 'console' && ['error', 'assert'].includes(event.level));
    return isError && !patterns.some(pattern => pattern.test(event.message));
  });
}

function normalizeRuntimeEvent(kind, scenarioName, event) {
  const level = getConsoleLevel(event);
  const messageSource = event && Object.prototype.hasOwnProperty.call(event, 'args')
    ? event.args
    : event;

  return {
    kind,
    scenario: scenarioName,
    level,
    message: formatValue(messageSource)
  };
}

function getConsoleLevel(event) {
  return String(event && (event.type || event.level) || '').toLowerCase();
}

function formatValue(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

async function captureFailure(miniProgram, scenario) {
  fs.mkdirSync(artifactPath, { recursive: true });
  const safeName = scenario.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-');
  const screenshotPath = path.join(artifactPath, `${safeName}.png`);

  try {
    await miniProgram.screenshot({ path: screenshotPath });
    return path.relative(projectPath, screenshotPath).replace(/\\/g, '/');
  } catch (error) {
    return `截图失败: ${formatValue(error)}`;
  }
}

function resolveScenarios(parsedOptions) {
  if (parsedOptions.routes.length > 0) {
    return parsedOptions.routes.map(route => ({
      name: normalizeRoute(route),
      route: route.startsWith('/') ? route : `/${route}`,
      navigation: ['reLaunch'],
      selectors: ['.container'],
      minimumElements: 1
    }));
  }

  const scenarios = smokeConfig.profiles[parsedOptions.profile];
  if (!scenarios) {
    throw new Error(
      `未知烟测配置 ${parsedOptions.profile}，可选值: ${Object.keys(smokeConfig.profiles).join(', ')}`
    );
  }
  return scenarios;
}

function validateScenarios(scenarios) {
  for (const scenario of scenarios) {
    const route = normalizeRoute(scenario.route);
    if (!registeredRoutes.has(route)) {
      throw new Error(`烟测页面未在 app.json 注册: ${route}`);
    }
    for (const method of scenario.navigation || []) {
      if (!['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'].includes(method)) {
        throw new Error(`不支持的页面跳转方式: ${method}`);
      }
    }
  }
}

function parseOptions(args) {
  const parsed = {
    profile: process.env.WECHAT_SMOKE_PROFILE || smokeConfig.defaultProfile,
    routes: (process.env.WECHAT_SMOKE_ROUTES || '').split(',').map(item => item.trim()).filter(Boolean),
    artifacts: ''
  };

  for (const argument of args) {
    if (argument.startsWith('--profile=')) {
      parsed.profile = argument.slice('--profile='.length);
    } else if (argument.startsWith('--routes=')) {
      parsed.routes = argument.slice('--routes='.length).split(',').map(item => item.trim()).filter(Boolean);
    } else if (argument.startsWith('--artifacts=')) {
      parsed.artifacts = argument.slice('--artifacts='.length);
    } else {
      throw new Error(`未知参数: ${argument}`);
    }
  }

  return parsed;
}

function printResults(results, profile) {
  const summary = {
    profile,
    passed: results.filter(item => item.ok).length,
    failed: results.filter(item => !item.ok).length,
    results
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

run().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
