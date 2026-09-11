# Stage5-F 检查点：最终 PASS（2026-09-11）

## 最终状态与结论

- 首次 TEST 真实支付与跨设备恢复：**PASS**；Stage5-E：**PASS**；Stage5-F：**PASS**；整个 Stage5：**PASS**。
- 继承冻结验收和本次已完成的真实付款证据：TEST_teacher_12m_a实付0.01元，12个月会员active，1笔订单、1次grant，账本与账户一致，到期时间2027-09-11 10:42:30不变。
- 最新既有云端观察为2026-09-11T03:11:46.059Z，证据D:\membership-backups\stage5-first-payment-20260910\payment-observation-1789096306062.json；补偿已运行5次仍未重复发放。保留work的pending/paid_delivery观测事实，不将其误写为队列已清空；本次约定验收已完成，不新增验收项。
- 用户随后分别确认“电脑版没问题了”“手机版也没问题了”，两端新版截图均显示active及相同到期时间，完成原跨设备恢复缺口收口。具体记录见cross-device-recovery-20260911.md。
- 正式399商品仍关闭，TEST新购买已关闭；未正式发布。无需追加新的验收项目。
- 临时观察任务test已按用户要求删除，删除不影响验收PASS，未关闭云端notify/queryOrder/grant/compensate。
- 本次仅更新文档最终结论；不重跑测试、不改代码、不部署、不付款、不commit/push。下面的等待付款、PARTIAL等均为历史快照，由本节最终结论取代，不再作为待办执行。

## 历史过程记录

目标：READY_FOR_TEST_PAYMENT。以当前已激活Goal的授权与暂停条件为准：必要Stage5 TEST修改、部署、通知/凭据/调度接线自主推进；外部身份/密钥等受阻时只暂停对应部分，继续独立工作。下文早期“唯一前置阻塞”等是历史快照，不再作为全任务暂停依据。

工作区 D:\WordMasterApp-Membership-Stage2-20260908；分支 codex/membership-stage2-20260908；HEAD 14129f96d8581968e4fdad8551cc1a47d7a4aa55。目标CloudBase cloudbase-4gafzdch60ad597b；本地AppID wx930eccb9442dc8f3。
Stage5-E最终PASS继承 stage5e-order-read.md 的2026-09-10追加裁决。旧 stage5e-checkpoint.md 中早期PARTIAL不是最新裁决。不重跑已冻结测试。

## 本轮已取得证据
- predeployment-gate.md 明确记录公众平台已发生工具安全拒绝。没有重新访问或换工具绕过。
- 既有实际OfferID/AppID绑定、四渠道启用状态、正式/TEST商品配置及价格、通知订阅和实际凭据状态未核实。
- stage5e-checkpoint.md 记录模拟域、购买关闭、无支付凭据；这只证明当时部署状态，不能推断公众平台未配置，也不能替代当前云端回读。
- 已读取 qiaomu-goal-meta-skill；它主要生成目标指令，本任务目标已明确，不为使用skill重写目标或增设测试。
- 按CloudBase项目规范确定先证据后接线；未进行平台接口字段推测。

## 当前唯一前置阻塞与人工动作
请用户自行登录微信公众平台，选择AppID wx930eccb9442dc8f3对应小程序，打开现有“小程序虚拟支付”的能力/基础配置页（按当前导航实际名称）。仅提供非敏感的AppID、OfferID/等价支付标识及能力开通状态；若页面实际显示其他名称，保留原文，不假设存在mode开关。截图必须遮挡AppSecret、AppKey、Token、EncodingAESKey、二维码及其他凭据。无需创建商品、改配置或付款。
收到该账号绑定证据后，先核对当前官方文档与代码，再继续当前账号的渠道/商品/最低金额和安全接线。不同时索取所有未来上线资料。

## 本轮状态
PARTIAL；没有达到READY_FOR_TEST_PAYMENT。
无业务代码修改、云资源修改、部署、TEST商品创建、购买开关更新、真实订单、付款、权益发放、Git提交或推送。仅新增本检查点。
未发现新的P0/P1，但没有做全面安全审计；不将未知配置记为安全通过。
目标尚未完成；等待人工账号依据，不能因达到人工暂停点把READY目标标记完成。

## 2026-09-10 用户提供的实际公众平台证据
- 基本配置截图：AppID wx930eccb9442dc8f3 对应 OfferID 1450631819；平台路径及苹果IAP开关均显示关闭。AppKey只显示查看入口，未展示原值；不能推断运行时已接线。
- 道具配置截图：线上和开发版本列表均无数据，搜索框为空；本轮未创建/修改正式399商品或TEST商品。
- 添加道具表单：普通道具选中，会员订阅道具显示灰色；道具ID支持英文/下划线/数字不超过20位；名称不超过20位；图片PNG/JPG、200x200、小于200KB；提交动作为“提交审核”。自定义关联未展开新字段。
- 用户反馈：价格提示0-10000；输入0.01并移开焦点没有报错。证据级别仅为前端表单接受，不证明官方最低实付金额、审核通过或实际渠道可用。
- 定向公开检索未取得最低金额及会员道具类型的明确官方说明；两个现有官方文档地址本轮读取失败。未因此改走普通微信支付、猜测最低金额或提交审核。
- 当前平台绑定证据缺口已关闭；后续仍须核实商品类型适用性、渠道实际状态与可审核/可支付金额。暂不声称READY。

## 2026-09-10 官方正文读取成功（替代上文“未取得”快照）
通过 agent-reach 的 Jina Reader 读取公开微信官方页面；没有访问此前被拒绝的公众平台账号后台。
- 总指引：https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html 。虚拟商品范围明确包括解锁功能、订阅内容和付费功能；道具直购与代币充值分别说明。Android/鸿蒙/Windows路由微信支付，iOS路由Apple；这是官方支持范围，不是本账号逐渠道实测。
- iOS官方条件：iOS>=15、微信>=8.0.68、中国大陆App Store账号、最低1元、仅现网不支持沙箱；还需开通Apple支付及配置小程序简称。现有截图Apple开关关闭，仍未就绪。
- 道具上传：https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_start_upload_goods 。price单位分且大于0；1分是安卓TEST候选配置依据，不等于本账号审核或实付已通过。需要access_token和pay_sig，不支持云调用，不能拿CloudBase管理认证替代。
- 普通直购API：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html 。short_series_goods对应道具直购；productId发布/审核/价格有平台错误码校验。业务采用一次购买后服务端发12个月权益，保持不自动续费。
- 订阅扣款API：https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_submit_subscribe_pay_order.html 。订阅道具对应另有预通知及发起扣款流程。本业务不接入该流程。普通道具直购作为本业务实现选择，不将后台灰色按钮臆断为账户资质结论。
- 官方通知要求：xpay_goods_deliver_notify包含业务订单号、Env、GoodsInfo；WeChatPayInfo非微信渠道可能没有。现有代码需按渠道继续核对，不能把安卓通知样式默认用于iOS。发货响应格式错误最多重推15次；保持已有证据不足人工复核规则。
- 下一项人工操作为后台独立安卓TEST普通道具资料提交；建议ID TEST_teacher_12m_a，名称TEST教师年会员，价格0.01元，关联自定义，备注12个月不自动续费测试。仅提交审核，不发布/付款；图片须符合后台200x200、PNG/JPG、200KB以内。此处为待执行方案，未创建商品。
本次只追加官方依据，未修改业务源码、云资源、平台配置、权益或Git状态。仍为PARTIAL；需后续实际商品审核、凭据安全接线、通知及补偿配置后才能READY。

