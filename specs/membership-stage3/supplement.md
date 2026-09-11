# Stage3 补偿及运行入口补充检查点

本轮仅本地修正与隔离测试；未部署、创建云资源、修改平台配置、创建真实订单、付款、调整真实权益或 commit/push。Stage2 的 15 个文件与权益语义保持不变。

修改前 16 个 Stage3 文件完整备份并逐文件校验：`D:\WordMasterApp-Membership-Stage3-Checkpoint-20260908-204957`。

## 配置证据及停止边界

继承上一轮 2026-09-08 的只读后台证据：CloudBase 浏览器能够访问 `cloudbase-4gafzdch60ad597b`，7 个现有云函数未包含会员支付；HTTP 网关关闭，所示域名路由为空。浏览器登录不代表 MCP 或 SDK 授权。公众平台读取已被工具明确安全策略拒绝，本轮不换入口或工具绕过、不重复 AUTH_REQUIRED，也未默认要求截图。

源码 AppID 为 `wx930eccb9442dc8f3`；实际 OfferID 绑定、商品模式约束、四渠道可用性、正式与测试商品配置以及密钥存放方式仍未知。本地禁购模板为空不能证明平台未配置。普通商户号没有操作。

## 查单独立补开尚未放行

[官方道具直购流程](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html)允许轮询发货，不要求 query_order 重复返回完整权益字段。已签名的商品、金额、数量、币种、环境、订单号与服务端不可变权益快照可以构成绑定依据。

但 [requestVirtualPayment](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html) 的 mode 在 signData 之外；本账号的模式约束未被核实。现金单/order_type 本身不足以排除充值场景。没有加入未经证据支持的“已确认”布尔开关，也没有随意猜测 biz_meta 结构。因此保留无通知时的 PRODUCT_EVIDENCE_REQUIRED 门槛，理由已修正为账号/模式绑定待补证，不是要求完整商品字段回传。

针对性测试将无通知成功补开明确列为 TODO，不能算 PASS。没有编造所谓“合法独立查单”fixture 来绕过此缺口。

## 本地修正

- `protocol.js`：拆出 queryState，先识别付款单类型及状态，再验已付款金额。coupon_fee 官方注明暂无字段，缺省可接受；付款单 left_fee 必须是非负整数且等于本单金额。缺失、null、零余额、部分余额分别拒绝或复核，不将缺失默认为零。refund_fee 是退款单语义，不用它替代付款余额；付款响应的异常非零值进入复核。退款单不当作付款。
- `engine.js`：补发前重新查单，即使已经保存付款事实；避免漏退款通知后盲补。平台退款状态、余额异常及平台交易绑定冲突形成持久复核记录，不覆盖原绑定；本地退款终态不会被旧成功逆转。
- `handlers.js`：增加官方消息地址 GET 挑战校验，POST 仍只接受安全模式 JSON 核验。没有回调路由配置变更。
- `runtime.js`（新增）：可组合的订单服务、通知、内部补偿函数及 SDK 初始化工厂。导入不初始化 SDK；所有操作仅由未来部署 bootstrap 调用。内部补偿必须持有独立服务端密钥签名，校验五分钟时间窗、批量边界及数据库 nonce 防重放；不是客户端可选择的发权益 action。
- `config.example.js`：增加明确 cloudEnvId，默认禁购不变。
- `fixtures.js`、`payment.test.js`：按新字段和补偿语义更新受影响案例；新增 `supplement.test.js`。Stage2 不改。

字段依据：[query_order 官方文档](https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html)。请求 env 0/1 与返回 env_type 1/2 显式转换；实际付款时间仍来自平台 paid_time，不使用补偿时间。

## 补偿策略与剩余范围

每批默认 20、最多 50。尚未付款的前一小时按一分钟、之后按一小时轮询；24 小时仍等待则标记 needsReview，但不自行关单。支付事实不足或查询故障单独计 confirmationFailures，12 次后标记复核并继续有界频率查询，不耗尽发放失败次数。已付款的发放/发货确认故障最多自动失败 12 次，之后 exception。

以上间隔是本地运行策略，不伪称官方订单有效期。只有可信平台关闭状态才结束未付款轮询；不会把本地取消、超时或用户退出当作已关闭。调度器尚未启用，因此本轮只证明服务端处理函数可以被调度，不能宣称云端自动补开已运行。

内部入口支持受控 reviewOrderIds 批次，对已发放订单再次查单。若发现退款则冻结后续发放并转人工复核，不凭付款单的时间字段杜撰退款成功时间。**漏通知后的自动退款撤权尚未实现**；需获得可验证最终退款事实后复用既有退款处理。后台后续须安排复核候选订单来源/扫描策略，当前未部署扫描器。

## 凭据及运行入口

受保护环境注入名：MEMBERSHIP_APP_SECRET、MEMBERSHIP_ACCESS_TOKEN、MEMBERSHIP_LIVE_APP_KEY、MEMBERSHIP_SANDBOX_APP_KEY、MEMBERSHIP_NOTIFICATION_TOKEN、MEMBERSHIP_NOTIFICATION_AES_KEY、MEMBERSHIP_INTERNAL_KEY。仅为名称，无任何真实值。未配置即拒绝，不跳过验签。session_key 仍仅存在于单次登录交换的服务端内存中。

ACCESS_TOKEN 需要未来由受保护、对应 AppID 的提供者定期更新；本轮未实现令牌自动刷新服务。内部签名消息为 timestamp、nonce、原始 JSON body，以换行连接后 HMAC-SHA256；密钥至少 32 字节，签发方仅限受保护后台。nonce 消费后失败需用新 nonce 重新调度，权益仍受订单幂等保护。审计记录不记录密钥或原始支付载荷。

运行工厂需要固定并验证 SDK 版本，部署包需要同时包含 membership-core 与 membership-payment。这里未安装 SDK、创建自动部署文件或发布 main。GET/POST 网关原始 body 与查询参数的实际转换、管理员/调度服务的签名调用方仍待未来云联调接线。

## 下一轮最小联调申请（本轮未授权执行）

1. 先补明实际账号/模式绑定证据；不能默认改用普通微信支付或以金额相同替代商品绑定。
2. 独立隔离 EnvId 待指定，不能使用当前共享账本。新环境若收费需先展示当时套餐与资源费用并获批准，本轮不估造报价、不创建环境。
3. 复用 9 个 membership 集合模型：products、orders、payment_intents、payment_claims、payment_events、payment_work、ledgers、grants、accounts；work 的 state+nextAt 索引。客户端直接读写关闭，服务端校验老师归属。实际规则、SDK 身份和平台权限须隔离验证。
4. 待部署三个入口：订单服务、通知接收、内部补偿；先隔离 SDK 事务测试，通知路由、安全配置、调度启用需另列具体动作授权。内部入口服务密钥不得下发小程序。
5. 专用测试老师的真实 teacherId/OPENID 尚未确认；fixture teacher、历史学生及普通老师均不视为授权账号。模拟事件只能进入隔离账本，测试签名密钥仅用于隔离资源。
6. 实测双实例同订单、跨订单交易冲突、同老师双订单、事务提交失败/结果未知、内部入口重放、越权查询和客户端禁写。保留本次测试批次订单/来源/事件证据；清理仅限明确批准的隔离测试批次，保留必要审计记录，不删除真实数据。

小额真实付款继续留 Stage5，每笔由用户完成官方付款确认；399 元实付未授权。最终测试数量见 supplement-verification.json，TODO 不计入通过。
