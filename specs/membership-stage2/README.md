# WordMaster 会员 Stage 2：独立核心契约

产品基线：`啃词会员支付-最终规则与开发交接-2026-09-06.md`，正文 2026-09-08（含 11.1）。

工作区：`D:\WordMasterApp-Membership-Stage2-20260908`。分支：`codex/membership-stage2-20260908`。
基线：`14129f96d8581968e4fdad8551cc1a47d7a4aa55`。

只新增 `cloudfunctions/membership-core/`、`test/membership-stage2/`、本目录。
未复制主工作区未提交内容、tmp、test-output 或三个规则文档提交。适用主项目 AGENTS.md 和用户当前授权；本阶段不 commit/push。

## 实现范围

独立 CommonJS 纯函数、依赖注入服务及内存事务适配器。没有可部署 `main`、云 SDK、客户端入口、网络请求、数据库配置和真实商品实例。
`applyVerifiedPayment` 仅是给 Stage 3 的内部可信适配器接缝；测试通过人工构造的收款事实验证算法，未创建订单或联系支付平台。

测试运行于本机 Node v24.15.0。未来云端运行时须支持 `structuredClone` 等所用能力；未验证实际 CloudBase runtime。不能把 MemoryRepository 部署为云端持久化实现。

## 数据模型与权威边界

所有时间均为整数 epoch 毫秒；金额为整数分；schemaVersion=1，policyVersion=teacher-membership-v1。
身份从受信任的 `getIdentity()` 适配器取得；未来应在服务端调用 `getWXContext().OPENID` 并核对老师身份。请求体中的 teacherId、金额、期限、memberLevel 等不参与普通用户权限决策。管理员跨账号操作需要服务端配置的管理员身份。

| 集合 | 记录字段与约束 |
| --- | --- |
| membership_products | productId、productType、price、currency、duration、channel、enabled、testOnly、allowedTestAccounts、autoRenew、createdAt、updatedAt、schemaVersion；正式年度契约 39900 分/12月/不续订；测试商品只能给允许账号解析；本阶段未配置任何真实商品。 |
| membership_grants | grantId、teacherId、sourceType、sourceId、startsAt、endsAt、longTerm、duration、status=recorded、operation、targetGrantId、createdAt、updatedAt、metadata、reason、schemaVersion。每个来源追加一笔，不更新原始权益来表示退款。 |
| membership_accounts | teacherId、status(free/active/expired/grace/long_term)、effectiveStartsAt、effectiveExpiresAt、longTerm、currentAccess、updatedAt、schemaVersion；附 periods/perpetual/adjustments 的来源投影。普通会员完全由 grants 重建；grace 还需要独立访问政策记录。缓存损坏不影响权威计算。 |
| teacher_student_access | teacherId、freeSlotConsumed、firstStudentId、retainedStudentId、transitionStartsAt、transitionEndsAt、transitionStudentIds、initializedAt、policyVersion、updatedAt、schemaVersion。名额消耗和固定选择独立于本地学生数。 |
| membership_admin_audit | auditId、operator、teacherId、actionType、source、before、after、reason、createdAt、schemaVersion；赠送、补录、长期、调整、初始化、纠错、固定学生和名额纠正均在事务内记录。普通老师资料纠错也记录实际操作者，不将其当成管理员。 |
| payment_orders | 只验证契约：orderId、teacherId、productId、amount、currency、status、createdAt、updatedAt、schemaVersion，处理后关联 lastEventId/grantId。未提供创建订单的函数。 |
| payment_events | eventId、orderId、kind、status、occurredAt、receivedAt、payloadDigest、schemaVersion；保存核验/处理阶段，原始敏感通知载荷的安全存储留 Stage 3。 |

grants.sourceType 覆盖 payment/gift/historical_payment/internal_long_term/admin_adjustment/refund_adjustment。
sourceId 在同一个老师名下跨来源类型唯一；同 ID 同内容重放无副作用，冲突内容报错。grantId 同样不能复用。生产仓库须以确定性文档键/唯一索引实现，而非仅靠先查后写。