## 2026-09-10 通知接线前实际核对（用户确认继续后）
- 用户截图已显示开发版本 TEST_teacher_12m_a / TEST教师年会员 / 0.01元 / 未发布，图标正常。只确认后台创建成功，不等于商品已发布或实付通过。正式商品未修改。
- 用户打开消息推送配置表单：URL、Token、EncodingAESKey空；未取得提交成功或启用成功证据，不能把打开表单等同于配置生效。
- CloudBase MCP auth(status) 本轮 READY，目标 cloudbase-4gafzdch60ad597b，ap-shanghai。
- queryFunctions(getFunctionDetail): stage5_payment_notify Active，Nodejs18.15，ModTime 2026-09-09 11:53:02，请求2172797b-7237-426e-86fe-50e7cd1991f1。仅有 STAGE5_CONFIG_JSON 环境变量，其值被工具脱敏；没有 MEMBERSHIP_NOTIFICATION_TOKEN / MEMBERSHIP_NOTIFICATION_AES_KEY。不能根据脱敏值验证当前scope内容，未覆盖配置。
- 当前函数详情加密快照：C:\Users\15189\AppData\Local\Temp\stage5f-notify-read-20260910-103217.dpapi。此为只读详情证据；尚不是含代码包和可恢复完整配置的部署rollback point。
- queryGateway(listRoutes): routes=[]，默认HTTPSERVICE域名存在；总数1表示返回的域名项，不能误判为已有函数通知路由。请求fa30a76a-91d9-4e24-9a51-e709f0b17249。
- queryGateway(getPrivilege): enableService=false，enableAuth=false；请求5da5d5b6-bda3-4a9c-96cb-7dff4f1858b8。尚未开启网关。
- 当前本地通知实现为安全模式JSON；GET验证token/timestamp/nonce/signature并原样返回echostr；POST校验签名、AES解密、AppID与ToUserName原始ID。不能按表单默认的明文/XML配置。
- 现有配置模板及已保存Stage5报告没有真实gh_原始ID。云端当前配置值脱敏，本轮不能证明其是否已含该值。为建立真实应用通知绑定需用户提供/核实小程序原始ID，不伪造，不跳过ToUserName校验。
- 下一项最小人工动作：在公众平台当前小程序账号基本信息查“原始ID”（gh_开头，非密钥），只提供这一个值。然后继续准备加密配置、可靠rollback、现有函数HTTP路由及无付款的挑战验证；尚不填写/提交公众平台表单。
本轮仅源码阅读、云端只读查询和检查点追加；无代码修改、部署、云资源/权限修改、订单、付款、权益发放或commit/push。Stage5-F仍PARTIAL，原Stage5-E证据继承。

## 2026-09-10 通知接收地址接通，等待用户提交官方表单
- 用户提供原始ID gh_15fee9cefa8b，按当前AppID受控通知配置使用。GET挑战不能证明真实商品通知中的ToUserName，后续仍由加密通知校验。
- 仅更新 stage5_payment_notify 环境配置：OfferID 1450631819、originalId、env=0、source=real_payment、batchId=stage5f_real_20260910。沿用两位已批准真实测试老师processing名单，purchaseTeachers=[]、administrators=[]、enabledChannels=[]、purchaseEnabled=false。其余四个Stage5函数未改；其当前模拟域并未一起迁移，后续真实支付准备仍需协调相同real scope。
- 生成独立通知Token及EncodingAESKey，保存Windows DPAPI，并写入通知函数受保护环境变量。未配置支付AppSecret/AppKey/access_token，不把通知密钥等同于付款凭据。
- 旧包 SHA256 d5c45bdef9f86ea1bb27b926a85727b1043c96134a22532e65d6be22b28dfb62 已下载校验并保留；notification handlers/crypto/Stage5 runtime与本地对应文件一致，未修改或部署源码。恢复依据在 D:\membership-backups\stage5f-notification-20260910\rollback.md；完整配置历史值使用此前受保护提交记录，云端同ModTime和唯一变量名已核对，未把脱敏星号当可恢复值。
- 更新后Active，ModTime 2026-09-10 10:43:11；变量仅原STAGE5_CONFIG_JSON和两项通知密钥。运行时、入口、角色、超时、内存、VPC、依赖、触发器及代码大小等非目标配置比较无变化。云端变量值仍脱敏，不宣称全部逐值回读；Token通过真实HTTP挑战验证。
- 新建HTTP路由 /stage5/payment-notify，指向已有Event函数stage5_payment_notify。地址 https://cloudbase-4gafzdch60ad597b-1390590336.ap-shanghai.app.tcloudbase.com/stage5/payment-notify 。路由auth=false以接收微信服务器通知，保持应用内官方验签/解密及测试订单约束。创建前无路由，已开启环境HTTP网关；未改变原网关鉴权开关。
- 函数资源调用规则没有修改，保留原auth != null。公网路由实测可到达处理器，不再为了形式修改函数权限。数据库权限及其他资源规则未修改。
- 真实HTTP（非真实付款通知）3项：合法GET200且echostr完全一致（请求b6490f33-ae64-493d-a4ab-c9b2f860b6f5）；错误签名GET403（请求92db3218-f722-4652-b938-fa7b9d6d0f15）；未签名空POST503/retry。测试未携带任何付款事实，仅可能写入现有Stage5测试events中的有界脱敏安全拒绝记录，无订单、payment grant或真实权益。
- 本轮仅运行2项相关既有本地测试：GET verification challenge / unsigned input never reaches engine，2/2通过。未重跑Stage5E 57/48等冻结验收。
- 本机遮挡密钥的配置窗口已启动，脚本 D:\membership-backups\stage5f-notification-20260910\open-notification-config.ps1 从DPAPI读取，用户点击才复制；没有明文密钥进入聊天、Git或日志。
- 下一项用户动作：将本机窗口的URL/Token/EncodingAESKey填入官方表单，选择安全模式和JSON，点击提交。不要随机生成另一把key。尚未取得官方提交成功证据，不声明消息推送已启用。
Stage5-F仍PARTIAL：这里只准备了通知传输入口；TEST商品未发布、其他支付凭据/参数链路/补偿调度仍未就绪。无平台订单、无实付、无会员发放、无commit/push。原Stage5-E源码与证据继承。

