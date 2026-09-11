# Final-A Hotfix 与后续硬约束

2026-09-11后续用户新增授权已完成：[旧版本直写收口](WRITE-GUARD-20260911.md)。students当前为独立验证的CUSTOM读写分离，原teacher_id count/get、单文档owner读取、silent login/Full Pull均PASS；原PRIVATE是故障回滚点。下述禁止破坏旧数据/冻结同步的约束继续有效，历史旧CUSTOM方案仍废止，不能与本次已验证的新规则混用。

2026-09-11：students 已按原备份恢复 PRIVATE，SecurityRule 为空。恢复请求 e8bb6ff5-a8b8-408f-bdc7-6c9b1f6396b9，复查请求 c0b0591b-dcf7-4f6e-9340-97d5101a7bad。

修改前权限及25个既有 Final-A 文件哈希保存于 D:\membership-backups\final-a-20260911\hotfix。原 teacher_id 查询 count=15、分页 get 成功。开发者工具编译成功；现有只读模式下 silent login / Full Pull 完成，syncFreshCompleted=true、syncFreshFailed=false、pending=0。重入 splash 的启动导航已消费，随后单独进入首页验收；首页15秒日志84条，错误/警告/异常均为0。未重复完整同步或支付测试。

公告组件仅增加显式空值归一化，null、undefined、空对象、空数组及正常公告/亮点函数检查通过。未修改同步、登录或支付源码，未部署云函数。只读拉取刷新本地缓存，未执行云端用户数据写入。

## 后续必须遵守

- 会员功能是新增能力，不能破坏原系统。
- 新老用户历史数据不删除、不覆盖；旧学生、学习、复习、抗遗忘及同步数据继续兼容。
- 新数据结构必须向后兼容；会员只控制未来操作权限，不接管或重写历史业务数据。
- 禁止通过修改 students 全局读取规则破坏冻结同步。
- 学生新增、编辑等限制优先通过正式服务端业务授权路径实施。
- 如必须改变 students 数据访问模型，须作为独立迁移任务设计兼容方案，不得顺手修改。
- PRIVATE 恢复只代表冻结同步兼容性恢复，不代表 Final-A 权限接入完成。现有 security-rules.js 不得未经独立兼容验证再次部署。

本轮 Hotfix 结束后停止，等待用户继续指令；会员业务实现和最终验收仍未完成。
