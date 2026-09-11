# Final-A Git 安全封板记录

日期：2026-09-11。业务状态继承 READY_FOR_ROLLOUT；本记录只覆盖 Git 封板，不代表正式启用。

基线：`5994a966a26ddf191a3ec384e03b98561ae98353`。目标分支：`codex/membership-final-business-access`，推送到 origin 同名分支。提交及远端结果以本分支 Git 历史和封板交付记录为准。

## 纳入与保留

- 正式会员初始化、个人 transitionStartedAt、候选身份覆盖、学生服务端写入、普通学习/复习权限、旧学生保存兼容、最终 students 安全规则。
- announcement-popup 空值 Hotfix 独立提交。
- 9个长期测试文件；清除被个人缓冲取代的统一 rolloutAt 断言，保留个人规则测试；安全规则配置断言补充布尔 false 与所有者读取表达式。
- 正式打包、只读 preview 工具、62个 SHA256 候选标识及63人脱敏分类记录。
- 九宫格页面混有未完成选词功能，其整组未提交修改、选词工具及测试留在本地 DEFER。
- 一次性云验收入口、旧 preview、过程日志、原始证据和备份不纳入。正式打包脚本不再生成临时验收函数。

修改前所有已有改动均已复制到仓库外备份并逐文件校验；封板未使用 reset、stash、clean、覆盖恢复或历史改写。

## 静态与敏感信息检查

- 27个 JavaScript 文件语法、4个 JSON 文件解析通过；最终文档加入后共36个纳入文件。
- 相对引用检查通过；打包脚本字符串中的入口引用按生成后的包目录解析，不能误按 scripts 目录解析。
- 本地新目录打包仅生成 membership_business，运行入口及依赖齐全，无临时验收入口。
- diff 空白检查、精确暂存清单和暂存内容扫描在提交前核对。
- 未发现真实 OPENID、明文真实 teacherId、私钥、证书正文或执行密钥。测试中的 teacher/t/admin 与 LOCAL_ONLY/LOCAL_PREVIEW 等固定字符串为合成夹具，非生产凭据。运行名单仅含 SHA256；preview仅含脱敏指纹。
- 本轮不运行任何业务测试；冻结 PASS 证据见个人缓冲及直写封堵记录，不能将本轮静态检查表述为重新验收。

## 已部署内容只读比对

详见 [DEPLOYMENT-SOURCE.json](DEPLOYMENT-SOURCE.json)：云端下载包中28个源码文件一致，入口递归依赖的17个文件全部一致（统一换行后SHA256）。唯一包内差异为不被运行入口引用的 security-rules.js；它是单独应用的控制面规则制品，当前导出的最终规则与线上 CUSTOM 精确一致。不存在运行时业务源码遗漏或差异。

本轮没有部署、修改权限或写入云端业务状态。普通老师尚未 rollout，62名候选尚未初始化或开始5天；不付款、不开放399、不合并、不发布。支付核心与 frozen sync 协议保持不变；utils/cloud-migration 的变更仅将既有学生恢复写路径转为服务端核验，不改变 Full Pull 查询及同步协议。
