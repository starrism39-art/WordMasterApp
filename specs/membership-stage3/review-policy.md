# Stage3 异常人工复核兜底（2026-09-08）

本轮产品策略取代“无通知必须百分之百自动发放”的旧停止条件。

正常通知经身份、商品、金额核验及服务端查单确认后，持久保存付款事实，复用 Stage2 算法幂等发放。
queryCashEvidence 只产生现金付款候选，不是会员发放授权；queryEvidence 保留 PRODUCT_EVIDENCE_REQUIRED。
商品证据不足时保存 review.candidate、queryHash、queriedAt、缺失原因，冻结交易占用，work.state=review_required。后端不再轮询同一缺口。
后续有效商品通知可解除仅商品证据不足的复核；退款或其他冲突不能自动解除。

## 返回契约
paymentStatus 和 grantStatus 保留分层。新增 status 为派生业务状态：awaiting_payment / paid / grant_pending / granted / payment_failed / cancelled / review_required / refund_pending / refunded / exception。
历史 closed 映射 cancelled。客户端取消回调不是平台终态，不新增客户端写入终态接口。
userStatus：PAYMENT_PROCESSING / PAYMENT_PENDING_REVIEW / MEMBER_GRANTED / PAYMENT_CANCELLED / PAYMENT_FAILED。
退款及冲突返回 PAYMENT_PENDING_REVIEW，并保留细分 status，不能显示已开通。

## 管理员本地服务契约
engine.confirmPaidAndGrant(orderId, adminContext, {reference}, reason)。不加入客户端 action 白名单，不创建部署入口。
getAdminIdentity 必须由可信服务端认证解析身份和权限，不能回显客户端 isAdmin。
getReviewEvidence 必须从受保护、可追溯的官方订单复核记录读取，不能把调用者提交的金额、老师或模式当作核验结果。正式接线未执行，缺少适配器直接拒绝。
复核记录包含 reference、mode=short_series_goods、status=paid、offerId、quantity，以及与持久查单候选一致的 orderId/teacherId/appId/env/productId/channel/amount/currency/unit/transactionId/paidAt。
管理员只能提供记录引用和原因；真实支付时间取已持久查单候选，期限取原订单商品快照。
订单、交易占用、membership_grants、账本、汇总与 membership_admin_audit 在同一事务提交。审计包含 before/after、operator、reason、evidenceReference/hash、原订单/老师/金额/商品/交易/grant、操作时间；grant 元数据保留管理员确认引用。
已发放幂等返回；退款、取消、明确失败、其他复核冲突拒绝。外部认证/证据读取在重试事务外完成。

## 范围与恢复
未修改 Stage2、学习同步、学生页面、共享UI、商品或云资源。无部署、实付、提交或推送。
修改前完整副本：D:\membership-backups\stage3-review-20260908-213345；备份逐文件哈希核对。
真实云端事务、权限、可信管理员和证据存储接线、通知部署、调度与实付仍需后续授权验证。测试 fixture 不是已授权真实账号。

## 本轮验证结果
- Stage2：72/72，失败0，待办0；原有15文件修改前后 SHA256 一致。
- Stage3：118/118，失败0，待办0；原86正式用例保留，原1待办转新策略正式用例，新增31项管理员/复核用例。
- 三个修改的支付源码语法检查通过。
- 证据：review-stage2.tap、review-stage3.tap。均为本地隔离契约验证，不是真实数据库事务或支付验收。
- Stage3 支付链路与异常人工复核兜底 PASS。下一步需用户确认后进入 Stage4，本轮停止。
