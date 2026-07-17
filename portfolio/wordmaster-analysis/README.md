# 啃词 / WordMaster — 数据分析作品集

## 目录结构

```
wordmaster-analysis/
├── README.md                                  # 本文件
├── dashboard.html                             # 交互式可视化仪表盘（Plotly.js）
├── wordmaster_analysis.ipynb                  # Jupyter Notebook 完整分析管线
├── src/
│   └── simulate_wordmaster_data.py            # Python 数据模拟与分析脚本
├── output/
│   ├── raw_data.json                          # 原始仿真数据
│   ├── analysis_results.json                  # 完整分析指标结果
│   └── dashboard_data.json                    # 供 dashboard.html 使用的精简数据
└── reports/                                   # 预留：导出报告
```

## 项目背景

WordMaster（啃词）是一款面向英语教师的微信背词小程序。核心挑战在于：
- 多台设备离线/在线交替使用，需保证 wordMastery 数据的"只进不退"
- 三层嵌套 JSON 结构（studentId → wordbookId → wordId → Record）的冲突合并
- 弱网环境下网络请求频繁超时，需持久化重试队列

本分析作品集基于项目实际代码结构（`cloud-sync.js`、`stats-engine.js`、`cloud-migration.js`、`safe-merge-restore.js`）生成仿真数据，进行多维度业务分析。

## 技能展示

| 能力维度 | 本作品集中的体现 |
|---------|----------------|
| **数据处理** | 三层嵌套 JSON 扁平化、时间序列清洗、多源数据关联 |
| **指标建模** | 掌握率、留存率、DAU/WAU、连续打卡、遗忘曲线代理、容灾保护评估 |
| **数据分析** | 复习次数 vs 掌握率的 S 型曲线验证、间隔-留存率分布、词书难度对比 |
| **可视化** | Plotly 交互式仪表盘、Matplotlib/Seaborn 静态图表 |
| **业务理解** | 从数据结论推导教学策略建议（如调整 nextReviewTime 上限、推送复习提醒） |
| **工程视角** | 基于代码层的容灾协议量化评估，数据分析与工程实现的双向映射 |

## 如何使用

### 方式一：HTML 交互式仪表盘（推荐，面试现场展示）

直接用浏览器打开 `dashboard.html`。所有图表通过 Plotly.js 动态渲染，包含 6 个板块：
1. KPI 总览卡片
2. 复习次数 vs 掌握率曲线（遗忘曲线代理）
3. 间隔-留存曲线
4. DAU/WAU 时间序列
5. 打卡天数分布
6. 词书对比 + 容灾协议评估

**注意**：dashboard.html 需要从 `output/dashboard_data.json` 加载数据，请用本地 HTTP Server 打开（如 `python -m http.server`）或在 VS Code 中用 Live Server 插件。

### 方式二：Jupyter Notebook

运行 `wordmaster_analysis.ipynb`（需安装 pandas、matplotlib、seaborn）：
```bash
pip install pandas matplotlib seaborn jupyter
jupyter notebook wordmaster_analysis.ipynb
```

### 方式三：运行分析脚本

```bash
python src/simulate_wordmaster_data.py
```

该脚本会重新生成所有数据并输出到 `output/` 目录。

## 数据生成逻辑

仿真数据基于项目实际代码的数据结构生成：
- **wordMastery**：三层嵌套（studentId → wordbookId → wordId），每层包含 `reviewCount`、`firstMasteryTime`、`lastReviewTime`、`mastered`、`difficult`、`antiForgettingSeed`、`reviewTimeline` 等字段，与 `cloud-migration.js` 中的 `mergeWordMasteryRecord` 数据结构一致
- **learningRecords**：每次学习会话的快照，包含 `notMasteredWordIds`、`difficultWordIds`、`masteredWords` 等字段
- **stats_cache**：`stats_{studentId}` 格式的统计缓存，与 `stats-engine.js` 的 `saveStudentStats` 一致
- **pending queue**：`pendingWordMasterySync` 格式的失败重试队列，与 `cloud-sync.js` 一致
- 学习行为模拟符合 Ebbinghaus 遗忘曲线（间隔指数增长、正确率递增）

## 面试问答示例

**Q：这份分析的数据来源是什么？**
A：基于项目真实代码结构生成的仿真数据。我阅读了项目的 `cloud-sync.js`、`stats-engine.js`、`cloud-migration.js` 等核心模块，确保 JSON 的数据结构、字段名、嵌套层级与线上数据完全一致，然后编写了 `simulate_wordmaster_data.py` 进行数据生成。

**Q：容灾协议的保护效果是怎么算出来的？**
A：我分析了 `syncWordMasteryBatch` 中的 5 维防退化校验逻辑（reviewCount、lastReviewTime、mastered、difficult、isLearned 五维比对），以及 `markPendingSync` + `retryPendingSyncs` 的持久化重试机制。然后根据典型的离线冲突率（18%）、防退化拦截率（60%）、pending 恢复率（92%）进行估算。如果接入真实数据，可以用 `__syncStatus` 中的 `lastOk` 和 `lastFail` 时间戳做更精确的统计。
