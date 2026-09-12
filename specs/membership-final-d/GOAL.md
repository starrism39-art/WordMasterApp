/goal 从 Final-C 9367a23bcc35e79ccc9e6dbeacd5d7a6d3bbe322 的独立 Final-D 工作区，完成会员到期提醒、受控真实退款准备和目标渠道门禁，最终达到 READY_FOR_ROLLOUT。
验证：运行 node --test test/membership-final-d/*.test.js；编译 Final-D 小程序；真实点击我的会员入口并检查重进去重；保存关键截图、云端源码比对及脱敏退款预览；官方资料和当前账号状态分别核实。
约束：冻结继承 Stage2至Stage5、Final-A/B/C；不重跑旧矩阵，不重新付款验证 Android；正式399仍关闭，62人不rollout，不启动真实老师缓冲，保护已有学生和学习同步数据。
边界：仅 D:\WordMasterApp-Membership-Final-D 的直接相关源码、定向测试、文档；云端只更新必要展示函数，受控数据依授权处理；不reset、stash、clean、merge main或改历史提交，不自动Git封板或发布。
迭代策略：依赖检查后分小步实现并定向验证；同一操作至多三次，失败换证据定位，P2记DEFER；Windows首发关闭购买且保留会员读取；其他未验证渠道同样关闭。
完成条件：本轮提醒与门禁证据完整，所有首发渠道与真实退款均通过后 READY_FOR_ROLLOUT 并立即停止；仅剩人工真实验证时报告 READY_FOR_REAL_VALIDATION，未验证事实单列。
暂停条件：真实退款、iOS真实付款、登录扫码或敏感凭据、399购买开启、真实老师rollout、不可逆生产写入及产品范围冲突。先提供具体脱敏清单，退款单独授权，iOS最终付款只能由用户本人执行。

Goal Draft (English-compatible)

/goal Complete Final-D reminders, controlled real-refund readiness and verified release-channel gates in the isolated worktree based on Final-C 9367a23bcc35e79ccc9e6dbeacd5d7a6d3bbe322, targeting READY_FOR_ROLLOUT.
Verification: run node --test test/membership-final-d/*.test.js, compile the mini program, click the membership entry and verify reentry deduplication; retain screenshots, deployed-source comparison and masked refund preview; distinguish official documentation from account readiness.
Constraints: inherit frozen Stage2 through Stage5 and Final-A/B/C without rerunning their matrices or Android payment; keep formal 399 purchases and the 62-teacher rollout closed, and preserve existing business data.
Boundaries: edit only directly required Final-D source, tests and documentation in D:\WordMasterApp-Membership-Final-D and authorized controlled resources; no reset, stash, clean, main merge, history rewrite, automatic Git seal or publication.
Iteration policy: verify focused changes incrementally; diagnose before retrying, at most three repeated attempts; defer P2. Disable Windows and other unverified purchase channels while retaining entitlement reads.
Stop when: reminder and gate evidence is complete and all first-release channels and the real refund pass, then report READY_FOR_ROLLOUT and stop; report READY_FOR_REAL_VALIDATION when human real validation remains, with unverified facts listed separately.
Pause if: real refund, iOS payment, authentication or credentials, formal purchase enablement, real-teacher rollout, irreversible production changes or a product-scope conflict is required; prepare a masked reviewable action first and obtain separate authorization, with the user performing final iOS payment.