## 2026-09-10 Goal续跑：受保护令牌与补偿定时器适配
- 冻结继承Stage5-E PASS。当前分支仍codex/membership-stage2-20260908；repairNames及project.config.json既有dirty未触碰，无commit/push。
- 上轮stable-token.js及对应15项测试已在本地。本轮核对源码：Stage5使用官方stable_token普通模式(force_refresh=false)，按平台expires_in提前刷新、并发合并、密钥轮换不复用旧缓存；失败不回退静态/过期token。缓存限provider实例，不声称跨实例分布式缓存；尚无真实AppSecret接入或真实token调用证据。
- 官方通知总指引允许返回success或空内容等价ErrCode=0，现有HTTP应答没有为此改写。HTTP挑战成功不等于公众平台配置成功或真实商品通知成功，早前“系统繁忙”仍没有官方提交成功依据。
- 新增cloudfunctions/membership-stage5/timer.js，接入runtime.compensate。固定触发器stage5_compensation_5m；保护开关STAGE5_SCHEDULE_ENABLED必须为字符串true，内部密钥STAGE5_INTERNAL_KEY至少32字节。可信上下文须SOURCE精确wx_trigger、ENV匹配、无用户OPENID/FROM_OPENID，拒绝调用链与客户端自报定时器。固定limit=20，不接受事件扫描范围/老师/复核订单参数。
- 复用现有internalHandler作用域HMAC和持久化防重放；使用服务端时钟的5分钟槽。槽内重放拒绝，下一槽可继续处理已持久化任务；不依赖事件Time新鲜性。平台文档将Time称为创建时间，不据其推断请求时间。业务幂等/退款终态/人工复核策略未改。
- 新增test/membership-stage5/timer.test.js：14/14专项通过；结束时timer+stable-token+受影响isolation共77/77，无失败/跳过/待办。结果D:\membership-backups\stage5f-timer-20260910\targeted-tests.txt。未重跑Stage5-E真实客户端57/48或repairNames，Stage2/4未变继承。
- 依据：https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-sdk-api/utils/Cloud.getWXContext.html （SOURCE可信来源/ENV）；https://cloud.tencent.com/document/product/583/9708 （Timer/TriggerName/Time/Message与7段cron）；https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getstableaccesstoken.html （stable_token普通模式）。
- 修改前完整备份及本次部署回滚资料在D:\membership-backups\stage5f-timer-20260910。云端stage5_compensate旧源码zip SHA256 c71ff9b29bfd0e42670f9be5297a5af80eb59b56518a91af3c7392789519c4d0与平台一致，完整原始配置已DPAPI保护。旧ModTime 2026-09-09 11:53:17，Nodejs18.15；原配置synthetic、两位processing老师、无管理员、购买关闭，仅STAGE5_CONFIG_JSON。
- 代码包差异已核对：除本次stable-token/timer/runtime，还携带此前已通过Stage5-E的order-read方法(engine/policy/repository)，没有改其逻辑或加入新后门。包manifest SHA256 ED6D14AF5AF6F5090BA678AF9F36C27EA07BAF91EEF7BAC9EE0BE41D14DFF44C。
- 本轮仅提交stage5_compensate代码更新，MCP返回success=true；真实Active、源码回读核对在下一条追加。未改函数配置、触发器、其他函数或数据库权限，未启用调度。
- 下一步：核实该代码更新后状态与包一致性，再安全迁移/协调五入口real TEST作用域并配置受保护定时器。支付密钥、商品发布/渠道、平台通知提交及设备/金额仍需实际证据；不得把此次本地/部署结果称READY。
- 部署回读完成：stage5_compensate Active，ModTime 2026-09-10 13:33:06，请求5bc05780-4569-4cfd-8a60-ddf3782160ad；代码zip SHA256 7c21606bf772b9bedbe28c9462fba7f5c83d753b020d5b4a1bdc0ef337243afb与平台一致，28个打包源码/配置文件逐一hash与本地manifest一致。证据deployment-verification.json。
- 最终保持原synthetic配置、仅STAGE5_CONFIG_JSON、触发器0；本轮只更新stage5_compensate代码，不宣称真实调度身份/运行已经验证。Stage5-F PARTIAL，Goal继续有效；下轮从scope协调与受保护定时器配置继续，不重跑本次77项，除非对应代码有修改。

