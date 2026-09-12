# Android 正式399购买能力

起点：Final-D `b842065ef4accde7e447a9a67027455aa0a5c6da`。工作区 `D:\WordMasterApp-Membership-Formal-Android`，分支 `codex/membership-formal-android-purchase`。

## 实现与门禁

- `membership-formal` 为正式域适配层；原 `membership-payment`、`membership-core` 和 `membership-stage5` 源码保持不变。订单金额39900分、CNY、12个月、非自动续费及 `teacher_member_12m` 均由服务端固定。客户端仅可提交请求ID、订单ID、登录code和平台提示。
- `formalPurchaseEnabled=false`：普通用户不能下单或获取付款参数。`controlledPreparationEnabled=false`、`controlledPaymentEnabled=false`、`controlledTeachers=[]`。前者仅准备参数并令客户端在支付调用前停止；后者必须另获399元真实验证授权才可对指定老师放行，仍无需打开普通购买。
- 平台限制采用正式客户端设备判断与服务端允许平台检查；客户端platform是提示，不是硬件远程证明。授权老师身份始终取可信微信OPENID并查询唯一老师记录，绝不取请求teacherId/openid。未初始化正式账本拒绝购买，不借购买初始化历史老师或启动缓冲。
- 正式记录只使用 `membership_*` 集合及 `purchaseDomain=formal_android_v1`；TEST仍使用原独立集合和scope。正式域不读取或写入TEST账本。同老师未完成/异常订单锁在同一事务内阻止多请求ID重复下单。
- `membership_presentation` 创建订单、获取参数和查单转交正式适配层。查询先验证归属，再调用既有官方查单/发放核心。客户端成功回调不发权益。
- 既有 `stage5_payment_notify` URL 的入口增加认证后路由：先验签解密，再查询已持久化正式订单；正式交给正式适配层，非正式继续调用原Stage5运行时。原TEST运行时、密钥和商品均未改变。
- `membership_formal_compensate` 复用内部签名、防重放及既有补偿核心。独立定时器 `formal_android_compensation_5m` 使用受保护能力凭据。异常商品事实保持 `PAYMENT_PENDING_REVIEW`，沿用Final-C处理，不接受客户端伪造支付事实。
- 发放复用原12个月算法；事务保存order/grant/ledger/account和可信payment event审计。账本中学习业务、学生引用、access、初始化及其他字段必须逐项相同，否则拒绝写入。

## 证据边界

本地22项定向测试通过；云端独立集合 `membership_formal_validation` 的12项合成检查通过。云端合成验证使用固定假身份、假平台响应，无真实平台请求、真实老师订单或真实权益；专用验证入口随后关闭。合成验证没有冒充真实399元支付。

编译预览成功。开发工具9422对应本工作区；真实云端展示读取成功。Android展示状态注入模拟器后实际点击购买显示“会员购买暂未开放”，free/active/expired/long-term关键截图已保存，结束恢复真实服务和设备判断。由于模拟器设备API替换没有作用于页面设备判断，采用显式展示数据注入；这是模拟器布局/点击及本地Android门禁证据，**不是Android真机E2E**。真实399支付UI、官方接受本笔付款参数和付款后完整闭环未执行，不声称实付PASS。

本阶段保持所有真实正式订单为0；11份正式账本、8条正式权益记录、11份正式账户投影开始/结束逐条一致。普通用户未修改，62人rollout与5天缓冲未启动。

本机证据目录：`D:\membership-backups\formal-android-20260912`。

- `local-tests.txt`、`cloud-validation-result.json`：本地及云端合成证据。
- `compile-preview.json`、`ui-render-check.json`、`live-model-android-closed.png`、`synthetic-android-*.png`：编译和分层页面验证。
- `baseline.json`、`real-data-unchanged.json`：开始状态与真实正式数据逐条不变。
- `deployed-source-verification.json`、`compensation-schedule.json`、`compensation-live-result.json`：部署和补偿证据。
- 所有部署前函数代码zip、Windows用户加密配置及真实数据快照位于同目录，未进入Git。

## 部署与恢复

环境 `cloudbase-4gafzdch60ad597b`，AppID `wx930eccb9442dc8f3`，OfferID `1450631819`，正式商品 `teacher_member_12m`。商品记录 `enabled=true` 表示配置可被支付核心使用，不代表普通用户购买放行；正式总门禁仍关闭。

新增仅服务端可访问的商品、幂等和合成验证集合；补充订单归属及工作队列索引。不改旧students权限或业务表。

恢复时先保持所有购买开关关闭并关闭正式补偿定时器，然后将本目录备份的 `membership_presentation-before.zip`、`stage5_payment_notify-before.zip` 及其对应加密配置恢复。正式新增集合与索引可保留，不删除历史数据；若后续产生真实订单，恢复前必须保留并安排处理其回调/补偿，不能只回退Git。此次没有需要撤销的真实订单或权益。

最终状态：**READY_FOR_FORMAL_ANDROID_PAYMENT**，不代表 FORMAL_ANDROID_PAYMENT_PASS。最后部署三个函数均为Active；从线上下载的108个源码文件与build-03逐一匹配，所有购买开关关闭且白名单为空。正式补偿的签名调用返回空队列；2026-09-12 15:50北京时间定时槽产生匹配nonce规则的真实内部调用审计，证明定时器已进入正式补偿路径，没有真实待付款订单。

用户下一次唯一需要决定的动作：是否单独授权指定受控老师在Android进行一笔399元真实验证。若授权，先重新集中核对脱敏身份、真实设备/微信版本、AppID/OfferID、商品/金额/期限、会员状态、订单基线、预期权益及云环境，再只对该老师开放受控付款；普通购买仍保持关闭。未授权则保持当前状态，不继续付款、rollout、iOS或发布。

代码提交/推送不等于发布；不做Git封板、iOS、RC或正式上线。
