# 会员 Final-A：READY_FOR_ROLLOUT

Final-A 业务验收已冻结通过，旧版本 students 直写 P1 已关闭，P0/P1=0。Git 封板状态见 [GIT-SEAL.md](GIT-SEAL.md)。本目录历史验收记录中的旧 PARTIAL、统一 rolloutAt 或 PRIVATE 状态不覆盖本检查点。

## 正式范围

- 正式 membership_business 复用已冻结的会员核心；学生新增/纠错、普通学习/复习新会话使用服务端可信身份授权，在途保存沿用原路径。
- free 生命周期累计1名，删除不恢复名额；active不受旧30人限制；到期固定保留学生，续费后恢复旧数据访问。
- 62名历史老师为 legacy_free_candidate，另有1名已知gift。候选尚未初始化或开始计时；首次打开获准启用的会员新版才由服务端幂等写 transitionStartedAt，个人缓冲5天。新老师无历史缓冲。
- historical/gift/long-term可按受保护依据覆盖候选，独立source/grant/audit，幂等且不缩短long-term。preview不写数据。
- students使用兼容所有者读取的CUSTOM规则，客户端create/update=false；正式服务端写入。原teacher_id count/get及单文档读取正常。
- announcement-popup显式null最小保护纳入封板；旧备份学生路径仅核验已有文档，不暗中重建学生。
- 九宫格未完成功能DEFER，本次提交不含其新增选词/鉴权实验修改，不测试、不发布该功能。

## 冻结证据

- [Hotfix约束](HOTFIX-CONSTRAINTS.md)
- [个人缓冲验收](PERSONAL-TRANSITION-20260911.md)
- [旧客户端直写封堵验收](WRITE-GUARD-20260911.md)
- [最终脱敏preview](preview-personal-transition.json)
- [部署源码只读一致性清单](DEPLOYMENT-SOURCE.json)

继承原生新增/纠错、学习/普通复习与在途保存证据；最后写规则回归验证count/get、silent login/Full Pull、94份既有学生文档一致。Git封板仅做语法、JSON、引用、打包入口和diff静态检查，不重跑业务矩阵。

## 操作边界

当前普通老师启用开关关闭，管理员/受控白名单清空；临时云验收函数已禁用。正常业务调用不会提前为62人写时间戳。本轮Git提交/推送已由用户明确授权，旧记录中的禁止提交阶段限制已被取代。

不批量初始化、不批量发会员、不提前启动5天、不启用正式399购买、不修改支付核心或冻结同步协议。后续rollout需等待正式产品页面、剩余原始支付规则缺口及最终发布准备完成后统一授权；Git封板不等于发布或启用。
