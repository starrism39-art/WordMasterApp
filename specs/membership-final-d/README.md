# Final-D：提醒、真实退款与目标渠道最终放行

2026-09-12。最终 **READY_FOR_ROLLOUT**：提醒、首发渠道门禁、原 TEST 真实退款及手机/Windows 同账号恢复已完成验证。此状态仅表示可准备后续受控 rollout，不等于已经开启购买、rollout 或发布。正式399购买、62名历史老师及其五天缓冲均保持关闭。

工作区 `D:\WordMasterApp-Membership-Final-D`，分支 `codex/membership-final-d-release-gates`，起点 `9367a23bcc35e79ccc9e6dbeacd5d7a6d3bbe322`。冻结继承用户给定的 Stage2至Stage5 和 Final-A/B/C，不重新审计。Git封板范围与检查见 [GIT-SEAL.md](GIT-SEAL.md)；执行用Goal文件仅保留本机。

## 提醒与验证

- 服务端以最终 ledger/access 投影及服务端时间生成提醒。北京时间日期差用于7/3/1阶段：4至7天、2至3天、0至1天；日期仍为当天且尚未过期显示“今天到期”，精确过期时刻仍由原引擎决定。阶段内显示真实剩余天数，不漏掉未在恰好7/3/1天打开的老师。
- “我的”入口持续显示当前状态；会员主页显示状态及必要轻量站内文字，不弹窗、不用订阅消息。首次加载时先持久化本机提示回执，同一天、同一账号、同一阶段、同一最终到期日只出现一次轻提示；持久化失败则只保留状态文字。回执不是权益凭据，跨设备权益仍从云端读；本机回执不宣称跨设备全局提醒投递去重。
- 续费后下次刷新直接替换旧模型；新的最终到期日自动失效旧提醒。退款依据最终投影；gift/长期权益仍生效时不会因某一支付退款而错误显示到期。long-term不产生普通提醒。
- 五天缓冲沿用 Final-A 的个人起始时刻与精确120小时，不改期限、不调用初始化接口。最后24小时提示，结束后保留数据说明。首次写入语义冻结继承 Final-A，本轮只验证显示接线和边界；没有重启真实老师缓冲。
- 本轮新增 **12/12** 离线定向案例，通过真实页面控制器覆盖去重重进、续费刷新、失败恢复、账号切换、未验证渠道隐藏和直接调用拒绝；没有运行历史测试矩阵。
- Final-D 编译成功，AppID `wx930eccb9442dc8f3`，无编译/WXML错误。旧9420与IDE HTTP端口冲突，使用专用自动化9421恢复成功，没有终止其他进程或清缓存。
- 开发工具真实云端受控账号：实际点击“我的”会员入口到 `subpages/membership/index`；真实到期提示、退出重进去重、状态保持通过。7/3/1、五天/最后一天缓冲、long-term使用明确标记的模拟展示响应验证页面，结束恢复真实服务；不是改真实期限或真机实付证据。Windows设备门禁通过离线输入验证，模拟器隐藏购买截图不冒充Windows实机付款。

## 渠道

| 渠道 | 首发结果 | 证据与边界 |
|---|---|---|
| Android | 已有真实TEST支付PASS继承 | 原支付服务、payment核心、Stage5源码无差异；新增展示层设备门禁不改签名、价格或发放逻辑；399总开关仍关闭 |
| Windows | DISABLED_FOR_FIRST_RELEASE | 用户本轮明确选择关闭购买/续费，保留登录、查看、权益恢复及跨设备同步；未进行Windows实付 |
| iOS | IOS_PURCHASE_NOT_READY | 购买/续费隐藏，权益查看保留。账号资格与配置尚未验证，不代表平台认定该AppID不合格；没有配置或发起真实iOS付款 |
| HarmonyOS / 其他 | 首发购买暂不放行 | 官方支持不等于本账号/设备已验证；ohos和未知设备fail-closed，权益读取保留 |

[微信官方虚拟支付文档](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html) 于本轮读取，文档时间为2026-09-11：Android/鸿蒙/Windows走微信支付，iOS走Apple支付；iOS须配置小程序简称、设备iOS15及以上、微信8.0.68及以上、中国大陆App Store账号；最低1元，只支持现网env=0，不支持Apple沙箱。商品双端互通。后续独立iOS方案应使用受控TEST商品100分/12个月和账号白名单，不能复用0.01元价格假称1分实付，也不能猜测实际设备和账号资格。

公众平台浏览器订单页访问被站点安全策略拒绝；未绕过。用户已人工核实该笔订单并完成0.01元全额退款，实际到账与云端官方回调事实一致。当前AppID的iOS能力/简称/账号渠道状态仍未验证，iOS不进入首发购买范围。

## 真实退款与两端最终验收

本节真实支付与退款证据仅覆盖已验证的 **Android / TEST_teacher_12m_a / 0.01元** 路径，不代表正式399元实付退款、iOS退款或所有渠道退款通过。Windows证据仅为退款后的同账号权益恢复，不是Windows实付或独立退款验收。