## 2026-09-10 Goal续跑：统一真实TEST作用域、令牌部署、原生定时器适配
- 五入口当前完整配置先只读DPAPI备份到D:\membership-backups\stage5f-scope-20260910\*-before.dpapi；以既有通知配置为基准，将orders/compensate/access/admin统一至real_payment / stage5f_real_20260910 / Offer1450631819 / env0，scopeId b325bfb60895be30ba38a56912862d04b0b35c4500e205d6509de1a753795a9e。两位既有processing老师名单逐值核对一致，无昵称授权；purchaseTeachers=[]，administrators=[]，enabledChannels=[]，purchaseEnabled=false。未移动或删除旧模拟数据。
- scope-verification.json证明五函数均Active、每项环境变量精确匹配预期合并值，运行时/角色/VPC/依赖/代码大小等未因配置更新变化；没有覆盖通知Token/AESKey。普通集合、权限、repairNames未修改。
- 补偿函数新增独立32字节随机STAGE5_INTERNAL_KEY（DPAPI及服务端配置），先关闭STAGE5_SCHEDULE_ENABLED。配置及脚本不输出密钥或完整身份。代码回滚zip在rollback.md记录，变更前逐一与平台hash匹配。
- orders与payment_notify已部署stable_token接线及共享runtime，均Active且28个包文件逐一hash一致，证据code-verification.json：orders zip 0a58d1320d28528f1dd2209fdff8797dbd7a9304f51dfb24b8dd7ed05f695650；notify zip 25c7a27bbabfc3469da94cc96471a1507c5a0ce0a405d5e99997f08facba2ba7。access/admin只更新配置，不重部署源码。
- 更新后的通知HTTP安全检查3/3：合法挑战200原样返回，请求4a93e32d-2664-4e02-b90c-6653ef74be88；错误签名403，请求bc28ec47-40c5-4104-a463-887f130dee2d；无签名空POST503/retry。仅传输/拒绝证据，未发商品成功事件，不代表公众平台通知配置成功。
- 真实作用域payment_work预检查为空，查询仅投影_id/limit1。MCP两并行只读查询曾争用连接，之后串行读成功；未因观测失败重复写配置。
- 创建唯一固定定时器stage5_compensation_5m，0 */5 * * * * *，$LATEST，Enable=1，创建13:43:07，回读请求2168b1fa-17db-47d7-9257-9e6b79e602dc。未新增HTTP补偿路由。
- 初版真实定时器被STAGE5_TIMER_AUTH_REQUIRED拒绝：13:55请求c4c6fcc4-8d2d-42ca-a30a-580b50311d9a，平台系统日志request_source=TRIGGER_TIMER；固定脱敏诊断source=absent、environmentPresent=false、environmentMatches=false、userContextPresent=false。SDK3.0.1在缺WX_CONTEXT_KEYS时提前返回{}，属于真实运行入口差异，不能把该拒绝算调度PASS。
- 定向查到腾讯官方环境变量文档：https://intl.cloud.tencent.com/zh/document/product/583/32748 ，内置TRIGGER_SRC=timer、TENCENTCLOUD_RUNENV=SCF、SCF_FUNCTIONNAME；现有SDK使用SCF_NAMESPACE作为环境来源。新增仅服务端运行环境的原生分支：固定函数名/环境、TRIGGER_SRC=timer、无用户上下文、无客户端调用来源；客户端传入同名字段不被采用。固定任务名、limit20、内部HMAC、防重放及原退款/复核规则保持。
- 修复前关闭处理开关；修复后22项timer专项通过，仅重部署stage5_compensate，Active ModTime14:00:35，随后14:00:59提交重新启用。下一条记录包核对及真实触发结果，当前不提前声明调度PASS。原77项相关回归继承，仅修改timer.js与其测试，无Stage2/3/4产品语义变更。
- 启动本机凭据隐藏录入窗口，PowerShell5启动退出后改用现有pwsh，进程17640确认存活。用户已被告知AppSecret在开发管理/开发设置/开发者ID；现网AppKey在虚拟支付/基本配置/基础配置。仅人工粘贴后DPAPI保存，不自动上传；当前尚无payment-credentials.dpapi。不要生成/重置已有密钥来凑配置，完整值不得进入聊天。
- 已知剩余：真实支付凭据/令牌请求未验证；TEST商品最后证据仍未发布/0.01表单价格，实际渠道/金额未闭环；公众平台通知提交曾系统繁忙，未有成功证据；设备本轮未重新核实。Stage5-F仍PARTIAL，不允许宣称READY或实付成功。无真实订单、付款、真实会员发放、生产学生/学习数据修改或commit/push。
- 重要安全补充：仅TRIGGER_SRC/runtime身份的原生分支不足。实际管理端调用伪造Timer事件到达INTERNAL_REPLAY_REJECTED（forged-timer-invoke.dpapi），说明曾通过来源门禁；立即关闭STAGE5_SCHEDULE_ENABLED，无权益发放。不得把14:01原生空任务成功单独作为受保护调度PASS，也不得启用旧的无独立凭据原生版本。
- 修复新增强制调度能力凭据：timerCapability=HMAC-SHA256(内部密钥,固定用途+scopeId+固定触发器名)。它是需要保密的、用途受限的调度凭据，不是可公开的校验码；仅存受控触发器CustomArgument，服务端常量时间比较后才进入现有内部签名/槽内防重放/补偿入口。不能用其签发通用内部API请求，不接受额外老师/批次/扫描参数。时间槽是重复调用限流与幂等约束，不把平台Time当作带签名的付款事实。
- 官方UpdateTrigger支持CustomArgument并保留未传字段：https://cloud.tencent.com/document/product/583/96828 。通过现有callCloudApi(sc​​f,UpdateTrigger,2018-04-16)仅更新本轮固定timer；先CLOSE，凭据逐值核对一致（未回显），再OPEN。直接API返回RequestId而非success包装，更新请求960a9304-167f-475f-9bbf-b5d5b2df4b96；回读1d150df5-dbad-48b3-af71-4f62eb3951f2；打开请求b93f29a5-d25f-4788-8eb7-0b1148d06fcc。
- 最终timer专项26/26，本轮只补测受影响timer，不重跑Stage5-E冻结证据。仅stage5_compensate再次部署；28文件逐一匹配，zip SHA256 9cd19e2f841e09091fa9bcebe7fd323f505cb03dc14cb0e23c522ad6b5c419d2，证据capability-code-verification.json。orders/notify不因compensate专用辅助代码变化重复部署。
- 新版本非定时管理调用伪造Timer已拒绝STAGE5_TIMER_AUTH_REQUIRED，请求a08f2da0-df29-4360-98ef-07992c7222de。此为管理调用的恶意入参检查，不冒充真实小程序客户端。等待真实定时器携带凭据的正向证据与触发后反向检查。
- 之后读取listFunctionTriggers/getFunctionDetail等结果必须继续加密捕获、只输出名称/开关/匹配结果；CustomArgument现在携带秘密调度凭据，不得完整打印。回滚或暂停先关闭处理开关及定时器；不要恢复无能力凭据校验的原生版本并启用。
- 最终受保护调度代码hash 9cd19e2f841e09091fa9bcebe7fd323f505cb03dc14cb0e23c522ad6b5c419d2，28文件匹配；固定timer最终Active/Enable1/五分钟，回读63d50af2-24e0-4820-b45f-238b90ba76c7。仅该timer和STAGE5_SCHEDULE_ENABLED启用，不开启购买。
- 14:20真实携带能力凭据的TRIGGER_TIMER请求38ca8901-fd34-46c1-97ea-74fe4b26c217最终status200/ret_code0，reviews=[]、compensation=[]。证据capability-runtime-success.json。这证明真实调度、凭据校验及空批次数据库查询接线，不证明真实已付款补发或退款通过。
- 实际触发后再次管理端伪造Timer，返回STAGE5_TIMER_AUTH_REQUIRED，请求8efba7f8-ca84-424c-aacd-613b53e49743，未到内部任务标记/发放；证据forged-timer-final-result.json和加密调用回执。带原生元数据但缺/错调度能力凭据的专门分支由本地正式测试覆盖，不冒充真实微信客户端补测。
- 本轮最终：五入口配置同一real TEST scope；orders/notify/compensate相关代码Active且逐文件验证；受保护空任务调度及管理调用伪造拒绝通过；本地timer最终26/26，既有77项中未变部分继承。无真实订单、无付款、无会员grant，无生产业务数据变更，无commit/push。
- READY仍未成立：支付AppSecret/现网AppKey未安全录入，尚无真实token/支付参数接线验证；TEST_teacher_12m_a实际发布/渠道/金额待核实；公众平台通知启用/提交成功待核实；付款设备待核实。凭据录入窗口仍为唯一当前人工动作，后续继续正常官方服务端接口验证，不绕过后台工具安全限制。购买保持关闭，管理员仍为空。后续不要重跑本轮已通过的调度/通知检查，除非对应配置或代码变化。

## 2026-09-10 14:39 用户凭据安全录入完成及三个支付入口配置核验
- 用户确认本机遮挡输入窗口已加密保存。payment-credentials.dpapi存在，仅以Windows当前用户DPAPI保护；原值未进入聊天、Git、截图或测试结果。启动可见窗口的问题已解决。
- 现有stable-token提供者在本机真实调用官方stable_token一次成功，expires_in=7200，第二次读取复用缓存，未强制刷新。证据entered-token-verification.json。这证明本次AppSecret可用于当前AppID获取令牌，不代表云函数实际令牌请求或支付参数链路已验收；令牌未打印或持久化。
- CloudBase认证READY，环境cloudbase-4gafzdch60ad597b/ap-shanghai。三个目标完整配置在写入前分别保存为*-credentials-before.dpapi；现有作用域、名单、关闭购买及Active状态核对后继续。
- 仅对stage5_orders、stage5_payment_notify、stage5_compensate合并MEMBERSHIP_APP_SECRET与MEMBERSHIP_LIVE_APP_KEY。通过现有mcporter库及进程标准输入传递，未把秘密放进子进程命令行或明文文件。完整响应加密保存。
- 三入口均Active，所有环境变量精确匹配预期合并值；其余环境变量、运行时、入口、超时、内存、角色、VPC、依赖和代码大小均保持。回读请求依次46721b89-483b-40cd-9a2f-33b92929ee38、b7a3318d-edfd-454a-8591-e4aba9963b43、a00250f6-b7b1-4aa4-a985-2ef98cad58aa。证据payment-credentials-cloud-verification.json。
- 未修改源码或重部署代码；stage5_access/admin、通知路由、数据库权限及补偿触发器未改。通知Token/AESKey、独立补偿密钥/开关保持原值。无业务数据写入，无订单、实付或会员发放；已启用的空批次定时器仍按原设置运行，其原审计行为不等于本次业务写入。
- 本轮只执行一次真实官方令牌请求及三入口配置回读，冻结Stage5-E与已有调度/通知/本地测试继续继承，未重跑。
- Stage5-F仍PARTIAL：现网AppKey仅配置及逐值回读，尚未以实际支付协议结果证明有效；云函数实际令牌请求、真实会话支付参数未验证。官方通知表单提交成功、TEST商品发布/渠道/实际金额及设备仍待证据。购买仍false，purchaseTeachers/管理员/渠道名单均空，正式399商品及普通老师权益不变。不得宣布READY_FOR_TEST_PAYMENT。