## 期限与账本重放

- 时区固定北京时间 UTC+08:00，12个月按日历月相加；不存在同日则取目标月末，时分秒毫秒保持。不使用365天代替一年。有效区间为 `[startsAt, endsAt)`。
- 原始 grant.startsAt/endsAt 保存来源基准时间与名义期限；payment/historical_payment 的基准为真实 paidAt。实际排期在 account.periods 中关联 grantId，明确区分名义区间与顺延区间。
- 有限时长权益按 startsAt、操作类型、sourceId 稳定排序。首购/过期重购从 paidAt 开始；连续有效权益从已有队列末端顺延；汇总的 effectiveStartsAt 为本次连续权益最早起点。
- 限时赠送分为可累计时长和明确截止日期。可累计时长独立排期，不覆盖付费；明确截止日期必须携带 metadata.fixedEndsAt。若与已有权益排期冲突则拒绝并要求管理员重新审查，不悄悄移动承诺截止日期。预览显示实际 before/after 及每笔排期。
- historical_payment 保留真实金额、paidAt、evidence、timePrecision。只有日期时还要求显式 timeBasis（例如记录该日北京时间00:00但原时分秒未知）；不伪称精确时间。旧日期已过期不从录入日重新起算。
- internal_long_term 独立存在，普通年度和支付退款不缩短长期状态。管理员可用有审计的 revoke_remaining 明确撤销指定来源的剩余权益。
- 管理员赠送/补录/调整先预览，写入必须匹配当前 revision 和五分钟内的 previewAt/token。并发变化或预览过期要求重新预览。重试已成功的同一操作返回原操作回执，不重复写入；界面当前状态应另外调用 access/rebuild，不把旧操作回执当实时权益。

## 平台异常退款

没有用户退款入口或按天折算金额。refund_adjustment 指定付款来源 grantId；必须由后续平台最终结果处理链路或获权管理员提交。
重放只裁掉目标在确认时间之后的未使用区间，保留已使用段；后续尚未生效权益移到不早于确认时间及其来源基准时间的位置。
完整未使用的12个月重新按衔接日加12个月；赠送固定毫秒时长保留其未使用时长。保留原始账本及前后排期调整记录。
目标已过期或已无剩余时不扣其他来源；重复退款不再次扣时；退款调整不能指向赠送或长期来源。
未来的调整先检查目标合法性，在实际生效前不改变当前投影。

日期用例：A=2026-09-08 10:00起一年，B提前买一年。A在2027-03-08 10:00退款：A已用半年保留，B从当日接续到2028-03-08 10:00。只退B时A保留到2027-09-08；A自然到期后退款不扣B。

## 权限契约

`getMembershipAccess({teacherId, grants, access, students, studentId, now})` 的输入来自服务端仓库。
返回 membershipStatus、canAddStudent、canStartLearning、canStartReview、canViewHistory、unlimitedStudents、retainedStudentId、transitionEndsAt、expiresAt、reasonCode、addReasonCode。
reasonCode 在 constants.js 集中定义；未提供具体学生时学习/复习为 false，不能把“会员有效”当“任何学生ID均可访问”。

