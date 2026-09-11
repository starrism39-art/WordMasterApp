# Stage4 执行合同

/goal 在 D:\WordMasterApp-Membership-Stage2-20260908 新增统一会员权限服务，复用 Stage2 日期/权益/免费名额/固定学生/过渡语义并桥接 Stage3 已发放账本。
验证：node --test test/membership-stage4/*.test.js；按接口影响选择 Stage2/3 最小回归；保存输出并核对旧文件 SHA256 未变。
约束：不部署、不真实付款、不写 CloudBase 或用户数据、不 commit/push，不改共享页面、学习同步及 Stage2/3 产品语义。
边界：仅新增 cloudfunctions/membership-access、test/membership-stage4、specs/membership-stage4；不新建工作区。
迭代策略：先矩阵，再事务操作与桥接；失败定位后做小步修正，最后统一回归；不重复审计支付协议。
完成条件：权限矩阵、免费名额、会员来源、固定学生、过渡、管理员审计、并发/时间及权威隔离测试通过；交付后停止，不进入 Stage5。
暂停条件：需要真实云写入/付款/部署或出现不可决定的产品歧义；完成其余独立工作后列明，不自行扩大授权。

Goal Draft (English-compatible)
/goal Implement an isolated unified membership access service in the existing Stage2 worktree, reusing Stage2 entitlement policy and consuming Stage3 granted ledgers.
Verification: run Stage4 tests, minimal affected Stage2/3 regression, and unchanged-file hashes; retain evidence.
Constraints: no deployment, payment, production data, shared UI/sync changes, commit or push.
Boundaries: only new membership-access code, Stage4 tests and specs in the existing worktree.
Iteration policy: matrix, transactional mutations, payment bridge, then final regression; diagnose failures before focused changes.
Stop when: all Stage4 contract checks pass and limitations are reported; do not proceed to Stage5.
Pause if: real cloud writes, payment, deployment, or unresolved product decisions are required.
