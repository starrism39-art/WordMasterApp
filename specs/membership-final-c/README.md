# WordMaster／啃词会员 Final-C 最终交付

状态：**PASS**。2026-09-11。仅本轮异常处理与运营能力；所有既有阶段结论继承，不重新审计。

1. **工作区 / branch / 起点**：`D:\WordMasterApp-Membership-Final-C`，`codex/membership-final-c-ops`，`4e05abb5aeebfc8719d64a783c37e8f3a900f3e8`。独立worktree；原入口、Final-A/B未开发。实现验收阶段没有commit/push；后续独立Git封板范围与静态证据见 `GIT-SEAL.md`。
2. **historical/backfill**：唯一可信teacherId解析、原paidAt/金额/依据及时间精度、固定12个月、签名preview/apply、付款依据跨请求/跨老师去重。已有区间冲突或证据不足进入可查询review；过期历史不重新起算。未操作真实名单。
3. **gift**：有限期、独立gift来源，经grant/ledger/account/audit写入；requestId幂等，保留其他权益。
4. **long-term**：独立internal_long_term来源、长期有效、重复请求幂等；付款与普通退款不缩短。未写真实内部人员。
5. **admin adjustment**：原因必填，独立admin_adjustment来源；支持具名增加补偿或撤销指定grant剩余权益，保留经办人、before/after、requestId与审计。没有直接改isVip/到期字段入口。
6. **PAYMENT_PENDING_REVIEW**：可查列表和脱敏订单、官方查单、记录独立证据、confirm或reject/hold。reject拒绝人工补开方案但保留待确认，不伪造付款失败、不诱导再付。普通展示模型输出“正在确认”，不暴露内部状态名；无UI源码改动。
7. **confirmPaidAndGrant**：复用冻结引擎；核对原订单商品快照、平台可信paidAt、金额/商品/身份/交易号；再查官方余额防止使用过期付款证据。重复确认只保留一个grant，事务包含权益与审计；拒绝自定义价格/期限。
8. **refund**：只消费平台最终事实，不提供发起退款入口。退款证据必须通过既有微信安全模式验签解密，管理员手填“退款成功”JSON也只进入review。成功写退款终态并审计；失败/部分退款保留权益或进入复核，不恢复常规按天退款规则。
9. **refunded regrant保护**：已退款订单再次confirm拒绝；同一退款重复处理不重复扣时，原引擎终态保护保持。
10. **多来源保护**：撤销只绑定该支付订单grant；gift、historical、long-term及其他支付grant不被覆写，剩余时段重排复用原算法，不产生负时长。未重复日期矩阵。
11. **管理员鉴权**：独立微信管理员名单或签名内部操作员名单；可信APPID/OPENID/SOURCE，或绑定函数/环境/操作内容的HMAC、时效和防重放；fail-closed，不复用repairNames或昵称。正式部署当前微信管理员0、内部操作员1、writeTeachers=0。
12. **audit**：权益修改及退款/确认审计与对应业务事务绑定；全部已鉴权读写尝试另记调用审计，支持脱敏查询。失败、证据记录及人工复核均留痕。11个相关集合均ADMINONLY。
13. **最小入口**：`membership_ops` Event云函数 + `scripts/membership-ops.js` 签名参数工具；具体字段、预览/执行、证据要求和恢复方式见 `OPERATIONS.md`。正式购买、rollout、五天缓冲不在入口动作中。
14. **正式交付文件**：长期源码、工具、定向测试与文档见下列清单；Goal草稿和临时云验收夹具不纳入Git。起点已有受Git管理源码未修改，支付核心、Final-A/B、frozen sync保持原样。
15. **部署**：正式 `membership_ops`，Nodejs18.15，Active。新增6个必要正式运营/订单集合并设ADMINONLY。独立临时 `membership_ops_validation` 与同名合成集合用于验收，函数已关闭并实测拒绝再次调用；保留合成证据，不删除其他数据。未更新其他运行函数。
16. **实现阶段冻结验证**：本地20/20；真实CloudBase事务+合成身份/平台适配11/11；正式入口受控老师只读查询、待复核、历史复核和审计查询成功，伪造管理员请求拒绝；Goal lint及新增JS语法通过；下载部署包与24个源码文件逐一一致。Git封板继承这些结论，不重跑业务测试。未将合成支付/退款表述为真实平台支付/退款。
17. **普通真实老师**：未修改。正式writeTeachers为空；11类受保护业务/会员集合前后记录数一致（只能作为辅助证据，主要边界由空写名单及隔离验证仓储保证）。
18. **真实支付**：0；没有创建正式399订单、拉起付款或开放购买。
19. **真实退款**：0；使用加密合成可信退款证据，退款处理代码/运营闭环已验证；**尚未执行真实平台退款端到端验收**。这不是一次真实微信平台退款，不宣称“真实退款PASS”。
20. **rollout**：未执行；62名候选和个人5天缓冲未启动。
21. **P0/P1**：本轮覆盖路径未发现未解决新增P0/P1。退款证据由“管理员声明”升级为平台加密通知验签，排除无可信事实撤销权益的入口。
22. **DEFER**：大型后台、批量导入美化、统计报表、真实名单/内部人员处理、真实退款实操、九宫格、iOS、会员/首页/学习UI、rollout、Release RC、正式发布。历史冻结矩阵、Android实付、Full Pull、repairNames和frozen sync未重跑。
23. **Final-C：PASS**。能力和受控验证闭环完成；未开放任何普通老师写入或正式购买。新业务数据名单和实际运营指令应另行给出。
24. **后续边界**：Git封板限独立分支提交和推送；完成后停止。任何真实老师权益操作、真实退款、rollout或正式发布均须另行明确授权。