## 2026-09-10 15:23 消息推送506010及EncodingAESKey表单格式修复
- 用户通过公众平台Network响应取得base_resp.ret=506010、err_msg=default。定向公开检索未找到可追溯官方释义，不能断言该码等于Token错误或AES格式错误。
- 前次自发合法挑战GET200且echo完全匹配；没有取得相应官方提交验证请求到达函数的证据。listFunctionLogs返回底层GetFunctionLogs已下线，使用CLS；没有将旧接口失败或缺失日志算成功。
- 核对用户提供的官方配置表单字符要求发现实际准备缺陷：旧EncodingAESKey长度43但含非字母数字字符；Token32位字母数字符合要求。旧值可作Base64/AES密钥不等于符合此后台表单限制。
- 只调整stage5_payment_notify的MEMBERSHIP_NOTIFICATION_AES_KEY，生成满足43位A-Za-z0-9且Base64解码32字节的新值；完整配置与原本机handoff均先DPAPI备份。URL/Token不变，其他所有环境变量逐值比较不变，运行时/代码大小/角色/权限未改，无代码部署。购买保持false。
- 云端Active且新密钥精确回读，request72e8fd44-f8ed-48df-8834-0dbf80976e07，ModTime2026-09-10 15:23:02。核验aes-format-verification.json；恢复依据aes-format-before.dpapi和environment-notify-before-format.dpapi。新值已同步本机环境通知加密文件，重新打开遮挡复制窗口。
- 这是配置格式缺陷修复，不代表506010根因已证实、公众平台已启用或真实通知已通过。下一步用户只替换EncodingAESKey，保留URL/Token/安全模式JSON，观察一次提交响应。无真实订单、付款或权益变更，无commit/push。

## 2026-09-10 用户确认公众平台消息推送配置完成
- 用户在更换符合表单要求的EncodingAESKey后明确回复“配置已完成”。记为用户确认官方表单配置成功，解除此前提交失败的人工阻塞；未把该确认扩大为真实支付通知、商品匹配或实付验收成功。
- 当前Goal工具读回仍为blocked；该工具只能创建目标或标记complete/blocked，不能直接切换恢复状态。不得假报已恢复目标状态或重新创建替代目标。
- 后续只收口TEST商品发布/实际渠道金额、真实设备与会话支付参数、安全白名单及付款前准备；已有Stage5-E、作用域、调度及凭据回读证据继承。购买仍关闭，未创建订单/付款/发权益。

## 2026-09-10 Goal恢复：TEST发布与付款设备确认
- 用户恢复原目标，继续READY_FOR_TEST_PAYMENT，不新建替代目标。此前通知配置完成按用户确认继承，未重跑Stage5-E或已验证调度。
- 用户最新确认TEST_teacher_12m_a仍未发布，本次账号张张张123，手机iQOO12、OriginOS（用户称橘子系统）。此为用户提供的设备信息，不是当前真实微信会话身份验证；不沿用旧vivo V2307A作为本次设备。
- 已请用户只发布该TEST商品，先确认0.01元，正式399不改、不付款。当前实际发布成功和最终价格尚待回复，不把发布建议记为已发布。服务端购买开关保持关闭。
- 定向阅读现有policy/model/engine：商品数据来自固定scope产品记录，价格单位分、期限12个月、TEST账户名单；正常下单/付款参数受购买开关和可信归属限制。不通过新接口绕过关闭开关进行参数验收，不创建支付订单。
- 当前真实TEST scope产品只读查询经mcporter自动恢复后终态超时（Request timed out/offline），不是安全拒绝，也未产生写入。随后使用已安装mcporter库直接连接进行相同只读查询一次，结果另记。没有用查询失败推断商品集合为空。
- 直连只读查询成功：requestId efdff748-047e-4079-a335-a2f562b2a115，stage5_membership_products当前real TEST scope total=0。已取得确定证据：需要在该scope建立受控TEST商品配置，不能把此前synthetic商品或平台商品自动当成此处记录。查询不涉及生产集合或完整身份输出。
- 用户回复“就差发布了”，尚非发布成功证据；已明确可以点击该TEST商品发布，若审核则据实际状态记录。下一轮从平台发布确认及当前scope受控产品记录准备继续，不再重复本次查询。

## 2026-09-10 15:42 真实TEST作用域停用商品配置已建立
- 当前stage5_orders完整配置在操作前只读核对：Active、正确AppID/OfferID/env0/real_payment/stage5f_real_20260910，购买关闭，购买/管理员/渠道名单为空。通过真实已批准processing身份的SHA256指纹3eac6ca3b522精确选择张张张123，不按昵称或数组顺序授权；没有公开完整身份。
- 复用现有model.product和Stage5 policy校验，创建唯一stage5_membership_products记录，逻辑及平台productId均为TEST_teacher_12m_a；teacher_annual，duration.months=12，CNY价格1分，testOnly=true，allowedTestAccounts仅张张张123，enabled=false。价格是此前已展示的候选配置，仍待本次发布价格确认；没有将平台发布状态虚构为已发布。
- 确定性docId 7daf5ff3c897709e6f7aacdc326e8d4a2e497cafa6ec0708f856952adffd6625；scopeId b325bfb60895be30ba38a56912862d04b0b35c4500e205d6509de1a753795a9e。先精确查_id不存在，再insert；无覆盖或upsert。插入request90d9648b-ea97-446d-accc-2634bd9508ee，回读request2c180c07-692f-4526-a6e8-7e1c1146eab8，整条记录hash与预期完全一致。
- 唯一新增云数据为该停用TEST产品配置。未创建订单、payment_intent、平台交易、payment grant或真实权益；未改云函数、权限、正式399或生产集合。恢复时优先保持enabled=false，仅此明确docId为本次创建对象；后续若已有依赖订单不得盲删。
- 最小本地配置校验：现有model/policy接受结构与授权目标，resolveProduct对该停用商品返回PRODUCT_NOT_AVAILABLE。不是完整真实客户端调用测试；Stage5-E既有证据继承，不重复执行。
- 证据D:\membership-backups\stage5f-scope-20260910\disabled-test-product-report.json；脚本prepare-disabled-test-product.mjs只含指纹而无完整身份/密钥，既有回执存在时拒绝重执行。无源码改动或commit/push。
- 当前仍PARTIAL：平台最后回复“就差发布了”，尚未取得“已发布/审核中”与最终价格；设备iQOO12/OriginOS由用户确认，尚待当前真实会话核验。服务端商品enabled=false、购买总开关false，purchaseTeachers/渠道为空。不得宣布READY。

