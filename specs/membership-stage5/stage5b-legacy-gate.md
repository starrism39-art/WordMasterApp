# Stage5-B 旧写入口隔离证据及最小补丁

日期：2026-09-08，目标 cloudbase-4gafzdch60ad597b。只读取得云端源码/权限，测试在本地模拟SDK执行；没有调用云函数业务入口、没有云端数据写入或部署。

## 1. repairNames 真实实现

CloudBase queryFunctions(getFunctionDetail)读取 $LATEST，Active，index.main，Nodejs16.13，修改时间2026-06-08 20:27:40，角色TCB_QcsRole，无环境变量、无列出的触发器。入口源码CodeResult=success；与本地修改前源码规范化换行后完全一致。云端源码SHA256：6D1C5BD55EDCD1A5C9C0715884A46698E0EB84DDF9AE93280C37E188DE9B6ECE。

本轮queryPermissions再次实读CUSTOM：`{"*":{"invoke":"auth != null"}}`，RequestId 6348ffbc-db5d-42de-8cb8-23420108876a。规则允许普通认证用户调用，不代表管理员权限。没有对真实普通用户执行写入攻击。

原实现从event.collection直接选择目标，无allowlist、无getWXContext管理员检查。event不能直接指定任意更新字段或具体文档，但代码遍历所选集合，根据已有students/teachers映射，给匹配teacher_id或student_id/studentId且缺失姓名的记录补写teacher_name/student_name。会查询任意指定集合；符合条件时能写其记录。不能据此宣称可以任意改isVip、期限、金额或添加grant。

因此：若现在创建Stage5集合，旧函数仍可能越过客户端禁写规则读/写这些集合；是否发生姓名更新取决于记录字段，不能因为当前模型恰好不匹配就当隔离成立。只改客户端数据库规则不足以约束具有服务端能力的旧入口。

## 2. 先失败再修复

同一套31项测试先加载已取证云端源码：5通过、26失败；本地修改前结果相同。安全期望要求管理员校验及禁止未知集合，旧实现返回success且执行模拟数据库访问，触发失败。包括stage5 grants/accounts/orders/audit/claims、普通用户、身份伪造和非法配置。

补丁仅 cloudfunctions/repairNames/index.js：
- 入口在任何数据库读取前调用getWXContext，校验固定AppID及可信OPENID。
- 管理员由受保护函数配置REPAIR_NAMES_ADMIN_OPENIDS（JSON数组）匹配；没有配置、格式错误、空名单、错应用均拒绝。真实名单未配置，仓库不保存真实OPENID。
- 只允许word_mastery、learning_records、learning_progress、student_statistics。未知集合及全部stage5_*一律拒绝，管理员也不能放行。
- 仅接收collection/skip/maxRecords；拒绝teacherId/openid/role/data/table/documentId/HTTP形状入参。原默认word_mastery、分页与只补缺失姓名、不覆盖已有姓名语义保持。
- 不改历史同步算法，不改其他云函数，不改Stage2～4。

该入口未来只允许原生小程序事件调用，不能混用HTTP入口。受保护管理员配置不由请求、老师可编辑档案或昵称决定。部署时还须把云端invoke收紧为管理员范围；具体平台规则须按可用权限能力落地并实测，不能只写配置说明就宣布完成。未配置名单默认禁用是有意行为，启用前需绑定可信管理员。

修改前文件及云端证据保存在 D:\membership-backups\stage5b-20260908；本地原文备份SHA256核验一致。下载地址未输出到聊天或Git，云端包仅作为只读源码证据，未安装其依赖或执行真实SDK。

## 3. 其他入口定向分类

| 入口 | 云端证据及目标 | 分类 |
|---|---|---|
| login | 云端入口只返回getWXContext身份，不写库 | A：对本次隔离无写入影响 |
| updateStudentStats | 云端只写student_statistics/wordbook_statistics；teacher_id取OPENID，更新统计字段受代码选择 | B：固定目标；不是对统计业务全部安全性的审计 |
| syncMasteryAtom | 云端入口及sync-merge依赖已取证；数据库仅word_mastery，归属取调用上下文 | B：固定目标，不改同步 |
| syncTombstoneAuthority | 云端sync_tombstones/students/learning_records；helper虽有collectionName参数，实际调用为固定目标 | B：固定目标，不改同步 |
| teacherWordbook | 云端版本不同于当前本地，按云端源码及model等依赖检查；teachers只读、teacher_wordbooks/teacher_wordbook_versions写；调用者来自getWXContext | B：固定数据库目标；COS上传能力不是数据库CRUD |
| announcement | 云端入口及repository/service/model已下载核对；teachers/announcements只读，announcement_reads写 | B：固定目标 |
| repairNames | 云端任意集合参数，无角色验证 | C：本地已修，云端仍未修 |
| 学生页、login-service、cloud-migration、safe-merge-restore相关入口 | 本地限定检查；客户端SDK操作已有业务集合，login调用只读login函数，无服务端任意集合代理 | B：未来Stage5规则必须禁读写；未实测未来规则 |

