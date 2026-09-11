# Stage3 代码交付与未完成项（2026-09-08）

> 后续检查点：本文件保留首次交付记录。2026-09-08 后续解析、补偿和运行入口修正及剩余阻塞，以 [supplement.md](supplement.md) 与 supplement-verification.json 为准；初版 verification.json 不覆盖后续修改。

本阶段是独立支付代码及隔离契约验证；不是部署、真实数据库并发验收或实付验收。关键缺口仍在，下述测试通过不表示 Stage3 全部完成。

## 1. 工作区与保护范围

- 工作区：`D:\WordMasterApp-Membership-Stage2-20260908`；分支 `codex/membership-stage2-20260908`；HEAD 为冻结提交 `14129f96d8581968e4fdad8551cc1a47d7a4aa55`。
- Stage2 原有 15 个文件全部保持字节一致，未提交状态保留。修改前完整副本：`D:\WordMasterApp-Membership-Stage3-Before-20260908`，已逐文件 SHA256 核对。
- 没有修改 Stage2 接口或权益算法，没有触及学习同步、学生入口、首页、我的、公告、学习/复习页或主工作区；没有 commit/push、安装依赖、部署、创建资源或真实数据写入。
- 产品基线仍是交接文件名 2026-09-06、正文 2026-09-08；仅补读本阶段支付、异常退款及测试授权内容。不存在常规按天退款方案。

## 2. 官方接口到项目职责

2026-09-08 从微信官方页面读取（页面读取使用 Jina Reader，签名代码块另以官方原始 HTML 交叉核对）。没有采用普通微信支付教程。

| 官方能力 | 当前代码职责 | 证据与边界 |
| --- | --- | --- |
| `wx.requestVirtualPayment`，`short_series_goods` | 本地创建订单意图；服务端签名；客户端直接调用官方 UI | 官方交易的创建由此 API 执行。本轮所有调用均为 fixture，未实际拉起 |
| `signData/paySig/signature` | 保存并签署同一 JSON 字符串；AppKey 与 session_key 分别签名 | HMAC-SHA256；paySig 消息为 `uri&原始JSON`；session_key 按原字符串使用，不做 base64 解码 |
| `wx.login` → `/sns/jscode2session` | 签名前交换 code，核对返回 OPENID 与可信调用上下文一致 | session_key 仅保留在该次服务端调用的内存中，不返回、不写账本 |
| `/xpay/query_order` | 从可信订单取 OPENID/env/order_id，服务端查单并签名 | 订单状态 2/3/4、现金支付订单类型、金额及真实 paid_time；还必须有商品证据 |
| `xpay_goods_deliver_notify` | AES 安全模式 JSON 解密，校验应用、买家、订单、商品、数量、原价/实价、Attach 和环境 | 通知与查单共用同一核验/发放链路；充值通知不发会员 |
| `/xpay/notify_provide_goods` | 权益事务提交后，在事务外确认发货，失败重试 | 商品回调的 `success` 本身也是发货确认，因此发放未提交时不返回成功 |
| `xpay_refund_notify` | 最终全额成功撤销对应未用权益，失败结果只记录 | 非零 RetCode 不撤权；部分金额进入人工复核，不自行发起退款 |

金额为整数人民币分，商品数量固定 1、单次 12 个月、无折扣/代币/自动订阅。请求 env 为 0 正式 / 1 沙箱，查单 env_type 为 1 正式 / 2 沙箱，代码明确转换。OfferID、平台商品ID、AppID、环境及渠道来自受控服务端配置，不采用客户端金额或账号。

官方渠道声明：安卓、鸿蒙、Windows 为微信支付，iOS 走同一虚拟支付接口中的苹果支付。官方当前列出 iOS 15+、微信 8.0.68+、中国大陆 App Store 账号、最低 1 元且无 iOS 沙箱。本轮未验证本账号这些渠道已可用；安卓一分钱未下结论，实付前另核对。

关键官方来源：