## 2026-09-10 恢复后第三轮：发布结果与真实会话外部阻塞
- 上轮进展为停用商品真实插入/回读，证据继承。本轮未收到平台已发布/审核中及最终价格的新确认，仍不等于已发布。
- 本轮现有工具本地目录确认包含wechat-devtools；按技能只调用一次wechat_ide status，未得到可用状态（受控适配返回DEVTOOLS_STATUS_UNAVAILABLE）。没有open/start/compile、生成二维码或复用旧调试窗口。两次只读ADB尝试（跨本轮与上一轮）均退出1且无有效结果，不判定设备未连接或身份错误，不再无依据重复。
- 仍无法验证当前iQOO12真实微信会话；仅继承用户提供的设备/账号说明以及既有冻结身份指纹，不将旧设备或DevTools模拟会话当真机证明。
- 平台发布人工确认这一外部缺口在恢复后连续三轮仍存在；能独立完成的停用产品、凭据配置、作用域、受保护调度均已完成，没有新的可用后台证据来源，且明确后台工具安全拒绝不得绕过。目标保持PARTIAL并标记blocked，不标记READY或完成。
- 恢复所需最小信息：TEST_teacher_12m_a平台实际发布/审核状态和最终价格；随后在已确认账号iQOO12真实会话完成必要的身份/支付参数准备。不要重跑旧57/48等检查。商品与购买仍关闭，无新增订单、付款或权益。

## 2026-09-10 用户确认TEST已发布且0.01元
- 用户先回复“已发布”，随后对“发布后的价格仍是0.01元”回复“对”。据此记录TEST_teacher_12m_a平台发布和价格为用户后台确认，不再重复询问同一状态或索要同一截图。
- 此确认不是实际支付成功、渠道支付成功或云端参数调用证据。已有停用商品价格1分与用户确认一致，12个月权益保持。
- 本次仅追加证据；未修改云商品enabled、全局购买开关、白名单或渠道配置。仍不得创建订单、拉起付款或发会员。
- 后续最小缺口：iQOO12/OriginOS当前真实微信会话和付款前参数链路准备。现有正式parameters接口需要持久化订单且购买开启；不得为提前验收绕过此门禁或新增测试后门。应区分付款前接线证据与获得真实订单后的实际调用结果。

## 2026-09-10 用户进入并USB连接后：当前设备确认
- 用已安装ADB经Node execFileSync正常只读取得唯一device状态，ro.product.model=V2307A、ro.vivo.market.name=iQOO12、Android15/API35、微信8.0.77。V2307A与iQOO12为同一设备标识/商品名，不应再把此前“vivo V2307A”直接当作不同手机。设备序列号未输出。
- 设备连接和版本证据不替代当前小程序getWXContext身份；当前账号属于张张张123仍有用户确认与旧可信身份依据，但本次会话尚未读取。
- 微信工具配置发现命令路径缺失反斜杠，project仍D:\WordMasterApp；原调用Connection closed。正确本机exe已存在。在单次进程内纠正路径、指向会员独立工作区的调用未返回有效状态；随后既有mcporter显式stdio/cwd/env调用wechat_ide status终态超时30秒。没有安装、升级、修改全局配置，也没有重复编译或切换已打开项目。只读进程名称筛选未找到wechatdevtools/nw匹配项，不据此绝对断言软件未运行。
- 停止重复同类连接；尚需可访问的iQOO12真机调试会话或受支持的真实客户端执行通道才能读取可信身份。不开购买、不给脚本假身份、不新增调试后门。TEST已发布0.01元继续继承用户确认。

## 20260910-200631 iQOO12当前真实会话身份已核对
- 使用Computer Use操作已有“真机调试”窗口；设备V2307A、Android15、微信8.0.77，连接正常。未切换项目、重编译或复用模拟器身份。
- 从该真机会话调用现有login云函数，读取可信服务端返回；脱敏caller=oPLF…eKgs，SHA256前12位3eac6ca3b522，与张张张123冻结身份一致，expectedTeacher=true；appid=wx930eccb9442dc8f3，appMatches=true。
- 首次只读请求fulfilled但Console日志未显示；第二次改为直接返回脱敏JSON，展开Promise并通过await读取现有结果，身份核对通过。共两次login只读调用，没有下单、付款参数签发或付款。
- 本轮只保存脱敏证据：D:\membership-backups\stage5f-scope-20260910\iqoo-real-session-20260910-200631.json。完整OPENID/凭据未输出或保存；请求ID未进行不确定的图片转录。
- 当前会话身份缺口已解除；不据此宣布READY。商品及购买开关继续沿用关闭状态，后续仍需付款前白名单/渠道配置收口与支付参数链路准备；真实订单后的参数调用和实际支付不在本次只读验证内。
- 未修改代码、云资源、生产数据或真实权益，未commit/push，未重跑Stage5-E冻结证据。

## 20260910-201120 五入口当前云配置只读收口
- readiness-snapshot.mjs顺序读取五个入口，认证READY且目标环境准确；全部Active，AppID/OfferID/env0/real_payment/stage5f_real_20260910一致。只输出身份指纹及凭据存在布尔值。
- orders/notify/compensate所需AppSecret及现网AppKey均存在；notify的Token/AES存在；compensate的受保护调度开关true。access/admin不需要支付凭据，未复制多余密钥。
- 五入口processing均为已批准两位老师；purchaseTeachers/admins/enabledChannels仍为空，purchaseEnabled=false、batchClosed=false。与已有检查点一致，无外部配置漂移证据。
- 本轮只读，不重跑冻结测试、不修改云配置。后续最小工作：在总购买开关仍false下准备仅张张张123的购买名单与Android微信渠道，并核对商品准备状态及安全付款会话链路。不得创建订单来绕过当前阶段边界。
- 当前PARTIAL，非READY；快照保存在D:\membership-backups\stage5f-scope-20260910\readiness-snapshot-*.json（本次observedAt为2026-09-10T12:10:14.956Z）。