本次已检查的7个云函数未发现第二条可指定Stage5集合的高权限数据库通路。没有以auth!=null单独推断其他函数安全，结论基于其真实写目标。未覆盖未知历史版本、未发布本地代码或将来变更；结论不等于全仓安全审计。

## 4. 最终Stage5权限矩阵（目标合同，未部署）

| 集合 | 客户端直接读/写 | 允许的服务端业务写入口 |
|---|---|---|
| stage5_membership_products | 禁止/禁止 | 独立受控管理员配置TEST商品；orders只读 |
| stage5_membership_orders | 禁止/禁止 | 测试orders、notify、compensate、admin |
| stage5_membership_payment_intents | 禁止/禁止 | 测试orders |
| stage5_membership_payment_claims | 禁止/禁止 | 测试notify、compensate、admin；交易占用原子且不可覆盖 |
| stage5_membership_payment_events | 禁止/禁止 | 测试notify、compensate、admin |
| stage5_membership_payment_work | 禁止/禁止 | 测试orders、notify、compensate、admin |
| stage5_membership_ledgers | 禁止/禁止 | 受控支付/权益/权限服务，同一修订与事务 |
| stage5_membership_grants | 禁止/禁止 | 测试notify、compensate、admin |
| stage5_membership_accounts | 禁止/禁止 | 受控发放/调整服务；仅可重建汇总 |
| stage5_membership_admin_audit | 禁止/禁止 | 受控变更服务，与业务变更原子审计 |
| stage5_teacher_student_access | 禁止/禁止 | 测试access、admin |
| stage5_test_students | 禁止/禁止 | 测试access、admin |

所有旧入口、repair/migration入口均不得访问上述集合；新服务端固定集合映射，不接受客户端collection/env/batch选择。仅可信OPENID/teacherId对应的已批准测试名单可用测试服务，知道productId/documentId不能授权。客户端通过函数按本人归属获取必要返回。管理员目标也必须限制测试名单/批次，不开放任意权益写。

直接禁写规则不是服务端角色限制的替代。真实权限、调用渠道、全入口白名单与确定性ID/事务仍需在后续适配和授权云端验证中落实。本轮没有实现Stage5仓库映射、权限适配或平台资源。

## 5. 验证与结果

- legacy-isolation.test.js：31/31 PASS，云端旧源码此前同组26失败，5通过。
- cloud-targets.test.js：9/9 PASS，针对已取得云端源码的集合表达式/常量/依赖静态门禁；不是云端攻击或权限实测。
- node --check repairNames/index.js通过。Stage2～4三个会员源码目录逐文件哈希保持一致，不重复大规模回归。
- 失败及通过输出保存在本目录stage5b-before.txt、stage5b-cloud-before.txt、stage5b-after.txt、stage5b-cloud-targets.txt。
- 重现云端快照检查：设置STAGE5_CLOUD_EVIDENCE_DIR为上述证据目录，再运行node --test test/membership-stage5/cloud-targets.test.js。证据缺失时明确失败，不跳过冒充PASS。普通补丁测试运行node --test test/membership-stage5/legacy-isolation.test.js。

结论：旧入口本地修复及定向门禁40/40 PASS；当前云端仍保留原风险。现在直接创建Stage5权威集合不安全。本轮解决了风险定位和最小补丁，不代表共享环境已获部署放行。

唯一下一步：申请受限的repairNames安全补丁及可信管理员配置/调用权限部署授权，先验证该旧入口不能读写Stage5目标，再解除这项云端门禁。Stage5-A既有测试集合映射、全入口名单等独立缺口仍需完成后，才能另行放行12集合与5入口；不把本轮40项PASS替代它们。

未部署、未修改云权限/集合、未创建订单/支付/权益、未commit/push。真实付款仍不在本轮范围。
