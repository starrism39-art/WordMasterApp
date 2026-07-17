'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  collectPageRoutes,
  normalizeRoute,
  readJson,
  resolveMiniProgramRoot
} = require('./page-manifest');

const projectPath = path.resolve(__dirname, '..');
const {
  projectConfig,
  miniProgramRoot
} = resolveMiniProgramRoot(projectPath);
const appConfigPath = path.join(miniProgramRoot, 'app.json');
const appConfig = readJson(appConfigPath);
const pageRoutes = collectPageRoutes(appConfig);
const failures = [];

check(projectConfig.compileType === 'miniprogram', 'project.config.json 的 compileType 必须是 miniprogram');
check(typeof projectConfig.appid === 'string' && projectConfig.appid.trim(), 'project.config.json 必须配置 appid');
check(pageRoutes.length > 0, 'app.json 至少需要注册一个页面');
check(new Set(pageRoutes).size === pageRoutes.length, 'app.json 中不能注册重复页面');

for (const tabItem of (appConfig.tabBar && appConfig.tabBar.list) || []) {
  const tabRoute = normalizeRoute(tabItem && tabItem.pagePath);
  check(pageRoutes.includes(tabRoute), `tabBar 页面未在 app.json 注册: ${tabRoute}`);
}

for (const route of pageRoutes) {
  checkPageContract(route);
}

if (failures.length > 0) {
  process.stderr.write(`page-contract: FAIL (${failures.length})\n`);
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(`page-contract: PASS (${pageRoutes.length} pages)\n`);

function checkPageContract(route) {
  const pageBasePath = path.join(miniProgramRoot, ...route.split('/'));
  const requiredExtensions = ['.js', '.json', '.wxml', '.wxss'];

  for (const extension of requiredExtensions) {
    const filePath = `${pageBasePath}${extension}`;
    const relativePath = path.relative(projectPath, filePath);
    check(fs.existsSync(filePath), `页面文件缺失: ${relativePath}`);
    if (fs.existsSync(filePath)) {
      check(fs.statSync(filePath).size > 0, `页面文件为空: ${relativePath}`);
    }
  }

  const pageJsonPath = `${pageBasePath}.json`;
  if (fs.existsSync(pageJsonPath)) {
    try {
      const pageConfig = readJson(pageJsonPath);
      checkLocalComponents(pageJsonPath, pageConfig.usingComponents || {});
    } catch (error) {
      failures.push(error.message);
    }
  }

  const wxmlPath = `${pageBasePath}.wxml`;
  if (fs.existsSync(wxmlPath)) {
    checkLocalReferences(wxmlPath, /<(?:import|include)\b[^>]*\bsrc=["']([^"']+)["']/g);
  }

  const wxssPath = `${pageBasePath}.wxss`;
  if (fs.existsSync(wxssPath)) {
    checkLocalReferences(wxssPath, /@import\s+["']([^"']+)["']/g);
  }
}

function checkLocalComponents(configPath, components) {
  for (const [name, componentReference] of Object.entries(components)) {
    if (!componentReference || /^(plugin|ext):\/\//.test(componentReference)) {
      continue;
    }

    const componentBasePath = componentReference.startsWith('/')
      ? path.join(miniProgramRoot, ...componentReference.slice(1).split('/'))
      : path.resolve(path.dirname(configPath), componentReference);

    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      check(
        fs.existsSync(`${componentBasePath}${extension}`),
        `组件 ${name} 缺少 ${extension}: ${path.relative(projectPath, componentBasePath)}${extension}`
      );
    }
  }
}

function checkLocalReferences(sourcePath, pattern) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  let match = pattern.exec(source);

  while (match) {
    const reference = match[1];
    if (!/^(https?:|data:|plugin:|ext:)/.test(reference)) {
      const targetPath = reference.startsWith('/')
        ? path.join(miniProgramRoot, ...reference.slice(1).split('/'))
        : path.resolve(path.dirname(sourcePath), reference);
      check(
        fs.existsSync(targetPath),
        `本地引用不存在: ${path.relative(projectPath, sourcePath)} -> ${reference}`
      );
    }
    match = pattern.exec(source);
  }
}

function check(condition, message) {
  try {
    assert.ok(condition, message);
  } catch (error) {
    failures.push(error.message);
  }
}
