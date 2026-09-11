# repairNames 安全补丁最终记录

2026-09-11 Git 归档；本次没有重新测试、调用云函数或部署。

本记录补充 stage5b-legacy-gate.md 的早期未部署快照。最终已批准、部署并验证的版本使用可信 getWXContext APPID/OPENID 和受保护 REPAIR_NAMES_ADMIN_OPENIDS 管理员配置；任何数据库访问前拒绝未授权调用，只允许四个既有姓名修复集合。原生传输字段 tcbContext/userInfo 仅允许存在，不作为身份或写入依据。未知字段的诊断只输出受限字段名，不输出值。保留原分页及只补缺失姓名的行为。

封板时当前 cloudfunctions/repairNames/index.js 与已保存部署包 fixed-code.zip 内 index.js **逐字节一致**，源码 SHA256：

`BA98AF2BDB2F481E70C1060E872EBAA019007B30CECD8EA6057A51FC58DA19A9`

继承 2026-09-09 stage5c-transport-fix 本地记录：54 项通过；四次真实管理员越界集合请求均拒绝，未进入数据库处理；普通用户及伪造身份拒绝证据继承，临时管理员已撤销。deployment-verification.json 记录 Active、CloudMatchesLocal=true，ModTime 2026-09-09 09:34:09。final-summary.json 记录相同源码哈希。原始证据位于本机受保护的 membership-backups/stage5c-transport-fix-20260909，未纳入 Git。

安全源码与 test/membership-stage5/legacy-isolation.test.js 独立归档。后者使用离线 SDK fixture，不包含真实管理员身份。本次只核对旧部署包、源码哈希和已保存记录，没有重新连接云端；不把历史配置当作本轮云端实测。
