# Stage5-A 共享环境强隔离预部署门禁

2026-09-08 22:41 +08:00。结论：BLOCKED，禁止按现有源码直接部署。共享环境是用户选定的首选方案，尚不是已证明安全的运行域。本文是部署合同，不是资源创建脚本或云端验收PASS。

## 证据和保护范围

- 工作区 D:\WordMasterApp-Membership-Stage2-20260908；分支 codex/membership-stage2-20260908；HEAD 14129f96d8581968e4fdad8551cc1a47d7a4aa55。保留全部已有未提交内容，不commit/push。
- 管理认证：现有CloudBase MCP设备授权后返回READY、account scope、ap-shanghai；自动绑定唯一候选 cloudbase-4gafzdch60ad597b，环境NORMAL。未导出凭据、未安装工具。管理认证不等于手机OPENID或运行时SDK凭据已接线。
- queryFunctions(listFunctions)真实返回7个Active函数：login、repairNames、updateStudentStats、syncMasteryAtom、teacherWordbook、announcement、syncTombstoneAuthority。RequestId 50153975-d25d-427e-b46f-9a06685920db。无stage5或membership函数。
- readNoSqlDatabaseStructure(listCollections)返回20个集合，分页总数20；无stage5_、membership_集合，目标12个名字尚不冲突。RequestId cc063dcf-ea85-4574-bdbf-43ed17cc3514。只读结构，没有扫描普通老师内容。
- repairNames调用权限实读：CUSTOM，SecurityRule={"*":{"invoke":"auth != null"}}，RequestId c119819a-aa55-457f-a7c2-70c1631aa53f。认证用户可调用这一规则不是管理员隔离证据。
- 本地 repairNames/index.js:95 将event.collection直接作为集合；后续以服务端权限查询/更新student_name、teacher_name；未见入口管理员检查或集合允许列表。没有执行函数，没有证明能任意写支付字段，也尚未比对云端源码。本地风险与云端调用规则组合足以阻止“旧入口已隔离”的结论；下一轮须只读比对云端版本并在授权后限制该旧入口，不能只给测试集合加前缀。
- 云查询并发期间出现本地mcporter连接/锁文件错误；待前次结束后串行权限查询成功。这是工具连接故障，非公众平台访问许可；未清理锁、未换认证方式绕过限制。
- 只核对同步代码集合路由。cloud-sync使用既有学习集合；syncTombstoneAuthority的动态helper由固定集合调用。未重开同步专项、未改冻结代码、未证明所有历史客户端版本。

## 身份和平台配置

候选张张张123/Android、教师1111/iPhone仍为AWAITING_REAL_LOGIN；OPENID指纹、teacherId指纹、会员/历史赠送/学生基线均未知。既有login云函数存在不等于本轮已取得两位老师可信调用结果；不能按昵称挑记录，不能把集合不存在解释为老师没有历史权益。teacherId在当前适配器中等于OPENID，报告同样脱敏。

绑定方法：本人在AppID wx930eccb9442dc8f3正常进入小程序；从该会话可信getWXContext取得APPID/OPENID，核对唯一teachers.teacher_id及用户指定候选；只读本人会员/学生状态后保存来源与时间。Windows用相同微信账号重读相同指纹。只把实际键存受保护服务端名单；仓库仅存指纹。若档案缺失，停止该账号，不创建。未建立可用采集通道前，不要求用户反复登录来凑证据。

实际OfferID及AppID绑定、四渠道启用、正式399商品/TEST商品存在性与价格、通知订阅地址、凭据状态均未核实。CloudBase集合中没有商品集合不代表公众平台没有商品。公众平台已有明确工具安全拒绝，本轮未重访、未换工具绕过。

后续最小人工配置证据：微信公众平台目标小程序“虚拟支付”官方页面的非敏感AppID/OfferID对应信息；商品管理中正式及TEST商品ID/状态/渠道/价格与最低可配置档位；通知订阅/接收状态；密钥仅说明已配置及安全存放位置。遮挡全部AppKey、AppSecret、token、session_key、EncodingAESKey、扫码凭据。若页面名称不同以当前平台导航为准，不假设存在mode开关。此次不要求联系官方、不要求修改任何配置。