- 免费第一次新增后名额永远消耗；删除仅改变学生存在状态，不释放名额，不自动换固定学生。memberLevel/currentUser 缓存完全不参与判断。
- 会员不限新增数量，但仍核对所属老师和学生存在性。会员新增的学生也标记已使用过免费名额。
- 到期无固定学生时禁止新学习/复习，允许选择自己的现有学生一次；其他现有学生仍可看历史。已固定后不可自助轮换，续费恢复全部学生。管理员误选纠正有 reason 和 before/after。
- 资料纠错只允许姓名/年级，有原因、原值、新值；明确 replacement 请求拒绝并转人工。身份和免费名额不会随资料改变。**这不能自动识别谎称纠错的换人行为**；Stage 7/8 应接修改历史和人工核实，不依赖改名次数或学生实名验证。
- 名额纠正仅管理员可用，必须给证据和当前 revision；有现存学生时禁止重置为空闲。常规老师接口没有重置功能。
- 老免费多学生的过渡从共同 launchAt 起5天，只允许初始化快照内学生，不准新增。初始化幂等，后来的设备/请求不改起止时间；付费/长期老用户无额外过渡；无学生且无可靠删除历史不推定名额已用。
- grace 不进入权益账本排期，因此过渡期第2天购买仍从实际 paidAt 起12个月。

## Stage 7 原子新增顺序（未接入）

1. 服务端取得可信 teacherId；验证请求ID及资料白名单，拒绝客户端权限/金额字段。
2. 开启数据库事务，读取老师访问状态和权益 revision、幂等操作记录。若已完成则返回原结果；同请求ID不同内容拒绝。
3. 在事务内从权威权益和名额判定新增资格。免费名额必须仍是 false。
4. 以确定性 studentId 新建学生，同时将 freeSlotConsumed 改为 true，保留 firstStudentId/retainedStudentId，写入操作回执、审计及必要汇总；全部在同一提交内成功。
5. 冲突后重新读取重算，有限重试；不能只重试学生写入或先本地显示成功。事务失败不消耗名额；提交成功但响应丢失，通过相同请求ID找回结果。

CloudBase 适配器需跨这些集合原子提交并与同老师权益写入共享 revision/冲突边界；内存仓库的全局队列仅用于本地证明。后续必须通过真实数据库并发、事务失败及进程中断验证。
现有学生直写、编辑时补建和旧客户端迁移上传须一起协调权限/受控入口，不能只改页面按钮。已冻结学习集合、merge、pending、Full Pull、tombstone不纳入本模块。
现有删除权威继续负责删除；本地测试只模拟其最终学生已删除事实，不实现第二套删除同步。权限服务不得释放已消耗的免费名额。

新学习/复习入口和新批次边界由 Stage 7 接服务；在途学习需要有限会话授权和安全保存已产生记录。本阶段未实现会话运行时、离线持久化或页面拦截，不能声称已阻止旧客户端业务绕过。

## Stage 3 订单/通知接缝（未接支付）

正常路径 created → awaiting_payment → paid → grant_pending → granted；失败可进入 exception 后根据可信证据补偿。
取消/失败后的迟到真实付款允许核实后转 paid；refunded 不回到 paid；乱序早于 updatedAt 的状态变更交给查单对账，不能倒退状态。
退款申请只进 refund_pending；收到最终成功证据才 refunded/追加调整。支付与发放分别有证据。

transitionOrder 中的 server/paymentVerified 等是内部已验证证据契约，**不是自行完成签名核验**，不得直接映射客户端布尔字段。
Stage 3 的 trusted receipt adapter 必须核对官方通知/查单、应用和支付身份、商品金额、账号及支付事实；保存当次云端授权的不可变 productSnapshot。
补偿按当时商品快照发放：后续关闭测试商品不能阻止已经支付的订单补开。商品当前的 enabled/allowlist 只控制新购买授权。
当前没有云平台身份、AppKey/session key、安全配置、官方协议签名或通知入口，也没有任何真实收退款或订单写入。

## 验证

在此独立工作区执行（不需要安装依赖）：

```text
node --test test/membership-stage2/ledger.test.js test/membership-stage2/service.test.js test/membership-stage2/orders.test.js test/membership-stage2/boundaries.test.js
```

原有测试入口、业务页面和同步源码均不变。无需为独立服务编译或操作共用微信 IDE。Stage2 的本地 PASS 不代表 CloudBase 事务、支付平台、真实老师权益、页面或跨设备实付验收通过。