## 2026-09-10 20:15 受限购买候选配置完成；总开关仍关闭
- 五入口仅更新STAGE5_CONFIG_JSON中的purchaseTeachers=[已核实指纹3eac6ca3b522对应身份]、enabledChannels=[wechat]；purchaseEnabled=false、admins=[]，其余业务/作用域配置保持。每个入口完整配置先DPAPI备份，更新后精确比对所有环境变量及Runtime/Handler/Timeout/Memory/Role/VPC/CodeSize/Layers等元数据，无其他变化，全部Active。
- 恢复点与逐入口请求ID见D:\membership-backups\stage5f-scope-20260910\buyer-config-20260910-201238\results.json；完整before/update/after均为DPAPI加密文件。没有部署源码或调整函数权限。
- 使用回读配置执行纯本地现有policy检查5/5：关闭购买拒绝两位老师；仅在内存假设打开开关后，只有已授权第一位老师通过，第二位仍拒绝；管理员为空；scopeId保持不变。不是云端实际开启或新一轮Stage5-E测试。
- 当前已核实iQOO12真实会话返回virtualPaymentApi=function、canUseVirtualPayment=true、platform=android。仅查询typeof/canIUse/system，未调用requestVirtualPayment。输入期间一次错误剪贴板文本被清除且未执行，之后校对代码再执行查询。
- device-capability.json记录客户端API能力；不等于平台交易成功或实际扣款金额已验证。平台TEST已发布0.01元仍继承用户确认。
- 云TEST商品记录仍enabled=false，尚未将其切为可用商品；购买总开关false，未创建订单或签发付款参数、未付款、未发权益，无commit/push。当前仍PARTIAL，下一步收口商品配置与支付会话/参数的最小充分准备证据，不能提前声称READY。

## 2026-09-10 20:19 TEST商品准备完成；客户端最终接线缺口定位
- 仅更新stage5_membership_products的既有唯一TEST_teacher_12m_a文档：product.enabled=true及updatedAt。总购买开关仍false，价格1分、12个月、仅张张张123、scope/平台商品ID/其他字段完全保持。
- 更新前完整云配置与商品DPAPI备份并解密逐字验证；带_id/旧enabled/旧updatedAt/scope条件更新，禁止upsert/multi。更新request b62d43bd-2d6a-4888-9536-572b950aebb0，精确整文档回读request85c5292c-afd5-4907-9c3c-3e3937123993。available-test-product-report.json为脱敏结果；available-test-product-before.dpapi为恢复依据。全局policy继续拒绝购买。
- 已定位仍需补齐的正常客户端接线：utils/membership-payment-service.js只有createPaymentService工厂，没有实际callServer绑定；它要求sessionRevision。现有utils/account-session.js已提供captureAccountSession的accountId/generation，可只读复用而不修改冻结同步语义。下一步以独立Stage5客户端适配绑定固定stage5_orders及固定环境，复用现有购买服务和账号代次；不修改页面、不执行purchase、不新增服务端后门。
- parameters正向实际调用仍须获批订单与购买开启，本轮不能提前执行；准备证据与付款后完整链路证据必须区分。当前PARTIAL，尚未READY。
- 无真实订单、付款、会员发放、生产数据修改或commit/push。仅本次TEST产品配置变更，未重部署源码。

## 2026-09-10 客户端固定入口适配源码完成
- 新增utils/membership-stage5-client.js，显式调用才执行；固定stage5_orders、目标env及TEST_teacher_12m_a，不接收teacherId/openid/collection/env/batch/product切换参数。只复用现有createPaymentService与account-session的只读代次，不修改登录/同步模块或业务页面。
- purchase仅接收requestId；queryOrder仅接收orderId并原样保留服务端归属拒绝，账号代次变化时拒绝旧结果。没有客户端授权代替服务端鉴权、云函数后门或自动调用purchase。
- 新增test/membership-stage5/client.test.js 8项及受影响原客户端9项合计17/17通过。覆盖构造无副作用、固定路由/正常loginCode转交、关闭购买不拉起、伪造参数拒绝、ORDER_NOT_OWNED传递、A-B-A代次、查询迟到结果和未登录。仅本地stub证据，无真实订单/付款；未重跑冻结57/48等。
- 新文件首次创建前已确认不存在；一次测试错误码修订前全文件备份位于D:\membership-backups\stage5f-scope-20260910\client-adapter-first-version。HEAD仍14129f96d8581968e4fdad8551cc1a47d7a4aa55，未commit/push。
- 找到实际可用DevTools CLI：D:\软件\代码编辑器与IDE\微信开发者工具\微信web开发者工具\cli.bat，--help可正常读取。当前尚未执行本次小程序编译或实际模块加载；不得把Node测试说成小程序编译成功。agent tool需要已知原子工具名，未猜测或调用；主工作区已有miniprogram-automator可复用，不安装升级。
- 下一步完成独立工作区新适配模块的最小编译/加载核对及关闭购买安全调用，再按六项目标证据裁决。当前仍PARTIAL；购买关闭，云商品enabled=true，未创建订单、签发参数、付款或发权益。

## 2026-09-10 20:38 编译通过但运行模块加载失败，仍需修复
- 已修复本次进程的DevTools调用参数形状：MCP需要params对象；本机CLI/工作区正确，status成功。实际IDE服务端口59309不在工具旧探测列表；直接CLI auto指定已确认端口成功，随后evaluate成功。未修改全局工具配置。
- 初次新客户端编译成功（主包1667326），但新模块require未定义。独立工作区project.private.config.json有ignoreDevUnusedFiles=true；两个同名窗口需区分，实际独立工作区窗口328678，另一个12781732为旧项目窗口，不混用其首页成功。
- 为正常依赖接线，app.js新增按需getStage5MembershipPaymentClient方法，随后将依赖改为顶层静态require；仅5行新增/变化，不改onLaunch、学习/同步或页面语义。修改前完整备份app-before-payment-client.js，中间态备份app-before-static-payment-import.js。
- 最新编译成功，无errors/wxml_errors，total3367458/main1671330，自动化重连及验证true；仅punycode弃用警告。运行时仍无法构造客户端，随后getApp为undefined，页面栈停pages/splash/splash。独立工作区窗口Console可见module utils/membership-stage5-client.js is not defined，最早异常尚未完整提取。不可把编译成功声明为运行PASS。
- current-devtools.mjs与client-module-check.mjs为本机工具适配脚本，未加入项目或部署。当前未执行purchase或创建订单，关闭购买安全调用尚未执行。原Stage5-E证据未重复。
- 下一步优先读取启动异常首因，修复客户端模块的编译依赖/运行兼容问题，再验证构造与关闭购买边界。不要再次无依据修改依赖方式或反复编译；此前自动化evaluate已可用，保留端口59309/9420线索，原会话已终止的脚本无需盲重启。
- 当前Stage5-F仍PARTIAL，不能READY。未开启购买、付款、发权益或commit/push；app.js当前存在上述本轮未提交入口改动，需要在交付前完成启动验证。