会员 Final-C 异常处理与运营能力最小闭环 PASS；历史补录、gift、long-term、人工复核、退款与审计能力已具备，未操作普通真实老师、未开放正式399购买、未rollout。

## 文件清单

```text
cloudfunctions/membership-ops/config.example.json
cloudfunctions/membership-ops/grants.js
cloudfunctions/membership-ops/repository.js
cloudfunctions/membership-ops/runtime.js
cloudfunctions/membership_ops/index.js
scripts/membership-ops.js
scripts/package-membership-final-c.js
specs/membership-final-c/GIT-SEAL.md
specs/membership-final-c/OPERATIONS.md
specs/membership-final-c/README.md
test/membership-final-c/ops.test.js
```

## 可核对证据

仓库外证据目录：`D:\membership-backups\final-c-20260911`。

- `local-final-tests.txt`：20项最终定向测试。
- `cloud-validation-fc_mtx3pfyj.json`：11项合成云验收，RequestId `55d3af0d-a250-468a-ac89-e39594470134`。
- `main-listReview.json`、`main-listHistoricalReviews.json`、`main-listAudit.json`、`main-unauthorized.json`：正式入口调用与鉴权拒绝。
- `controlled-teacher-read.json`：已有受控老师可信身份匹配、正式会员状态只读查询；未修改其权益。
- `source-verification.json`：下载生产包24个源码逐项匹配。
- `live-config-verified.json`：Active、正确环境、预期配置逐值匹配、writeTeachers=0。
- `permissions-final.json`、`collection-provision.json`：保护规则实读。
- `protected-counts.json`：既有数据记录数量辅助比较。
- `validation-disabled.json`、`validation-disabled-proof.json`：验收入口关闭与拒绝证明。
- 敏感配置只保存在仓库外本机Windows用户加密备份中，不放入Git。

过程中网络路径异常及一次验收夹具顺序错误已经处理；此前失败输出保留，最终结论以上述最终证据为准。没有按工具调用success字段冒充业务成功，云调用同时核对RetMsg/ErrMsg与具体断言。
