# Final-B 正式商品配置 checkpoint（2026-09-11）

## 当前结论

- 用户已从微信公众平台确认正式商品创建并发布，非敏感 productId 为 `teacher_member_12m`。
- `teacher_member_12m` 已写入云端 `membership_presentation` 的正式商品配置，并精确回读。当前状态为 `PASS`。
- 客服未配置，`supportAvailable=false`，页面保持“客服方式正在完善，请稍后再试”。

## 正式映射与门禁

- `membership-presentation/config.js` 以服务端 `ANNUAL_PRODUCT` 固定教师年度会员：39900 分、CNY、12 个月、不自动续费。
- 正式平台配置只接受 `mode=short_series_goods`、`productType=teacher_annual`、固定金额/币种/期限/续费属性及独立非 `TEST_` productId；字段、价格、期限、续费属性或 TEST ID 不符即拒绝。
- 客户端下单入口只接受 `requestId`，不能提交价格、期限或 productId；公开展示配置不返回 productId。
- `purchaseEnabled=true` 继续以 `FORMAL_PURCHASE_NOT_RELEASED` 拒绝。云端环境精确回读含 `teacher_member_12m`、`short_series_goods`、`teacher_annual`、39900、CNY、12个月及 `autoRenew=false`，同时保持 `ordersReady=false`、`purchaseEnabled=false`；更新请求 `a594391e-2ade-4737-9c87-e54560926f50`，回读请求 `5a29438b-c6fb-4bac-b260-4fdb142f5293`。
- `membership_presentation` build-06 已更新，部署请求 `62975ce3-3813-4e70-9a93-d2a3be43ee2a`。新增正式配置定向测试 1 项 PASS；未重跑既有 18 项与 24 张截图。
- 关闭门禁直接验证返回 `FORMAL_PURCHASE_NOT_RELEASED`；客户端附加 price 被 `UNEXPECTED_FIELDS` 拒绝，数据库调用0、平台调用0、订单0、权益0。

## 复用证据

- TEST 域仍是独立 `stage5_membership_products` / `stage5_membership_orders`；现有 TEST 商品为 `TEST_teacher_12m_a`、1 分、12 个月、不自动续费、白名单且测试专用。正式绑定后只读复核请求 `3bd5e592-83bf-43be-9d72-7a239e6da180`。
- 现有一笔受控 TEST 订单状态为 paid/granted；只读查询未创建订单、未付款。Stage5 既有本人读取、脱敏与他人拒绝证据继续作为冻结安全接口证据，本轮未重跑安全矩阵。
- Final-A 既有受控合成 transition 记录已固定 1 名保留学生；`retain_retain` 保存幂等结果，第二名学生未替换固定选择。普通老师写入为 0，本轮未调用写接口。
- 页面 free / active / expired / long-term 继续消费同一服务端公开配置；页面重进从服务端展示模型恢复，不读取本地 orderId。继承既有验收，本轮不重复执行。

## 发布前外部配置

客服真实联系方式仍未提供；它不阻塞 Final-B 正式商品接线结论。正式购买、普通老师 rollout 与 Release RC 均未启动。
