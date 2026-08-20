# 初中考纲词书导入报告

日期：2026-08-20

## 来源

- PDF：`D:\xwechat_files\wxid_iv7i41yq4sgp22_8faf\msg\file\2026-08\02_初中1600考纲词(2026最新_PDF可编辑)(1).pdf`
- 截图范围：`【Round 1_听音频跟读、理解记忆单词】`，表头为 `词汇 / 英文释义 / 音标 / 词性 / 中文释义`

## 导入工具

新增 `tools/wordbook-import/wordmaster_import_pipeline.py`。

支持：

- PDF：按 profile 定位表格和章节
- CSV：按字段别名映射
- Excel：读取首个工作表，按字段别名映射

统一输出字段：

- `word`
- `phonetic`
- `pos`
- `meaning`
- `definition`
- `order`
- `wordbookId`

上传脚本：`tools/wordbook-import/upload_cloudbase_wordbook.ps1`，默认 dry-run，只有传 `-Execute` 才写 CloudBase，并拒绝覆盖已存在对象。

## 提取范围与数量

严格截图同款 Round 1 表格：

- 页码：2、6、10……230
- 页数：58
- 数量：1450
- 异常：0
- 重复单词：2 个，`fight`、`miss`

完整上线候选：

- Round 1 表格：1450
- 其他功能词附录：119
- 总数：1569
- 异常：0
- 删除数量：0
- 重复单词：31 个，保留原 PDF 顺序，不去重

说明：文件名写“1600”，但按截图指定表格和同书功能词附录逐项提取后，实际可确认词条为 1569。PDF 第 234 页数词表不是截图同款词条表，未纳入；第 241-242 页是不规则动词汇总，也未纳入。

## 输出文件

- 完整候选：`D:\WordMasterApp\storage\wordbooks\junior_exam_syllabus_words.json`
- 完整报告：`D:\WordMasterApp\storage\wordbooks\junior_exam_syllabus_report.json`
- Round 1 对照：`D:\WordMasterApp\storage\wordbooks\junior_exam_syllabus_round1_words.json`
- Round 1 报告：`D:\WordMasterApp\storage\wordbooks\junior_exam_syllabus_round1_report.json`

## CloudBase 上传方案

新增文件：

```text
wordbooks/junior_exam_syllabus_words.json
```

新增小程序入口：

```text
id: junior_exam_syllabus
title: 初中考纲词书
category: junior
totalWords: 1569
```

影响范围：

- 新增 1 个云端 Storage JSON
- 新增 1 个初中词书入口
- 不新增 collection
- 不改 `word_mastery`
- 不改 `learning_records`
- 不改 `learning_progress`
- 不改 `preview_state`
- 不改 `student_statistics`

## 已完成的本地验证

- 本地转换：1569 条，异常 0
- Round 1 对照转换：1450 条，异常 0
- 单项云端词书加载测试：通过
- 本地全量逻辑测试基线：60 项通过
- CloudBase 上传：`wordbooks/junior_exam_syllabus_words.json` 已上传
- CloudBase 下载核对：1569 条，MD5 与本地上传文件一致
- WeChat DevTools 核心烟测：7/7 通过

早前一次 WeChat DevTools 基线烟测在 automator 热启动阶段超时；最终重跑已进入页面并通过 7/7 核心烟测。
