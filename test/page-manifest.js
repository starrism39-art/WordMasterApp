'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    error.message = `无法读取 JSON ${filePath}: ${error.message}`;
    throw error;
  }
}

function resolveMiniProgramRoot(projectPath) {
  const projectConfigPath = path.join(projectPath, 'project.config.json');
  const projectConfig = readJson(projectConfigPath);
  const configuredRoot = projectConfig.miniprogramRoot || '.';
  return {
    projectConfig,
    projectConfigPath,
    miniProgramRoot: path.resolve(projectPath, configuredRoot)
  };
}

function collectPageRoutes(appConfig) {
  const routes = [];

  for (const pagePath of appConfig.pages || []) {
    routes.push(normalizeRoute(pagePath));
  }

  const subpackages = appConfig.subpackages || appConfig.subPackages || [];
  for (const subpackage of subpackages) {
    const root = normalizeRoute(subpackage.root || '');
    for (const pagePath of subpackage.pages || []) {
      routes.push(normalizeRoute(path.posix.join(root, pagePath)));
    }
  }

  return routes;
}

function normalizeRoute(route) {
  return String(route || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

module.exports = {
  collectPageRoutes,
  normalizeRoute,
  readJson,
  resolveMiniProgramRoot
};
