# Final-A 旧版本 students 直写收口

以下为冻结业务验收记录；后续Git封板见[GIT-SEAL.md](GIT-SEAL.md)，记录中的“未提交推送”仅描述当时阶段。

本轮 PASS；Final-A READY_FOR_ROLLOUT。62人候选、个人缓冲、身份覆盖及此前业务验收冻结继承，未重复执行。九宫格 DEFER。

## 根因与最终方案

PRIVATE 隐式按创建者限制读取，同时允许同一原生 OPENID 的旧版小程序直接创建/修改 students。新版客户端调用服务端不能撤销旧代码的数据库能力。

本轮按用户新增授权改为 CUSTOM，冻结原数据与查询，客户端 create/update 一律拒绝；正式写入复用现有 membership_business 原生身份与会员授权。没有 students_v2，没有数据迁移。

最终规则（与 cloudfunctions/membership-business/security-rules.js 的 studentWriteGuardRules 完全一致）：

```json
{
  "read": "auth.openid != null && (doc.teacher_id == auth.openid || doc._openid == auth.openid || get(`database.students.${doc._id}`)._openid == auth.openid)",
  "create": false,
  "update": false,
  "delete": "auth.openid != null && (doc._openid == auth.openid || get(`database.students.${doc._id}`)._openid == auth.openid)"
}
```

原 teacher_id 查询直接满足第一项读条件；带 _openid 的所有者查询保留；单文档 ID 读取通过 get 的实际 _openid 核验，单文档删除也保留原所有者能力。没有 read=true。普通真实学生的 teacher_id 与 _openid 逐份相等；唯一缺 _openid 的文档为上轮合成 personal_ 测试文档，没有扩大全体或其他老师读取权限。正式服务端创建同时写可信 teacher_id/_openid，客户端不能改写归属。

依据：[CloudBase 权限定义](https://docs.cloudbase.net/api-reference/manager/node/rule)、[安全规则查询及 get 约束](https://cloud.tencent.com/document/product/876/41802)、[ModifySafeRule 参数](https://cloud.tencent.cn/document/product/876/128959)。规则中的 false 必须是 JSON 布尔值；本环境不接受字符串 "false"。模板路径使用平台支持的反引号表达式。

## 部署证据及中间失败

环境 cloudbase-4gafzdch60ad597b；小程序 wx930eccb9442dc8f3。工作区/分支/HEAD 未切换，原未提交内容保留。

- 全部证据：D:\membership-backups\final-a-20260911\write-guard-*；修改前文件副本及 PRIVATE 权限在 write-guard-before，文件副本校验 SHA256 一致。
- 初始仅 teacher_id/_openid 条件的 CUSTOM 允许原 count/get，但拒绝单文档读取，立即回滚 PRIVATE。
- 通用 ModifyResourcePermission 对无效表达式返回成功而未落库；读回发现仍 PRIVATE，未将其作为成功证据。一份明确标记的受控 create 探针意外成功，已核对 ID、名称、归属后仅删除该探针；update 探针只写回受控学生原姓名。普通老师数据无写入。
- 改用数据库专用 ModifySafeRule，经修正布尔类型与模板路径后成功。请求 d186b3a1-6ad3-44fd-8797-034f5f92d2b9。
- 最终独立读回 CUSTOM，完整规则与源码深比较一致；请求091f753d-7e09-4b4c-88e9-a09cb7fe8193。以实际读回和原生正/负验证为准，不以管理接口“成功”代替。
- 原学生权限 helper studentRules 继续 fail-closed，旧部署脚本不会意外复活 Hotfix 废止规则。新规则使用独立 studentWriteGuardRules 导出。

## 本轮最小验证

| 验证项 | 结果与证据 |
| --- | --- |
| 原 teacher_id count/get | PASS：变更前后均16份文档；write-guard-native-read-verified.json |
| 单文档 owner read | PASS：原生读取既有受控学生，以及服务端新建学生 |
| 其他归属单文档 read | 拒绝；write-guard-native-delete.json；未公开读 |
| 客户端 direct create | 拒绝，-502003为本项预期拒绝；未新增，count不变 |
| 客户端 direct update | 拒绝，-502003为本项预期拒绝；write-guard-native-direct-verified.json |
| 服务端 active 新增 | PASS：原生 wx.cloud 调用 membership_business 创建1名受控学生，真实文档归属正确 |
| 服务端正常编辑 | PASS：大小写纠错实际写入后重新读取确认 |
| 可疑身份替换 | reviewRequired=true，原姓名保留；write-guard-native-service.json |
| 原所有者删除 | PASS：仅删除本轮服务端新增的受控学生，removed=1；恢复count=16 |
| free 首名/第2名/删除换人 | 新规则下真实云数据库受控验证全部PASS；只执行 write-guard-cloud.js 单组；请求346e5fa5-fadf-4960-9abc-057db6dd027e |
| silent login / Full Pull | PASS：syncFreshCompleted=true、syncFreshFailed=false、pending=0、只读模式，15唯一学生；write-guard-smoke.json |
| 同步日志 | 31条、错误0、权限错误0、pull/login失败0。2条warning为既有 learning_progress / word_mastery 重复记录合并提示，非本轮权限回归 |
| 旧数据 | 94份变更前已有学生文档逐份完整相等；write-guard-final-verification.json |
| 正常启动 | 返回 pages/index/index，截图write-guard-home.png已查看；不以九宫格启动 |

没有执行支付/transition/历史来源/学习复习矩阵或完整同步E2E。仅规则与受控验收代码变化，客户端源码没有本轮新增修改，不重复编译已通过的源码。Full Pull完成时重入splash导航已经消费，随后单独返回正常首页，未把自动跳转与同步完成混为同一结论。

## 收尾与裁决

- students 保持上述已验收 CUSTOM；无需数据回写或迁移。回滚点为原 PRIVATE / 空 SecurityRule（回滚会重新开放旧直写，仅故障恢复使用）。
- 正式 membership_business 运行代码未因本轮更改；只临时开启既有受控原生老师，收尾恢复 enabledTeachers=[]、administrators=[]、allTeachersEnabled=false。关闭请求07b38af5-ee46-4fd1-b7f7-11b2b2711472。
- 临时 acceptance 仅部署本轮 free 写入测试，结束清空key/run；关闭请求97dc874a-7abe-4fa2-8c45-b2394587986f。
- 普通真实用户数据写入0。受控原生账号有新增/纠错/review审计，合成free账本保留审计；本轮新建测试学生均已限定清理，没有删除任何既有学生。62人未启用或迁移。
- frozen sync、支付核心、学习历史、抗遗忘和统计源码/协议均未作本轮修改。已有Final-A差异完整保留；未提交、推送、发布或付款。
- 当前P0=0、P1=0（本轮及继承的唯一明确P1范围）。旧版本直接新增/修改会收到权限拒绝；既有旧数据仍可由新版读取。本轮不虚构已修改发布中的旧代码错误文案。
- 下一步唯一建议：确认会员新版 rollout 的启用与发布时间；本轮不自动执行。Final-A READY_FOR_ROLLOUT，不是全体真实老师已经启用的PASS。
