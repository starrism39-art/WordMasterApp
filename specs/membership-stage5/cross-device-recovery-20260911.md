# 跨设备恢复最小修复

## 结果

最终结论（2026-09-11）：首次 TEST 真实支付与跨设备恢复 **PASS**。代码修复及受影响23项测试证据继承；用户已分别确认新版电脑微信与iQOO12正常，两端显示active、到期时间2027-09-11 10:42:30一致。原“等待新版设备验证”的PARTIAL已收口。

Stage5-E：PASS；Stage5-F：PASS；整个Stage5：PASS。正式399商品仍关闭，TEST新购买已关闭，未正式发布；无需追加新的验收项目。临时观察任务已按用户要求删除，不影响PASS，也未关闭云端通知和补偿。

## 最终设备与云端证据

- 电脑：用户确认“电脑版没问题了”；截图C:\Users\15189\AppData\Local\Temp\codex-clipboard-07f1232e-7dcf-48da-ad85-9cdfd5bb1711.png显示active、相同到期时间和禁用的会员已生效按钮。
- iQOO12：用户确认“手机版也没问题了”；截图D:\xwechat_files\wxid_iv7i41yq4sgp22_8faf\temp\RWTemp\2026-09\9e20f478899dc29eb19741386f9343c8\4397f97780838ff95bac9c3acf927474.jpg显示服务端已确认付款并发放会员、active、相同到期时间，保留会员与订单刷新入口。
- 最新既有云端证据D:\membership-backups\stage5-first-payment-20260910\payment-observation-1789096306062.json：购买关闭，1笔订单、1次grant，ledger revision1、expiresAt1820630550000不变，补偿5次未重复发放。
- 本次只归档上述已有证据，不重新测试、改代码、部署、付款或commit/push。

## 修复
- 复用已部署stage5_access.getMembershipAccess，固定request.action=ADD_STUDENT只查询权限，不调用addStudent。服务端从可信APPID/OPENID验证teacher身份，客户端不接受teacherId/openid/orderId/env等覆盖参数。
- 页面每次onShow恢复membershipStatus/expiresAt；active/long_term禁用购买。无本地orderId也恢复，旧手机receipt仅用于防重复及既有订单查询，不作权益权威。
- 恢复失败保持购买锁，不解释成未购买；账号代次改变时拒绝迟到结果。只调整客户端适配器及页面js/wxml，无服务端代码/配置/部署变更。
- 已检查现有getMembershipAccess实现使用账本事务读取。对本次已存在的账本，规范化发生在before快照之前，策略计算不改变row，因此不持久化写入；无账本时既有初始化语义仍存在，未宣称这个旧接口对所有未初始化账户都是纯读。本次已付账号前后ledger revision1、grant1、expiresAt不变。

## 修复时验证记录（历史快照，设备待验项已在上文收口）
- test/membership-stage5/ui.test.js 11项、client.test.js 8项、restore.test.js 4项通过。没有重跑Stage2～Stage5-E或57/48套件，没有真实购买调用。
- 模块构造成功；CLI preview编译成功：main1672488、total3375522。预览二维码与compile-info位于D:\membership-backups\stage5-restore-20260911。
- DevTools启动/预览首次挂起，快速恢复失败后确认只有项目列表/空白窗口，重启IDE不清缓存，再UI编译和CLI preview成功。早期超时均不作通过证据。
- Windows DevTools当前身份指纹3eac6ca3b522，hasReceipt=false，orderId为空。两次独立reLaunch均从真实云端恢复active、expiresAt1820630550000、locked=true、restoring=false，按钮disabled=true。实际页面subpages/stage5-membership/index，证据runtime.json及active.png。明确这是Windows开发者工具，不冒充电脑微信客户端或iQOO12。
- 云端03:05:03Z检查12项一致性全通过：purchaseEnabled=false；1订单/1意图/1grant；ledger revision1；account active；expiresAt1820630550000，与付款原事实一致。补偿4次仍单次发放；work pending paid_delivery仍在观察，不宣称任务完成。
- 电脑微信实际窗口通过Computer Use读取并正常菜单重新进入，账号一致但仍显示旧版布局，无“刷新会员状态”按钮；旧预览包不会随IDE本地代码变化自动替换。未在电脑点击购买，未复制手机缓存。
- iQOO12旧版重进“已购买”继承用户证据；本次手机receipt保留回归测试通过，但新版iQOO12运行尚未实测。

## 当时交接与边界（扫码验证现已完成，无剩余待办）
用户需扫码D:\membership-backups\stage5-restore-20260911\preview.png打开新版预览，再在手机/电脑进入“我的→Stage5 TEST会员验收”确认active。这是必要的本人扫码交接，不是请求普通技术方案决策。禁止再付款、第二笔订单、改paid/grant事实。购买保持关闭，无commit/push、无正式发布。

改前完整文件备份在D:\membership-backups\stage5-restore-20260911，逐一hash核验；保留既有app.js/project.config/repairNames等不相关dirty。
