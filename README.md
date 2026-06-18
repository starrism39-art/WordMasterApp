<p align="center">
  <img src="images/app_logo_new.jpg" width="120" height="120" alt="啃词 Logo">
</p>

<h1 align="center">啃词 · WordMaster</h1>

<p align="center">
  一款面向中小学英语词汇学习的微信小程序，支持多教材版本、多学生管理、智能复习与遗忘曲线。
</p>

<br>

## 功能

- **多教材词汇库** — 支持人教、译林、新课标等教材版本，涵盖七至九年级及高中、高考词汇，共 40+ 词库
- **多学生档案** — 一个账号下管理多个学生的学习进度，适合家长或老师使用
- **学习 + 复习闭环** — 学生模式学习新词，艾宾浩斯遗忘曲线自动安排复习
- **智能过滤** — 已掌握的词汇自动过滤，每次只学还没记住的
- **统计追踪** — 查看每日学习量、累计掌握量、复习正确率等统计
- **云同步** — 基于 CloudBase 的学习数据云端同步，换设备不丢进度
- **​​数据备份与恢复** — 本地和云端双向备份，版本升级自动备份
- **发音支持** — 内置音频引擎，自动降级兜底，单词发音覆盖率高

## 技术栈

| 层 | 技术 |
|---|---|
| 客户端 | 微信小程序原生 (WXML + WXSS + JavaScript) |
| 后端 | 腾讯云 CloudBase（云函数 + 云数据库 + 云存储） |
| 数据同步 | 自定义云同步引擎，冲突合并 |
| 遗忘算法 | 自定义基干艾宾浩斯遗忘曲线的复习过滤策略 |
| 构建 | 小程序原生构建 + 分包加载 |

## 项目结构

```
WordMasterApp/
├── pages/                    # 主包页面
│   ├── splash/               # 启动屏
│   ├── login/                # 登录
│   ├── index/               # 首页
│   ├── learning/            # 学习页
│   ├── students/            # 学生管理
│   └── review/              # 复习
├── subpages/                 # 分包页面（按功能拆分）
│   ├── wordbook/            # 词库选择
│   ├── stats/               # 学习统计
│   ├── records/             # 学习记录
│   ├── add-student/         # 添加学生
│   ├── student-list/        # 学生列表
│   ├── review-merged/       # 合并复习
│   ├── word-view/           # 单词详情
│   ├── grid-review/         # 网格复习
│   ├── data-backup/         # 数据备份
│   └── data-repair/         # 数据修复工具
├── components/               # 公共组件
├── utils/                    # 工具模块
│   ├── anti-forgetting-filter.js   # 遗忘曲线过滤
│   ├── stats-engine.js             # 统计引擎
│   ├── cloud-sync.js               # 云同步引擎
│   ├── data-migration.js           # 数据迁移
│   ├── audio-fallback.js           # 音频降级
│   └── safe-merge-restore.js       # 安全合并恢复
├── data/                     # 词库数据（按教材版本分册）
│   ├── wordbook-loader.js
│   └── 人教/译林/新课标/中考/高考 *.js
├── cloudfunctions/           # 云函数
│   ├── login/
│   ├── repairNames/
│   └── updateStudentStats/
├── images/                   # 图片资源
│   ├── app_logo_new.jpg
│   ├── student_avatar_new.jpg
│   └── avatar_default.png
├── custom-tab-bar/           # 自定义底部导航
├── app.js                    # 入口文件
├── app.json                  # 全局配置
└── project.config.json       # 小程序项目配置
```

## 上手运行

### 前置条件

1. [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 已安装
2. 拥有一个[微信小程序 AppID](https://mp.weixin.qq.com/)
3. （可选）开通 [腾讯云 CloudBase](https://cloud.tencent.com/product/tcb) 环境

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/你的用户名/WordMasterApp.git

# 打开微信开发者工具，导入项目目录
# 填入你的 AppID，项目配置已预设
```

导入后用开发者工具直接预览即可。无需额外安装依赖（小程序框架内置）。

### CloudBase 配置（可选，用于云同步）

1. 在 [CloudBase 控制台](https://console.cloud.tencent.com/tcb) 创建环境
2. 将环境 ID 填入 `.env.local`：

```
ENV_ID=你的环境ID
```

3. 部署云函数到 CloudBase 环境

> 如果未配置 CloudBase，小程序的核心学习功能依然可以本地使用，只是无法跨设备同步。

## 词库说明

项目包含的词汇数据来源于国内教材（人教版、译林版、新课标等）公开词汇表及中高考大纲词汇。这些数据仅作为学习工具辅助使用，版权归原出版方所有。如涉及侵权，请联系删除。

## License

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。
