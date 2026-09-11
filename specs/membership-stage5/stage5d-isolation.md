# Stage5-D 本地隔离接线与部署门禁（2026-09-09）

本轮仅本地源码、配置模板、隔离 fixture 测试和本地打包。没有创建集合、部署函数、改云权限、真实订单或权益写入。repairNames 和学习同步未修改。

## 固定集合与权限矩阵

唯一映射在 `cloudfunctions/membership-stage5/policy.js`；不接受请求集合、前缀、环境或批次。以下全部客户端直接读/写为 false；仅可信服务端入口按所有权返回必要数据。

|逻辑集合|物理集合|用途|
|---|---|---|
|products|stage5_membership_products|受控 TEST 商品|
|orders|stage5_membership_orders|订单及原始商品权益快照|
|intents|stage5_membership_payment_intents|购买意图幂等|
|claims|stage5_membership_payment_claims|真实平台交易唯一占用|
|events|stage5_membership_payment_events|支付事件、内部防重放、脱敏拒绝记录|
|work|stage5_membership_payment_work|持久化补偿任务|
|ledgers|stage5_membership_ledgers|复用 Stage2 单一权益/权限账本|
|grants|stage5_membership_grants|权益来源投影|
|accounts|stage5_membership_accounts|会员汇总投影|
|audits|stage5_membership_admin_audit|管理员审计及签封核单证据|
|access|stage5_teacher_student_access|免费名额/固定学生投影|
|students|stage5_test_students|独立测试学生投影|

数据库默认 _id 唯一性加事务实现幂等。唯一新增查询索引为 work 的 `_stage5.scopeId, state, nextAt`；其余按确定性文档 ID 访问。现有 teachers 仅作可信登录身份对应关系的只读查询，不写历史学生集合。

## 入口

|函数|身份及范围|
|---|---|
|stage5_orders|原生 WXContext APPID/OPENID + teachers 身份记录 + 测试处理名单；新单/签名还要求购买名单、开关、TEST 商品、渠道|
|stage5_payment_notify|官方加密通知验签解密；无需小程序用户身份；先查本批次既有受控订单，再复用 Stage3 核验/发放|
|stage5_compensate|受保护内部密钥的批次派生 HMAC，时间窗/nonce 防重放；只读本范围任务及订单；无客户端任意扫描|
|stage5_access|可信老师及测试名单、目标学生归属；事务复用同一账本|
|stage5_admin|独立会员管理员名单 + 目标测试老师；不继承 repairNames 授权；人工补开必须读取签封官方证据|

五个 `index.js` 导出 main；`runtime.js` 每次调用重新取得身份，不缓存调用者。原生传输附加 userInfo/tcbContext 被丢弃，不能作为身份。通知网关保存原始字符串正文，GET 验证、POST 加密通知适配源码已具备，真实网关事件格式仍待联调。

## 作用域与已付款订单保全

普通文档 ID 与 envelope 都绑定应用、云环境、OfferID、支付环境、来源及服务端批次。synthetic 与 real_payment 隔离；synthetic 入口禁止支付下单、通知、补偿及 payment 类型 grant，只允许受控非付款状态构造。

真实 claim 不包含批次：包含应用、OfferID、支付环境、来源及 Stage3 交易键。同一真实交易不能跨批次领取；新订单意图键包含作用域，通知、查单、补偿、管理员补开使用同一占用和发放入口。权益汇总、学生和免费名额按相同作用域持久化；同批次重启不重置名额。

purchaseEnabled/batchClosed/purchaseTeachers 控制新购买，不改变 scope。关闭后保留 processingTeachers、原批次及既有订单快照，继续处理迟到通知、补偿、退款通知和本人查询。**有未结订单时不得删除处理名单成员、替换批次配置或销毁旧入口**；合成状态阶段切换至实付阶段前先完成合成阶段，真实批次进入后保留至结算完毕。跨批次仅验证隔离和唯一性，本轮未创建多个云端运行版本。

