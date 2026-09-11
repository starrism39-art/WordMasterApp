# 首次真实 TEST 小额支付

## 最终结论（2026-09-11）：PASS

首次 TEST 真实支付与跨设备恢复已验收为**PASS**。官方可信付款、12个月权益、一致性、单次发放、手机重进和电脑跨设备恢复均已有证据；用户已分别确认新版电脑与手机正常。

最新既有云端证据payment-observation-1789096306062.json：1笔订单、1次grant，ledger revision1，active，到期时间2027-09-11 10:42:30不变；补偿5次未重复发放。正常支付的admin audit0/ledger audit0与支付事件审计一致，未新增人工发放。

Stage5-E、Stage5-F及整个Stage5均为**PASS**（按最终确认范围）；正式399商品仍关闭、TEST新购买已关闭、未正式发布，无需追加新的验收项目。临时观察任务已删除，不影响结论，云端通知和补偿保持原状。本次仅文档归档，无测试、代码修改、部署、付款或commit/push。

## 历史付款过程（以下“仍未完成”为当时快照，现已由最终结论收口）

- 用户在集中展示账号、设备、商品ID、金额、时长、AppID、OfferID、环境与白名单后明确回复“同意”。最终付款由用户本人操作，Codex没有调用purchase或点击付款。
- 10:38:56 只读基线购买关闭、零订单/意图/权益。首次open在写入前因本机bridge不允许readNoSqlDatabaseContent失败；备份后仅扩充该只读工具允许列表，未改服务端授权。
- 10:40:58 +08 stage5_orders.purchaseEnabled=true精确回读，仅指纹3eac6ca3b522 + TEST_teacher_12m_a，1分/12月。其他配置不变。protected evidence: D:\membership-backups\stage5-first-payment-20260910\purchase-window-20260911-103958-open。
- 10:42:30 +08 官方可信付款事实；10:42:48首次观察得到paid/granted和active。订单指纹656ce4cfa910，交易指纹d9a0e90b6a5a，grant指纹a61df179a74e。事件含authenticated_goods、verified_payment、grant。
- 10:43:46 +08 已关闭新购买并精确回读。仅修改orders购买开关，notify/queryOrder/grant/compensate未改。关闭证据 purchase-window-20260911-104318-close。
- 10:44:20 +08 只读一致性12项全部通过：购买关闭、官方认证通知、paid/granted、单grant、归属/交易/grantID一致、12个月及开始结束时刻一致、active、正常支付无人工grant、单grant事件。
- account有效期：1789094550000至1820630550000，即北京时间2026-09-11 10:42:30至2027-09-11 10:42:30。ledger revision1，恰好一个payment grant。admin audit0、ledger audit0符合正常自动支付路径（不是缺失人工发放审计）；支付审计事实在events。
- 最新证据 D:\membership-backups\stage5-first-payment-20260910\payment-observation-1789094660474.json。work仍pending，等待原有补偿调度观察，不人为重放通知/发权益。
- 已启动300秒自动关闭兜底进程27056；已创建当前任务heartbeat test，仅观察和关闭，不可自行重开购买。
- 仍未完成：补偿后单交易无重复发放的运行证据、iQOO12关闭重进与同账号第二设备恢复。当前不能宣称首次付款完整验收全PASS。客户端只读queryOrder可继续使用，严禁重复购买。无commit/push。
