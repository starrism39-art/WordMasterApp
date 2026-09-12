# Final-D Git 安全封板记录

日期：2026-09-12。本轮仅封板已验收的 READY_FOR_ROLLOUT 代码与长期文档，不重跑功能验收，不操作CloudBase。

## 起点与现有提交

- 工作区：`D:\WordMasterApp-Membership-Final-D`。
- 分支：`codex/membership-final-d-release-gates`；远端：`origin`。
- Final-C基线：`9367a23bcc35e79ccc9e6dbeacd5d7a6d3bbe322`。
- 封板前HEAD、本地tracking及远端分支均为 `b8ee6e5741fa2d3e26a612a88d8cc9d2015077fe`，ahead/behind为0/0。
- `584a786cf334feed6bc891ba07f811a20f13dd6c`：`feat: add Final-D membership reminders and release channel gates`，正式提醒、渠道门禁及长期定向测试。
- `b8ee6e5741fa2d3e26a612a88d8cc9d2015077fe`：`docs: record Final-D real refund and device acceptance`，真实TEST退款及两端恢复最终记录。

## 最终正式文件清单

相对Final-C基线共11个正式差异文件：

- `cloudfunctions/membership-presentation/model.js`
- `cloudfunctions/membership-presentation/reminders.js`
- `subpages/membership/index.wxml`
- `subpages/membership/page.js`
- `utils/membership-channel-gates.js`
- `utils/membership-reminders.js`
- `utils/membership-ui-client.js`
- `test/membership-final-d/pages.test.js`
- `test/membership-final-d/reminders.test.js`
- `specs/membership-final-d/README.md`
- `specs/membership-final-d/GIT-SEAL.md`

本轮不新增业务源码。只补此封板记录、明确README的Android/TEST退款证据边界，并将执行用 `specs/membership-final-d/GOAL.md` 从Git最终文件树移出。Goal原文件保留本机未跟踪，内容未删除；此前正确提交不改写，因此旧提交仍可看到该无敏感信息的历史执行文件。

## 排除与扫描

`project.private.config.json` 为被既有规则忽略的本机TEST启动条件，不进入Git。原始截图、二维码及自动化脚本、TLS日志、一次性probe、平台响应、DPAPI备份、缓存和打包产物均在仓库外，不暂存、不删除。封板证据目录为 `D:\membership-backups\final-d-git-seal-20260912`，之前验收证据在 `D:\membership-backups\final-d-20260912`。

扫描覆盖Final-D已有两笔历史提交的变更文件、当前正式差异及最终staged内容。检查9项本机加密备份中的真实密钥值、2项受控身份、4项完整支付/退款标识，并补充密钥格式、私钥、完整OPENID及敏感字面量扫描；扫描程序只输出命中类型和路径，不输出敏感值。未发现真实Secret或完整身份进入本次Final-D提交范围。字段名、合成测试值、AppID、商品信息、脱敏订单及身份指纹不作泄密误判。

## 最小静态检查

- 基线至HEAD及最终staged的 `git diff --check`。
- 8个直接变更JS及其静态引用、生成打包入口，共40个JS语法检查；未执行测试或运行云函数。
- 5个JSON解析；82处相对引用全部解析成功。
- 复用既有 `scripts/package-membership-final-b.js` 在仓库外生成静态包，入口和依赖完整，新增 `reminders.js` 被纳入；未修改Final-B打包源码，未安装或部署。
- 支付核心、Stage5、会员核心、Final-A/B/C及同步代码均不在本轮修改范围。功能结论全部继承既有最终验收。

## 验收证据与持续关闭项

README已长期记录真实Android TEST支付、用户本人完成0.01元退款并实际到账、refunded/revoked、account/ledger/grant一致、无负时长、独立gift不变、可追溯自动退款审计链、真实补偿不regrant及管理入口分层保护证据。手机和Windows TEST页均实际刷新为expired，无有效到期时间。手机截图接口不支持的限制保留；不得把Windows恢复证据或本地保护检查夸大成所有渠道真实支付/退款验证。

正式399购买关闭，Windows/iOS及其他未验证购买渠道关闭；Android为当前已真实验证的购买渠道。62名历史候选未rollout，普通真实老师个人五天缓冲未启动。历史已付费名单、内部long-term名单待负责人提供，真实客服方式为发布前配置项。未发布、未Release RC、未merge或tag。

## 提交与推送核对

本文件所在文档提交是本轮唯一新增提交。最终SHA以该提交实际HEAD为准，避免自引用SHA造成无意义补提交。推送限 `origin/codex/membership-final-d-release-gates`；只有push成功且重新读取local HEAD、tracking与远端分支三者一致、ahead/behind=0/0后才报告 Git Seal PASS。最终实际Git回读结果保存在仓库外封板证据中。

封板不改变CloudBase业务状态，不再次付款/退款，不rollout、开399、批量补录、启动缓冲或修改普通老师权益。完成Git Seal后立即停止。