无效通知只写固定容量拒绝环（每 scope 最多 384 个槽），不保存正文、签名或身份；失败仍拒绝。合法事件、工作、审计和防重放记录均在上述固定集合。损坏任务/非法作用域 fail-closed，需受控复核，绝不回退普通集合。

## 配置和证据接线

`config.example.json` 是缺项默认拒绝的模板，必须通过受保护 `STAGE5_CONFIG_JSON` 配置。空 OfferID/名单等不会被 fixture 替代。fixture 账号仅存在 test 目录，不是授权真实测试老师。

安全提供者读取受保护环境注入：MEMBERSHIP_APP_SECRET、MEMBERSHIP_ACCESS_TOKEN、MEMBERSHIP_LIVE_APP_KEY / MEMBERSHIP_SANDBOX_APP_KEY、MEMBERSHIP_NOTIFICATION_TOKEN、MEMBERSHIP_NOTIFICATION_AES_KEY；内部调度用 STAGE5_INTERNAL_KEY，核单证据用独立 STAGE5_EVIDENCE_KEY。各函数只授予自身需要的配置访问权限。实际安全存放、令牌轮转/自动刷新尚未完成；缺项或过期拒绝，不降级验签。

人工补开只接受证据 reference。读取本范围 audit 中 `evidence_<hash(reference)>`，校验独立审核人、sourceReference 和 HMAC(scopeId, reference, reviewerId, sourceReference, evidence)，再交 Stage3 比对订单事实和真实付款时间。HMAC 证明受控证据来源，不自行证明平台成交：后续必须由获授权的官方核单流程获取、核实、签封并导入证据；本轮未开放导入接口、没有真实核单记录，不能人工填 verified=true 跳过。测试中的签封事实明确为本地 fixture。

## 事务和本地包

基于已有 CloudBase startTransaction/get/set/commit/rollback 适配；冲突有限重试，事务内没有支付/发货外部请求。账本、grant、汇总、名额/学生投影、管理员审计同事务提交。保存付款事实与发放分离，失败可恢复。沿用既有文档容量/操作数上限，超限安全拒绝并需复核；未声称无限容量。

`scripts/build-stage5-packages.cjs <新绝对输出目录>` 只生成五个独立本地包，包含共享模块闭包，不包含测试、repairNames、密钥、UI；拒绝覆盖现有目录。依赖锁定 @cloudbase/node-sdk 3.16.0 和 wx-server-sdk 3.0.1（本轮仅核对注册表版本存在，未安装）。清单 Nodejs18.15 需下一轮确认目标运行时/SDK部署可用性，不能把本地打包当云端部署成功。

## 验证与下一轮授权

本轮：Stage5-D 46/46；Stage2 72/72、Stage3 118/118、Stage4 79/79 必要回归（共269）通过，无失败/待办。本地 SDK fixture 证明契约与故障恢复，不证明真实 CloudBase 事务/权限。repairNames 的既有真实门禁证据继承，不重跑。

下一轮最小范围：确认专用真实测试老师及独立会员管理员；配置受保护批次和身份；审核 deployment.js 后仅创建上表12集合、客户端禁读写规则、1复合索引、5运行入口及其最小调用权限；初始关闭购买和自动调度。确认共享环境资源额度/费用及回退配置后，授权限定测试数据与真实事务/越权测试。通知路由/安全配置变更须明确授权后再做；真实凭据接线、官方账号/商品/渠道匹配、测试商品及令牌管理仍待完成。

只清理获批批次的模拟数据；真实交易 claim、订单、grant、退款和审计不得作为测试垃圾删除，尤其不能删除跨批次唯一占用。测试结束关闭新购买，保留合法旧单处理。真实付款另停一次展示真实账号、平台、商品、金额、12个月权益和环境，用户确认后本人完成付款；399元实付未授权。
