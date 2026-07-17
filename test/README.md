# 页面自动化测试

本目录把页面质量检查分成两层：本地/CI 都能运行的页面契约检查，以及依赖微信开发者工具的真实页面烟测。

## 常用命令

```bash
# 页面契约 + 现有 Node.js 回归测试（不需要开发者工具）
npm test

# 只检查 app.json 中全部页面的文件、JSON、组件和本地引用
npm run test:pages

# 7 个核心页面的快速烟测
npm run test:smoke:core

# 14 个用户可达页面的完整烟测
npm run test:smoke

# 本地检查和完整烟测全部执行
npm run test:all
```

`npm test` 适合每次提交前运行，也会在 GitHub Actions 中自动执行。真实烟测会启动微信开发者工具，逐页验证：

- 页面能按预期路由打开；
- 页面根容器已经渲染；
- 页面加载期间没有未捕获异常或 `console.error`；
- 失败时在 `test-results/page-smoke/` 保存截图。

## 配置页面场景

在 `test/page-smoke.config.js` 中维护场景。新增普通页面时，先确保它已注册到 `app.json`，再加入 `core` 或 `full` 配置：

```js
{
  name: '页面名称',
  route: '/subpages/example/example?id=fixture-id',
  expectedPath: 'subpages/example/example',
  navigation: ['reLaunch'],
  selectors: ['.container', '.important-content'],
  minimumElements: 1,
  settleMs: 1200
}
```

若页面会输出一条已经确认无害、且短期无法消除的错误日志，可为该场景添加精确的 `ignoreConsoleErrors` 正则。不要使用宽泛规则掩盖未知异常。

## 环境变量和参数

- `WECHAT_DEVTOOLS_CLI`：微信开发者工具 CLI 的完整路径。
- `WECHAT_DEVTOOLS_AUTO_PORT`：自动化端口，默认 `9420`。
- `WECHAT_SMOKE_PROFILE`：`core` 或 `full`，默认 `full`。
- `WECHAT_SMOKE_ROUTES`：逗号分隔的临时路由列表，会覆盖 profile。
- `WECHAT_SMOKE_ARTIFACTS`：失败截图目录。

也可以临时运行指定页面：

```bash
node test/devtools-smoke.js --routes=/pages/index/index,/pages/learning/learning
```

Windows 默认兼容本项目当前开发者工具路径；其他机器请设置 `WECHAT_DEVTOOLS_CLI`。运行前确保开发者工具已开启“服务端口”。
