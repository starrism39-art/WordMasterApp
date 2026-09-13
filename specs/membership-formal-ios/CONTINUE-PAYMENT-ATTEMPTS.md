# 单业务订单与 iOS payment attempt

## 数据与继续支付

业务订单 ID、teacher 归属、商品及 payment grant 来源保持不变。平台唯一 `outTradeNo` 存在订单的 `iosAttempts` 审计列表中，通过 payment intents 中的 `ios_attempt_index` 解析回业务订单，不创建第二笔业务订单或新集合。

继续支付需服务端受控重试门禁授权，先官方查所有 attempt。未知状态、请求故障、金额或环境不匹配均停止。若发现已支付 attempt，进入现有权益恢复流程；只有查单结果均为明确未付款或已关闭，才允许生成新的唯一支付号并事务替换本地 active attempt。

本地 `superseded` 不代表微信官方已关单，旧平台支付仍可能迟到完成。系统最多一个本地 active attempt；事务版本检查、登录请求摘要、60 秒发起间隔和最多 8 个 attempt 限制阻止重复签发及无限重试。达到限制需人工排查。

## 付款、通知与幂等

首次确认的获胜 attempt 在事务中固定。其官方付款事实及认证商品凭据映射至原业务订单，沿用既有唯一 payment grant；不同 attempt 的商品凭据不能混用。

通知必须经过现有认证入口。通知、查单和补偿均验证 attempt 索引及业务订单归属。其余 attempt 若迟到付款，记录 `IOS_DUPLICATE_PAYMENT` 人工复核事件，不重复发权益，不自动退款。重复付款的退款不得撤销获胜权益。补偿继续检查 superseded attempt，避免遗漏迟到付款。

## 定向测试与运维

`attempts.test.js` 覆盖单业务订单、唯一 active、并发与快速重试、所有 attempt 查询、先付款恢复、迟到重复付款复核、商品凭据隔离、退款隔离及补偿。`routing.test.js` 覆盖认证通知和 attempt 索引解析；`delivery-signature.test.js` 覆盖 Apple 发货签名及既有非 Apple 签名行为不变。其余本目录测试覆盖 iOS 门禁与客户端入口。

部署需同步三个入口函数的共享代码并比对下载源码。回退时先关闭购买门禁；已存在 attempt 的订单必须保留能解析索引的通知与补偿处理器，不能退回只认原支付号的旧入口。不得删除旧订单、旧 attempt 或审计记录。

真实身份、支付号、原始回调和逐笔验收材料仅存放在仓库外受保护的证据目录。接入文档和测试不得包含生产身份、密钥或真实支付 dump。