- [虚拟支付总说明、签名及通知字段](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html)
- [客户端 requestVirtualPayment](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html)
- [查单](https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html)
- [确认发货](https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_notify_provide_goods.html)
- [消息推送及加解密官方样例](https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html)
- [登录凭证校验](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html)
- [CloudBase 事务说明](https://docs.cloudbase.net/database/transaction)
- [官方 Node SDK 数据库契约](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/database/database.md)

CloudBase 当前说明的部分代码和旧官方 SDK 文档对于 `runTransaction` 返回包装存在差异；本实现使用明确的 `startTransaction/commit/rollback`，`doc.set(value)` 直接传文档。未依据微信客户端 SDK 的 `set({data})` 编写 Node 适配。实际选用的 SDK 版本及服务器行为仍须隔离云实测固定。

## 3. 实际新增文件

`cloudfunctions/membership-payment/`：`config.example.js`、`crypto.js`、`protocol.js`、`wechat-api.js`、`identity.js`、`repository.js`、`engine.js`、`handlers.js`。

`utils/membership-payment-service.js`：未被任何现有页面导入的独立客户端适配器。

`test/membership-stage3/`：`fixtures.js`、`payment.test.js`、`adapters.test.js`、`client.test.js`。

`specs/membership-stage3/`：本文件、`test-results.tap`、`verification.json`。新增文件均未提交；无既有文件 diff。

## 4. 链路与事务

客户端只提供 productId/requestId；签名阶段附带微信 loginCode。`createTeacherIdentity` 复用现有 `teachers.teacher_id === getWXContext().OPENID` 身份关系，要求 AppID 一致且老师记录唯一，不从客户端取 teacherId。实际账号角色与老师记录保护权限仍未云端验证。

商品文档结构为 `{product: Stage2商品契约, appId, offerId, env, platformProductId}`。下单读取受控商品、测试白名单、渠道启用和长期会员状态；签名时复核商品。配置模板默认禁购且没有启用任何渠道。相同老师的同一 requestId 幂等；新的购买意图使用新 requestId。旧订单不会因后来关掉商品而漏补权益。

步骤：本地订单与补偿任务原子保存 → 官方 UI → 经认证的商品证据持久化 → 服务端查单 → 付款事实、交易占用标记、待发放任务原子保存 → Stage2 grant/normalizeLedger/rebuildAccount 原子发放 → 回调应答或事务外确认发货。

支付状态与发放状态分离。客户端只读自己的订单结果，不写 isVip；账号版本在登录/退出每次变化，包括 A→B→A，旧请求结果不能刷新新账号。sessionRevision 的页面接线留到后续。

使用 9 个独立集合（本轮仅定义名称，未创建）：`membership_products`、`membership_orders`、`membership_payment_intents`、`membership_payment_claims`、`membership_payment_events`、`membership_payment_work`、`membership_ledgers`、`membership_grants`、`membership_accounts`。

`membership_ledgers` 保存当前老师完整、可重建的 Stage2 来源记录；`membership_grants` 保存对应来源文档，汇总只是派生。将来赠送、历史补录及权限写入必须使用同一老师账本事务，不能另起不一致账本。Stage2 尚为本地模型，本轮没有导入任何云端旧数据。集合不属于学习数据同步。

交易占用文档键按应用/环境/平台交易确定；订单和交易标识不能被不同订单重复领取。老师账本文档作为共同事务写入点，避免两笔订单覆盖彼此。交易冲突最多尝试 4 次，其他错误不盲重试。事务中没有支付/登录/查单网络请求。单事务限制 90 次数据库操作、单文档 512KB，超限进入可见异常，不截断账本；未来容量扩展需单独设计。

## 5. 补偿、异常与退款

每批最多 50 个（默认 20）；单工作项最多 12 次自动失败，退避上限 1 小时，之后进入 exception。事件与任务记录保留订单关联、错误码和事实摘要，不记录原始消息、session_key、token 或原始错误 URL。原始必要身份/支付事实只在受保护订单及账本文档中。异常记录没有设置为自动清除。

付款事实提交后进程中断不依赖客户端恢复；新的处理器可以用持久化任务继续发放。回调只在权益事务成功、终态退款或退款失败结果可靠记录后成功应答。重试确认发货可能再次调用官方同一订单确认接口，但不会再次发权益；实际平台重复应答语义待联调。

退款成功的通知先按应用、老师、订单、平台交易及金额核对。退款没有文档化的 Env 字段，因此不杜撰该字段，使用已认证应用及订单原环境关联。仅全额最终成功自动复用 Stage2 `revoke_remaining`；退款已使用部分不倒扣，其他订单继续保持有效。先退款后支付、重复及乱序退款均不会重新开通。部分退款或 iOS 退款咨询事件留下人工复核记录，不提供自动退款决策。

## 6. 验证结果

- Stage2 原有 72/72 回归通过；15 个文件与修改前备份全部一致。
- Stage3 专项结果见同目录 TAP 与 verification.json。覆盖官方 HMAC/AES 样例、参数篡改、白名单、所有权、错误通知、通知/查单竞争、交易重复绑定、老师双订单并发、逆序付款、付款保存/发放提交失败、冲突重试、有界补偿、处理器重建、退款/付款竞争和账号切换。
- LocalSdk 是明确标注的本地快照冲突模拟，测试经过实际 CloudBase repository 适配器代码，但没有连接真实数据库，不能作为 CloudBase 原子性已实证。
- 只有独立模块，未接页面；本轮不运行手机 UI、不声称真机断网/关程序/跨设备已验证。核心算法回归和独立 JS 检查是适用的仓库验证，不重开同步测试。

## 7. 未完成、禁止启用条件

1. **关键协议缺口**：查单文档仅将 biz_meta 描述为创建订单时的信息，没有给出可靠商品结构。本实现不猜字段；只有经过认证的商品通知结合查单才发放。若通知从未到达，只能排入待处理/异常，不能保证查单单独自动补开。需微信官方明确映射或后续获授权的真实隔离证据，再补核验器；此项未完成，所以不宣称 Stage3 全部 PASS。
2. **账号配置未核实**：CloudBase 只读 auth status 返回 REQUIRED / env NONE，未登录、未启动授权。需实际 OfferID、正式/沙箱 AppKey 来源、平台商品ID与价格、渠道开通、原始ID、消息 JSON/AES 配置确认。普通商户号保持原状，不把它当虚拟支付身份。
3. **运行时未接线**：getAccessToken/getAppKey/getAppSecret 需要受保护提供者；未配置通知 URL、GET 地址验证/gateway body 转换、函数鉴权、管理员补偿调用或自动任务。POST 核验器只接受安全模式 JSON，其他平台配置需协调，不能放宽验签。iOS 退款咨询建议的完整业务应答尚未实现。
4. **云适配未实测**：需固定 SDK/运行时，验证缺失文档返回、跨集合原子性、冲突码、提交结果未知后的恢复、索引及权限。单独上传 membership-payment 文件夹无法包含同级 membership-core，后续部署包必须同时包含两者；本轮没有创建可误部署的 main 或部署配置。
5. **业务/设备未验收**：免费名额与学生业务入口仍是 Stage2 模型，真实业务权限接入留到后续；安卓/鸿蒙/Windows/iOS 官方付款 UI 均未打开，真实跨设备订单恢复未执行。

## 8. 若后续申请隔离云实测，一次性资源清单

尚未授权或执行。当前项目已有 EnvId 记录 `cloudbase-4gafzdch60ad597b`，**不能视为隔离测试目标**；实际隔离 EnvId 待指定。最小范围为上列 9 个会员集合、work 的 state+nextAt 索引、只读 teachers 查询、三个受控运行入口（客户端订单服务、HTTPS 通知、内部补偿），以及受保护凭据配置。所有会员集合客户端直读写应关闭，由服务端所有权校验；具体规则待审核，未更改。

仅指定测试老师账号及云端白名单测试商品文档；模拟事件只进入完全隔离测试资源，正式通知入口没有跳过核验开关。云实测首先无平台付款、无平台商品修改；如需配平台通知地址另单独批准。不要因独立代码工作区而假定共享云环境也被隔离。

## 9. 下一步唯一建议

先补齐“查单独立证明商品成交”的官方证据及实际账号配置，补完对应代码缺口；然后才能形成具体的隔离云实测授权申请。本轮停止，不进入 Stage4/5，不执行真实付款。Stage5 小额实付与正式 399 元商品配置核验继续分开，399 元实付仍未授权。
