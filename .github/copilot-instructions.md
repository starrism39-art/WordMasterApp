# 项目级 Copilot 指令

## 项目概述
这是一个微信小程序项目（WordMasterApp），用于英语单词学习与管理。

## 技术栈
- 微信小程序原生框架
- 腾讯云 CloudBase（云开发）
- NoSQL 文档数据库
- JavaScript

## 编码规范
- 使用 ES6+ 语法
- 变量命名使用 camelCase
- 微信小程序 API 使用 wx. 前缀
- 云数据库操作使用 wx.cloud.database()
- 所有异步操作使用 async/await
- 错误处理要完整，关键操作要有 try-catch

## 文件组织
- pages/ - 主包页面
- subpages/ - 分包页面
- cloudfunctions/ - 云函数
- data/ - 词书数据
- utils/ - 工具函数
- components/ - 公共组件
- css/ - 样式文件

## 关键词书
- 词书数据在 data/ 目录下
- 词书加载器在 data/wordbook-loader.js
- 音频降级在 utils/audio-fallback.js
- 云同步在 utils/cloud-sync.js