官方金额依据继承前轮已读文档：
- https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html ：iOS最低1元、仅现网；当前账号实际可售最低价仍待确认。
- https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html ：goodsPrice单位分、与商品配置一致；不能由此证明Android可收0.01元。Android实际最低价未知。

本地合同按Android/iOS两个独立TEST商品映射规划，每个绑定相应测试老师和已核实渠道；不宣称平台强制分别建商品。是否已有商品可复用待查，不动399商品。不再研究mode理论，证据不足保持PAYMENT_PENDING_REVIEW。

## 最小集合（拟议12个，尚未创建）

下列每个集合客户端直接读/写均应为false；通过函数只返回本人必要数据。管理员也不能绕过业务契约直接改会员标志。表内读写为拟议业务入口，真实服务端角色/资源策略能否限制到这些集合须云端核实，不能认为客户端规则限制了拥有管理权限的SDK。

全部记录由服务器固定写testOnly=true、batchId、appId、teacherId（适用时）、provenance=real_payment或synthetic。客户端不能选集合/环境/批次。模拟状态和真实付款不得共用同一账本主键；批次进入账户、账本、学生和请求幂等键，平台真实交易claim则保持同一应用/支付环境内不可跨批次重复领取。通知只能进入真实付款批次，不接受模拟事件标志。

| 集合全名 | 服务端读/写职责 | 唯一性与事务要求 |
|---|---|---|
| stage5_membership_products | orders读取；受控管理员配置 | TEST商品ID确定性_id；关闭购买不得删除旧快照 |
| stage5_membership_orders | orders/notify/compensate/admin | 订单ID；状态/交易关联事务，固化原商品和真实paidAt |
| stage5_membership_payment_intents | orders | batch+teacher+requestId确定性_id；与下单原子提交 |
| stage5_membership_payment_claims | notify/compensate/admin | app+支付env+平台交易号确定性_id；冲突拒绝，不覆盖 |
| stage5_membership_payment_events | notify/compensate/admin | 事件/内部nonce确定性_id；脱敏摘要及重放去重 |
| stage5_membership_payment_work | orders/notify/compensate/admin | 每订单任务ID；付款事实/任务原子持久化；state+nextAt查询索引 |
| stage5_membership_ledgers | notify/compensate/admin/access | batch+teacher单一修订行；并发权益和名额适配须同事务，不另建平行账本 |
| stage5_membership_grants | notify/compensate/admin写，access读 | payment grant由原订单确定；与账本/account/audit同事务 |
| stage5_membership_accounts | 发放/调整入口写，orders/access读 | batch+teacher确定性_id；可重建汇总，禁止客户端isVip权威 |
| stage5_membership_admin_audit | 受控变更入口写，admin读 | 操作ID去重；before/after/operator/reason/reference与变更原子提交 |
| stage5_teacher_student_access | access/admin | batch+teacher确定性_id；名额/固定学生与学生及ledger同事务 |
| stage5_test_students | access/admin | batch+teacher+studentId；新增名额原子占用；删除不恢复免费次数 |

前10项对应Stage3现有10个repository角色，只做测试名称映射，不创建另一套payment_events或payment_orders。后2项承接Stage4学生权限模型；细化适配时必须让ledger内access/students快照与分集合行在同一修订/事务更新，禁止两个独立写主。无需membership_sessions；无需test_identities集合，名单用受保护配置。请求去重记录复用现有模型及audit，不为“可能需要”创建新集合。

## 最小运行入口（5个拟部署名，不代表现有可部署包）

| 名称 | 复用源码/调用方 | 身份与敏感配置 | 网络和调度 |
|---|---|---|---|
| stage5_orders | Stage3 createClientHandler；本人小程序 | getWXContext+唯一老师映射+全局测试名单；支付签名凭据仅服务端 | 仅小程序入口，不混HTTP；含本人只读订单/身份 |
| stage5_payment_notify | Stage3 createNotificationHandler；微信平台 | 官方验签解密+原订单绑定+名单/商品/batch检查 | 独立HTTP；先核既有通知消费者共存，不覆盖旧地址 |
| stage5_compensate | Stage3 internalHandler/engine；受保护后台 | HMAC时间窗/nonce防重放，内部密钥；限定TEST任务 | 客户端禁止；未来可信调度器签发请求，不把普通timer当已认证 |
| stage5_access | Stage4 authorizer/service；本人小程序 | 可信身份+名单；真实CloudBase readSnapshot/事务适配待实现 | 测试学生集合；不接共享业务页面 |
| stage5_admin | Stage2/3/4管理员契约；独立管理员 | 独立管理员认证、目标测试名单、受控官方证据读取；不可自填已验证 | 客户端普通调用禁止；无完整后台UI |

