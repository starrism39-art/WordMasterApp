# iOS 正式会员支付接入

商品固定为 `teacher_member_12m`，39900 分 / CNY / 12 个月 / 不自动续费。价格、归属、渠道和权益期限由服务端验证；客户端支付成功回调不能发放权益。

## 入口与门禁

- `membership-formal/policy.js` 默认关闭普通购买和受控 iOS 购买。受控准备、付款及重试分别检查配置、单一老师身份和截止时间。
- `membership-presentation/runtime.js` 返回服务端计算的 iOS 购买可用状态。会员页通过 `membership-ui-client.js` 使用既有待付款业务订单继续支付。
- `membership-ios-probe.js` 保留平台原始调起错误供受控排查，不记录身份、签名或完整支付参数。
- `ios-repository.js` 仅适配 iOS 订单商品快照，不修改共享商品、账本或既有其他渠道订单。

## 支付事实与恢复

用户始终只有一笔业务订单，平台支付号由该订单内的 payment attempt 管理。通知入口先验证平台通知，再通过 attempt 索引解析业务订单；查单及补偿入口使用同一解析路径，检查老师、商品、金额和环境归属。

权益发放要求官方付款事实及获胜 attempt 对应的认证商品凭据。沿用既有业务订单的幂等 payment grant 流程，期限以可信付款时间计算。Apple 发货请求使用平台要求的签名。详细重试规则见 [继续支付与 attempt](CONTINUE-PAYMENT-ATTEMPTS.md)。

## 部署与检查

受影响部署入口为 `membership_presentation`、`stage5_payment_notify`、`membership_formal_compensate`，应包含当前共享模块，部署后逐文件比对源代码并回读门禁。配置、密钥及回调原始记录留在受保护的运行环境，禁止放入源码或文档。

本轮长期定向测试位于 `test/membership-formal-ios/`，覆盖门禁、客户端继续支付、原始错误展示、attempt 并发与幂等、通知路由及 Apple 发货签名。测试使用合成身份和付款事实，不调用真实支付。

Git 封板不等于开放购买或发布。个人 5 天缓冲修复在独立分支封板，本分支不合入该修复；统一集成由后续 Release RC 单独处理。
