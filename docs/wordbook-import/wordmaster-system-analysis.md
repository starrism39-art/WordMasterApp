# WordMaster词书系统设计分析

日期：2026-08-20

## 结论

当前 WordMaster 的云端词书不是数据库 collection 模式，而是 CloudBase Storage JSON 模式。

现有学习、复习、统计和同步记录仍然围绕 `wordbookId` 关联：

```text
词书配置(data/wordbooks-simple.js)
  -> 云端词书映射(utils/cloud-wordbook-loader.js)
  -> CloudBase Storage: wordbooks/*.json
  -> generateWordsForBook(...)
  -> 学习页 / 复习页
  -> 本地 wordMastery / learningProgress / learning_records
  -> CloudBase collections: word_mastery / learning_progress / learning_records / preview_state / student_statistics
  -> 统计与抗遗忘复习
```

## 云端已有词书

只读检查 CloudBase Storage `wordbooks/` 目录，当前已有 7 个词书文件：

- `wordbooks/gaokao_reading_words.json`
- `wordbooks/new_curriculum_senior_words.json`
- `wordbooks/senior_exam_syllabus_words.json`
- `wordbooks/senior_exam_syllabus_level_0_words.json`
- `wordbooks/senior_exam_syllabus_level_1_words.json`
- `wordbooks/senior_exam_syllabus_level_2_words.json`
- `wordbooks/senior_real_words.json`

这些文件通过 `utils/cloud-wordbook-loader.js` 的 `CLOUD_WORDBOOK_MAP` 暴露给小程序。

## 词书结构

本地词书入口位于 `data/wordbooks-simple.js`，核心字段：

- `id`: 词书唯一 ID，也是学习记录、掌握记录、进度统计的关联键
- `title`: 小程序列表显示名称
- `description`: 描述文案
- `category`: `primary` / `junior` / `senior`
- `grade`
- `region`
- `version`
- `totalWords`
- `words`: 小样本兜底词，云端词书真实数据不放在主包内

云端词书文件本身是数组。为兼容现有流程，导入后每个单词至少包含：

- `word`
- `phonetic`
- `pos`
- `meaning`
- `definition`
- `order`
- `wordbookId`

现有页面主要读取 `word`、`phonetic`、`meaning`。新增字段会被保留，不破坏旧流程。

## 单词顺序与 ID

导入不按字母排序。`order` 按 PDF 出现顺序从 1 开始。

学习页会通过 `assignStableWordIds(words, wordbookId)` 生成稳定学习 ID，形如：

```text
junior_exam_syllabus_education
```

重复单词会获得稳定 occurrence 后缀，避免一个词覆盖另一个位置。

## 导入要求

- CloudBase 只新增 `wordbooks/junior_exam_syllabus_words.json`
- 不新建、删除或修改数据库 collection
- 不修改学习算法
- 不修改同步架构
- 不改已有用户数据
- 不覆盖已有词书文件
- 释义字段 `meaning` 必须包含词性，例如 `n. 教育`
- PDF、Excel、CSV 都统一转换为同一标准 JSON

