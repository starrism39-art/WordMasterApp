# Stage4 会员权限服务与业务规则验证

日期：2026-09-08。工作区 D:\WordMasterApp-Membership-Stage2-20260908；分支 codex/membership-stage2-20260908；HEAD 14129f96d8581968e4fdad8551cc1a47d7a4aa55。

## 实现
新增 cloudfunctions/membership-access/policy.js、service.js。Stage2/3 源码和已有接口未改。
- evaluateAccess 为服务端纯函数，复用 Stage2 getMembershipAccess 和账本推导；action、reasonCode 集中定义。
- createMembershipAuthorizer 提供 getMembershipAccess({action, studentId?, intent?})、authorizeLearning({studentId})、authorizeReview({studentId})。
- teacherId 从注入的可信 getIdentity 获取；now 从服务端 clock 获取。请求不接受 teacherId、now、grants、isVip、paymentStatus。
- 返回 membershipStatus、allowed、reasonCode、unlimitedStudents、freeSlotConsumed、retainedStudentId、transitionEndsAt、expiresAt、longTerm、policyVersion。
- 对外 transition 映射核心 grace；其余状态维持核心语义。expiresAt 继承核心有效权益截止值；过期后不伪造新的到期日。
- createAccessService 提供 addStudent、deleteStudent、correctProfile、selectRetainedStudent；管理员 initialize、previewGrant/applyGrant、correctRetainedStudent、correctFreeSlot 复用 Stage2。
- 管理员预览/应用支持 gift、historical_payment、internal_long_term、admin_adjustment（包括撤销长期及权益纠正）。payment 类型不允许此入口直接发放，继续走 Stage3。
- 审计复用 Stage2 before/after/operator/reason/createdAt/source，reference 为原 source 的明确别名；新增固定学生选择及模型删除/资料复核审计。

## 权威与事务契约
- 权限只来自可信 grants + teacher_student_access + 学生归属/删除事实；缓存 account、客户端缓存、付款状态不能代替 grant。
- readSnapshot(teacherId, evaluate) 必须在一致快照内调用 evaluate；生产实现需要真实服务端认证与数据库读取，不能回传客户端提交的行。
- 本地修改服务复用 Stage2 MemoryRepository：串行化、copy-on-write、提交失败整体回滚。这不是可部署的 CloudBase 分布式锁。
- 新建学生、名额永久消耗、审计、操作幂等和汇总同事务提交。数据库提交前失败全部回滚；提交后响应丢失使用同一 requestId 重试恢复原结果，不释放已成功消耗名额。其他外部业务操作须在事务外执行，不以其失败直接恢复免费名额。
- 正式学生写入适配必须将学生与名额放入同一真实原子事务；若无法做到，需明确预约/补偿协议后才能接业务页面。本轮没有把学生新增页面接到此模型。
- DELETE_STUDENT 仅验证隔离模型中 deleted=true 不恢复名额，不执行真实删除或同步 tombstone。
- 赠送/付费/长期/退款均复用 Stage2 日期与队列，不另写期限算法。Stage3 桥接测试使用实际 Stage3 引擎产出的本地账本。

## 资料与会话边界
- 普通纠错允许并审计；明确换人拒绝免费自助；不确定意图或服务端风险提供者判为非 normal 则保留档案并记录 PROFILE_REVIEW_REQUIRED。
- 默认不会声称能从姓名/年级变化判断现实身份；getProfileRisk 是可信后端接入点，普通请求不能自带审核结论。
- 交接文件第5节已规定到期时允许安全保存已产生记录，不需再次产品确认。此服务只授权“开始新学习/复习”，不授予无限期会话通行证。
- Stage7 接入时须在新一轮开始重新检查，保存既有成果不得被新增权限门槛阻断；可验证的会话边界及真实持久化验收留到业务接入，不修改冻结同步。
- 过渡初始化使用可信上线前学生名单、注册时间与固定 rolloutAt（核心参数 launchAt）；首次晚登录不能重算5天，不批量初始化真实老师。

## 验证证据
- Stage4：79/79，失败0、跳过0、待办0，见 stage4-results.tap。
- 机器矩阵：test/membership-stage4/matrix.test.js（七种状态 × 添加/两学生学习/复习及归属边界）。
- Stage2 完整72/72、Stage3完整118/118：继承上一阶段，未机械重跑。
- 本轮最小回归：Stage2 service.test.js 23/23；Stage3 review.test.js 31/31，分别见 stage2-minimal.tap、stage3-minimal.tap。
- Stage4 内8项支付桥接用例验证：付款状态不授予权限、正常通知发放、待复核到管理员补开、退款后的权限。
- 两个新源码 node --check 通过；Goal 文本 lint 使用已有 bundled Python 通过，未安装或修改解释器配置。
- 修改前基线：D:\membership-backups\stage4-baseline-20260908-215409\baseline-hashes.json。原 Stage2/3 共41个文件 SHA256 一致；原Stage2 15文件包含其中。

## 尚未验证及停止范围
未验证真实 CloudBase 事务/权限、真实管理员认证与证据存储接线、跨设备真实读写、真实学生页面入口、实际会话到期安全保存、支付实付。
未新增云资源/集合、未部署、未写真实数据、未改页面/学习同步/公告/导出、未commit/push；本轮只新增上述三个目录。
本地合同无 blocker、无新增待产品确认规则。服务器和业务页实际接入仍是后续阶段条件。

会员支付 Stage4 会员权限状态与业务规则 PASS。
下一步进入 Stage5：隔离云端联调 + 受限小额真实支付验收准备。
本轮停止，不自动进入 Stage5、部署或付款。
