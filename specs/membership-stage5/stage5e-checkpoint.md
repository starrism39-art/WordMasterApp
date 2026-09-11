# Stage5-E 云端检查点：PARTIAL（2026-09-09）

环境 cloudbase-4gafzdch60ad597b，AppID wx930eccb9442dc8f3。本轮已获授权创建12集合、权限、1索引、5事件函数及有限模拟数据；没有支付平台订单、付款、正式商品或会员权益操作。

## 部署

Stage5-D固定12集合已创建，逐项回读 SecurityRule 为 `{"read":false,"write":false}`。work 的 stage5_due 复合索引为 `_stage5.scopeId, state, nextAt`。未修改既有全局函数调用规则；原生调用沿用认证要求，五个入口继续各自的身份/范围守卫。没有开启网关、公众平台回调或定时器。

|入口|平台代码包 SHA256|状态|
|---|---|---|
|stage5_orders|5e144322f4bca9c0a992966995f6b3add78fae729f401d03b65d83e00debb8f9|Active|
|stage5_payment_notify|d5c45bdef9f86ea1bb27b926a85727b1043c96134a22532e65d6be22b28dfb62|Active|
|stage5_compensate|c71ff9b29bfd0e42670f9be5297a5af80eb59b56518a91af3c7392789519c4d0|Active|
|stage5_access|1d1483989876e8d5bda398ca2ae931270100c388331d59952d7af950915a2943|Active|
|stage5_admin|ec70cc1e4d5541c5d950dcca2823d0470aa48d91a75ea439106ffe5a1fe164a6|Active|

全部 Nodejs18.15。access 下载包 SHA256 与平台一致，27个源码/清单条目与本地逐项相同。五包代码摘要及部署结果见 `D:/membership-backups/stage5e-20260909/deployment-summary.json`。

配置仅 STAGE5_CONFIG_JSON；模拟域 `stage5e_synthetic_20260909`，新购买关闭，购买名单和管理员名单为空，无支付凭据。MCP对环境变量值回读脱敏，因此不宣称明文逐值回读核验；受保护提交配置已保存，实际拒绝及真实客户端进入权限服务的行为分别留证。

真实身份：“张张张123”，oPLF…eKgs，指纹 2c5774e4d0ff。复用此前真实小程序证据并只读重查 teachers 记录，teacher_id/_openid一致，绑定本环境AppID。没有继承repairNames管理员授权；iOS候选未绑定。没有修改生产teachers。

## 本轮实证

- 用户提供真实小程序执行结果：12集合 × read/create/update/delete，共48项均为 -502003 DATABASE_PERMISSION_DENIED。不是文档不存在或参数错误。结果保存在 client-phase1-results.json。
- 随后权限入口通过真实身份、测试名单和老师记录校验，但脚本遗漏 request.action，权限策略拒绝 INVALID_ACTION。没有因此修改策略或重新部署；续跑脚本已补 ADD_STUDENT，保留已通过48项。
- 真实SDK管理侧适配器：并发首名学生仅一方成功、重复请求幂等；中途两次数据库写入后注入失败，名额/学生/账本/投影/审计均回滚；固定学生竞争保留一个选择；不同模拟批次相互隔离；模拟付款grant安全拒绝。
- 固定学生测试脚本最初误断言只有一条审计。真实结果是一项选择、一个retain操作、Stage2 retain_student与Stage4 retained_student_selected两条不同审计。修正断言后在新独立模拟批次验证通过，旧证据未覆盖，没有业务代码变更。
- 真实数据库合成占用探针：跨批次同一确定性键仅一方占用、同一方重试幂等、占用与审计写入失败共同回滚。该探针 kind 明确为非支付claim，不是官方交易，也没有通过付款引擎授予权益。
- 云端管理调用：access/orders/admin 无真实小程序上下文时 IDENTITY_NOT_VERIFIED；补偿在模拟域先被 STAGE5_REAL_PAYMENT_ONLY 拒绝；通知返回503。不能把这些当普通小程序用户或内部HMAC路径已实测通过。
- 7个既有云函数的ID和ModTime均未变化；repairNames本地hash未变。没有改原学生、学习数据、同步、共享页面，没有commit/push。

## 最小改动及测试

Stage5 policy 允许严格 synthetic + 关闭购买 + 空购买名单时使用 null OfferID/originalId，以免为非支付权限测试虚构支付配置；real_payment 仍必须提供合法支付身份。新增模拟域及显式action契约测试，最终本地48/48。Stage2 72、Stage3 118、Stage4 79继承Stage5-D证据，没有重跑无关历史测试。

本地打包所需固定SDK依赖仅安装在本轮备份包目录，不安装/升级全局工具。相关源码和原测试文件修改前备份在 stage5e-20260909。没有修改 Stage2～4产品语义。

## 数据和未完成项

保留12个专用权限哨兵（kind/purpose明确，不是订单/grant事实）、模拟学生/账本及必要审计、独立合成占用探针。回查哨兵未被客户端更新/删除，禁止创建的探针不存在。未清空或删除任何集合。保留失败现场与后续独立批次证据。

续跑结果已收到并存档：client-phase2-results.json，9/9通过；与前48项合计57项真实客户端检查通过。可信老师成功查询免费权限（requestID 9a286684-60dd-41cc-8648-6c971b0fc5eb）；伪造teacherId/collection/env/batchId均为UNEXPECTED_FIELDS；普通测试老师管理操作为STAGE5_ADMIN_REQUIRED；并发首名学生仅一方成功（98ba5f5c-8156-4a8b-80aa-5a9499163254），重复请求返回相同结果（3535236d-3338-4d96-9389-cf96e9b4c0b9）。原始附件另存，解析时只移除粘贴形成的反斜线下划线/尖括号转义和JSON后的附言，不改变结果。

下单和签名请求实际错误均为STAGE5_REAL_PAYMENT_ONLY：证明当前模拟部署不能签发购买，不能据此单独证明purchaseEnabled分支或非TEST商品分支已经真实云端验收。内部补偿同样被模拟域前置拒绝，未穿过该门禁实测HMAC分支。相关本地契约证据继续保留，不混同云端证据。

本轮必测尚缺：名单外真实账号调用、他人现存订单/测试学生/权益的跨账号访问验证。不能用客户端伪造字段、随机不存在的订单或fixture替代。没有为消除缺口放开名单、创建真实订单或填入虚假OfferID。

OfferID/渠道/商品、支付凭据与令牌管理、官方通知路由及调度、会员管理员正向、实付/退款/跨设备和业务页面接入继续为后续独立范围。真实迟到通知、已付款补发和退款撤权未实测。购买关闭的本地旧单处理证据继承，不把模拟域拒绝当真实旧单处理通过。

因此当前裁决仍为PARTIAL：部署、57项真实客户端检查和上述真实数据库适配器专项通过；本轮不再等待第一位老师的续跑结果，也不重复这些检查。整阶段尚缺跨账号实证，脚本pass=true不等于未覆盖项目通过。下一步仅安排第二个自有真实账号的定向越权补验，先核实身份、保持购买关闭，不自动绑定管理员、不付款。支付配置依赖分支保持未就绪并单列，不能借补验绕过现有安全门槛。