现有runtime为工厂，未提供完整部署入口；admin身份/证据适配尚未接线，access持久化适配待做。凭据提供者已有缺失即拒绝；实际凭据注入/令牌轮换未验证。不可把浏览器或MCP凭据复制到函数配置充当支付凭据。

## 门禁检查与差距

本轮只运行既有测试的定向选择：Stage3/4共24项，24通过、0失败；没有新增弱化断言、没有全量重复回归。15项基础安全选择+4项非管理员grant拒绝+5项客户端伪造字段拒绝。覆盖测试商品白名单、本人订单查询/签名、非法通知、内部重放、缺凭据、非管理员及gift/调整拒绝、金额/期限/身份字段拒绝。全部使用隔离fixture；尚未绑定真实两人或执行云端权限/事务测试。

| 门禁 | 当前证据 | 判定 |
|---|---|---|
| 普通用户知道TEST productId仍拒绝 | Stage3商品级白名单本地通过 | 基础契约PASS；真实名单未绑定 |
| 金额/老师/期限由云端决定 | 严格请求字段拒绝，本地通过 | 基础契约PASS |
| 非管理员不能补开/gift | 本地契约通过，部署适配缺失 | 云端未验证 |
| 全入口TEST限定 | 无全局白名单/批次守卫；正式型商品并非一律拒绝 | BLOCKED |
| 集合强隔离 | repository硬编码未加前缀集合；未实现映射 | BLOCKED |
| 客户端直接禁读写 | 目标集合未创建，无规则或实测 | 未验证，不当作现有权限 |
| 老入口不绕过 | repairNames本地任意集合参数，云端Active且auth!=null | BLOCKED，需比对云端源码并消除通路 |
| 普通学习同步不读TEST | 本地所检查路由没有TEST集合 | 有限静态证据；旧服务端入口缺口未闭合 |
| TEST/正式及模拟/实付区分 | 名称/批次设计已定义，未落实代码 | BLOCKED |
| 正式399不受影响 | 本轮零云写；商品实际配置未知 | 本轮未改；未来隔离未证明 |

共享环境只可作为首选，当前不能正式放行部署。不调用旧业务学生入口证明测试权限；老页面继续使用旧规则，本阶段不宣称全产品强制会员权限已接入。Stage7再协调业务接入。

## 下一轮最小范围、授权与退出

先完成必要本地隔离适配（上述固定12集合映射、batch键、全入口测试名单、admin/access接线），并只读比对repairNames云端源码/权限。若云端同样有任意集合写入通路，须单独授权限制该旧函数允许集合/管理员调用；不能修改冻结同步绕路。本轮不修该函数。

随后才申请：在指定共享环境创建12集合、确定性_id及work索引、客户端禁读写规则、5个函数与受保护配置；初始purchaseEnabled=false，限专用测试老师/独立批次。云端并发/回滚/越权测试需单独授权写入范围。真实名单未绑定、平台配置未知或旧函数通路未消除时，不申请直接部署现有包。

平台另行授权：两TEST商品配置、通知路由/订阅、凭据接线；各笔实付前仍展示账号指纹/商品/平台/金额/12个月/环境，用户确认并本人付款。正式399不动。Android退款和gift按既定后续矩阵执行，本轮均不执行。

共享环境会消耗现有配额，不承诺零费用；需升级/购买先停。测试结束关闭TEST购买；保留原订单、grant、退款与audit，只清理已授权可识别临时数据。关闭购买不能停掉已付款补偿/必要退款处理。

本轮仅修改本目录文档/候选合同；旧文件完整备份并SHA256核对：D:\membership-backups\stage5a-contract-20260908-224131。未修改Stage2/3/4源码、学习同步、共享页面；未创建云资源、业务数据、商品、订单或权益。