- 原订单 `wmfe3c...67f1`：用户本人全额退款0.01元；平台退款成功时间为北京时间2026-09-12 14:30:39。云端 `refunded / revoked`，账本 revision=2，仅新增一条指向原payment的 `refund_adjustment / revoke_remaining`。
- TEST投影 `expired / effectiveExpiresAt=null`，无负时长。原payment记录保留，已用区间截止退款时刻；account、ledger、grant一致；独立正式gift完整账本与退款前相同，其他不存在的来源不冒称有真实覆盖。
- 自动退款在同一事务中保存订单退款事实、匹配factHash的payment event、定向撤销记录及账户重算，满足可审计要求；无需复制成人工 `membership_admin_audit`。Final-C人工运营操作的具名审计规则不变。
- 真实安全补偿复查返回 `refunded / revoked`，无新增权益。真实 `stage5_admin confirmPaidAndGrant` 被 `STAGE5_ADMIN_REQUIRED` 拒绝；当前账号无管理员权限，也未新增付款复核证据。有效管理员越过前置检查后的退款终态保护仅由本地真实快照验证 `ORDER_NOT_REVIEWABLE`，不冒称该分支已在线执行。
- **手机真机通过**：复用在线vivo V2307A / Android15 / 微信8.0.77会话，自动化系统信息确认platform=android，页面session账号与原退款订单一致。打开 `subpages/stage5-membership/index`，读取顶部 `Stage5 TEST · 受限验收`，真实点击“刷新会员状态”，得到expired、expiresAt=null、expiresText为空，页面无到期时间元素。真机截图接口返回不支持；证据为真实设备信息、页面元素及刷新数据，不冒充截图通过。
- **Windows微信通过**：使用已登录“张张张123”的原生WeChatAppEx窗口，通过现有vConsole仅调用wx.navigateTo进入同一TEST页；实际点击“刷新会员状态”，观察恢复中到恢复完成，页面显示expired且无到期时间。保存实际Windows窗口截图；不是开发工具模拟器。
- 两端结果一致。未点击购买、未创建订单、未再次支付/退款，未重跑冻结矩阵。普通正式会员页截图与TEST证据严格区分。
- 已在本工作区被忽略的 `project.private.config.json` 设置TEST自定义启动条件；创建前该文件不存在，不纳入Git。两端验收复用现有会话完成，没有再调用预览服务。

## 历史退款预览（退款前快照，已被上述最终结果取代）

2026-09-12 14:08北京时间只读快照：

| 字段 | 结果 |
|---|---|
| 测试账号 | 张张张123；指纹 `2c5774e4d0fffe0f` |
| 商品 / 原金额 | `TEST_teacher_12m_a` / 1分，即0.01元 |
| 原订单 | `wmfe3c...67f1`；云端paid / granted |
| 原付款 | 2026-09-11 10:42:30北京时间 |
| TEST会员期限 | 2027-09-11 10:42:30北京时间 |
| payment grant | 恰好1份，12个月；TEST同域无其他gift/historical/long-term/payment来源 |
| 预计成功退款后 | 仅撤销该TEST payment剩余权益，TEST投影active变expired；会改变此前测试会员状态 |
| 独立正式域 | 存在Final-A受控gift，已于2026-09-12 13:09:14.533到期；预计保持原记录，不撤销、不延长；未发现其他正式域来源 |
| 平台入口 | 官方“虚拟支付 → 订单管理”；文档支持退款，但该笔目前是否仍可退款尚未读取确认 |
| 回调 / 多域边界 | 原 `stage5_payment_notify` 处理真实加密退款通知；Final-C `membership_ops` 明确拒绝TEST订单，不把它混入正式订单域 |

退款前已集中向用户展示该订单影响并停止。随后由用户本人完成平台退款；助手没有代为发起退款。

实际退款后的定向验收结果见上文；没有新建第二笔付款。

## 部署、恢复与证据

仅更新 `membership_presentation` Event云函数，目标 `cloudbase-4gafzdch60ad597b`；已观测Active并通过真实原生调用。配置前后相同；下载部署包25个源码文件与构建源逐一一致。部署前完整代码包及配置备份位于仓库外，配置使用Windows用户加密。

恢复对象：本次前端改动可从起点或增量提交反向恢复；展示函数可重新部署 `D:\membership-backups\final-d-20260912\presentation-before.zip` 并保持原配置。用户真实退款已由回调写入撤销记录，不能通过Git回退恢复付款或删除撤销记录。没有结构迁移。只读展示扩展字段兼容旧客户端，新客户端兼容旧展示响应无reminder字段。

证据目录 `D:\membership-backups\final-d-20260912`：

- `baseline.json`、`local-tests.txt`：原版缺少分阶段字段及本轮12/12。
- `live-ui-check.json`、`live-expired-first.png`、`live-expired-reentry.png`：实际入口和重进。
- `ui-fixtures.json`、`fixture-expiry3.png`、`fixture-transition5.png`、`fixture-transition1.png`、`fixture-longterm.png`：模拟展示，非真实权益变更。
- `official-virtual-payment.md`：官方原文快照。
- `refund-confirmation-preview.json`、`test-refund-preflight.json`：脱敏只读结果和假设退款计算，非退款事实。
- `deployed-source-verification.json`：25个源码匹配；`deploy-presentation.json`、加密配置及前后zip保存部署与恢复证据。
- `REAL-REFUND-RESULT.md`、`postrefund-summary-*.json`、`refund-integrity-check.json`、`refund-compensation-result.json`、`refund-admin-live-rejection.json`：真实退款及分层regrant证据。
- `real-android-test-page.json`、`real-windows-test-page.json`、`real-windows-test-page.png`：本轮两端TEST页最终验证。

本轮未改普通真实用户、未产生新支付、未启用399、未rollout62人；仅用户本人完成原TEST退款，回调依据平台最终事实重算。`membership_business` 的enabledTeachers为空、allTeachersEnabled=false；Stage5购买关闭。未发现本次修改引入的未解决P0/P1；iOS资格仍不得冒充已验收。

历史已付费名单和内部人员名单均为 **ROLLOUT_INPUT_PENDING**。DEFER：真实联系方式、九宫格、Windows独立实付、iOS账户资格和受控1元实付；后续必须在适用渠道放行前补证据。没有新增Final-E/F，不自动Git封板、rollout、Release RC或发布。

下一步唯一建议：准备首批受控rollout名单及执行方案，另行审批后执行；本轮到READY_FOR_ROLLOUT即停止。