## 2026-09-10 21:10 运行模块加载阻断解除；READY_FOR_TEST_PAYMENT
- 继承Stage5-E最终PASS及此前Stage5-F全部冻结证据；未重跑Stage2～Stage5-E、57项/48项，未重查OfferID、TEST商品、repairNames、通知、凭据、stable_token、补偿调度、测试账号或虚拟支付API能力。
- 根因收敛为新客户端模块的打包依赖与逻辑层重载一致性问题，而不是适配器语法或子依赖错误。独立工作区启用`ignoreDevUnusedFiles=true`；保留checkpoint前已完成的最小源码修复：`app.js`使用顶层静态`require('./utils/membership-stage5-client.js')`建立明确打包依赖，getter仅按需构造，不在启动时调用云函数或购买。没有关闭文件裁剪、修改项目配置或继续改动客户端模块。
- checkpoint中的最后一次失败发生在编译后逻辑层尚未正确加载新包的会话。复用已验证CLI并快速重连后，明确核对项目为`D:/WordMasterApp-Membership-Stage2-20260908`、AppID为`wx930eccb9442dc8f3`；随后只重新编译一次。编译成功，`errors=[]`、`wxml_errors=[]`，主包1671330、总包3367458，automator重连与验证均为true；唯一警告为开发工具Node的`punycode`弃用提示。
- 完整重载后的真实小程序页面栈深度1，实际路径`pages/index/index`，`page_data.path`一致；`getApp()`存在且`getStage5MembershipPaymentClient`为函数，小程序正常启动。
- 真实小程序运行时构造成功：客户端对象存在，`purchase`与`queryOrder`均为函数；不再出现`module 'utils/membership-stage5-client.js' is not defined`。
- 仅运行受影响客户端最小测试：`test/membership-stage3/client.test.js` 9项与`test/membership-stage5/client.test.js` 8项，共17/17通过；未运行其他冻结套件。
- 在总购买开关保持关闭时，通过真实客户端执行一次请求ID为`STAGE5F_DISABLED_SAFE_20260910_01`的安全调用。客户端只向固定`stage5_orders`、固定环境`cloudbase-4gafzdch60ad597b`发送`createOrder`，服务端在`membership-stage5/policy.js`的`policy.buyer`门禁返回`STAGE5_PURCHASE_DISABLED`；`wx.login`调用0次、`wx.requestVirtualPayment`调用0次。该门禁位于订单处理器、支付凭据读取和任何订单写入之前，因此没有创建订单、签发支付参数、拉起付款或发放权益。
- 未发现其他付款前关键blocker。Stage5-F由PARTIAL裁决为PASS，当前状态为`READY_FOR_TEST_PAYMENT`。全局购买仍关闭；本裁决只表示付款前准备就绪，不表示已授权开启购买或已完成真实付款。
- 本轮未开启购买、未创建真实平台订单、未拉起付款、未发会员、未改CloudBase配置或数据、未commit/push、未做无关重构。按目标在READY裁决后立即停止。

## 2026-09-11 首次真实小额支付改为正常 UI；无扣款验收完成，等待“可以支付”
- 继承 Stage5-F PASS / READY_FOR_TEST_PAYMENT 和 iQOO12 / Android 已通过预检。真机 Console 自动控制不是支付前置条件；Console、IDE、云日志仅观察与排错。用户本轮要求在汇总付款信息后重新等待明确“可以支付”，此前“可以”不代替本轮确认。
- 无现有会员购买页面。新增 subpages/stage5-membership/index 四件套，app.json 注册，“我的”页增加普通 navigator 入口。显示脱敏当前身份、Stage5 TEST、TEST_teacher_12m_a、0.01 元、12 个月和立即购买。入口可见性不作授权；无昵称鉴权、服务端测试后门或新增云接口。
- 按钮只向现有 getStage5MembershipPaymentClient().purchase 传 requestId；适配器固定商品/环境/function。继续经过 stage5_orders 的可信 APPID/OPENID、教师身份、purchaseTeachers、TEST 产品 allowedTestAccounts、服务端价格/时长校验。正式399产品隔离继承；无服务端源码、配置或数据写入。
- 仅调整 membership-payment-service 的异常结果：创建订单前的明确关闭/身份拒绝返回白名单 refusal 码；不输出原始异常，不将超时当作安全重试。页面在请求前持久化本账号尝试锁；双击、未知结果、已创建订单、退出重进不另起购买。仅明确无订单拒绝解除锁。固定复用保留的 stage5_first_real_20260910_01；本次关闭购买验证没有占用任何云端订单/意图。
- 最小验证：既有客户端17/17与新增UI7/7，共24个相关案例通过。覆盖页面无自动购买、关闭拒绝、真实客户端适配贯通(stub cloud)、禁止price/duration、重复点击/重进、未登录、账号切换。未重跑57/48、Stage2～Stage5-E等冻结验收。
- DevTools MCP compile 首次超时；快速CLI auto恢复后 currentPage 元数据失效，通过正常 reLaunch 成功恢复页面，无清缓存。CLI preview 编译成功，AppID正确，main1671721/total3373054，证据 D:\membership-backups\stage5-ui-20260911\compile-info.json。仅生成开发预览包，未正式发布。
- 实际页面路径 subpages/stage5-membership/index，客户端账号指纹3eac6ca3b522。截图 page-before.png 展示完整页面及关闭购买返回（后续截图覆盖同名文件）；已检查文本、价格、按钮无重叠。真实点击购买按钮后最终返回“购买当前关闭，未创建订单、未拉起支付。”，busy=false/locked=false/orderId为空。自动化首轮waitFor过早返回busy=true，随后单独读取确认最终结果，未重复点击。
- “我的”页 navigator 元素存在并实点；首轮同步轮询过早报告导航未确认，随后独立读取实际页面已为目标路径(webview9)。不把早期轮询失败当作最终成功证据，最终路径读取才是依据。
- 调用前后只读云证据均 purchaseEnabled=false，orders/intents/grants/audits/claims/events/work均0、account/ledger不存在。最新时间2026-09-11T02:32:23.861Z，证据 D:\membership-backups\stage5-first-payment-20260910\payment-observation-1789093943865.json。
- 完整改前备份：D:\membership-backups\stage5-ui-20260911（app.json、students.wxml、payment-service、checkpoint），逐一hash验证。HEAD14129f96d8581968e4fdad8551cc1a47d7a4aa55，保留既有app.js/project.config/repairNames等dirty，无commit/push。
- 付款信息：张张张123（展示oPL***eKgs，指纹3eac6ca3b522）；iQOO12/Android；TEST教师年会员；业务及平台商品ID均TEST_teacher_12m_a；0.01元/12日历月；AppID wx930eccb9442dc8f3；OfferID1450631819；CloudBase cloudbase-4gafzdch60ad597b；real_payment/stage5f_real_20260910/env0；仅该账号购买名单，正式399商品不在当前TEST作用域。
- 下一步必须等待用户明确“可以支付”。确认后仅临时开放现有目标账号+商品，用户通过预览小程序“我的 → Stage5 TEST会员验收 → 立即购买”，本人确认官方付款。Codex不点最终付款。关闭新购买须避开尚未签发参数的窗口（现有parameters也受购买开关保护）；官方支付界面已拉起/合法订单开始处理后尽快关闭，不改notify/queryOrder/grant/compensate处理权限。
- 付款后继续以可信平台事实和云端order/grant/ledger/account/audit核验；不把客户端返回成功当作会员。仍待真实付款、12个月一致性、幂等、重进active、同账号跨设备恢复。新UI尚未在iQOO12实际打开，不将模拟器截图称为真机证据；预览二维码 D:\membership-backups\stage5-ui-20260911\preview.png 供本人扫码进入。
