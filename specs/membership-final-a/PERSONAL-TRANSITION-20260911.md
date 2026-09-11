# Final-A 个人缓冲规则收口

本文件保留个人规则阶段的冻结验收记录。下述当时PARTIAL已由[写权限收口](WRITE-GUARD-20260911.md)解决；当前为READY_FOR_ROLLOUT，Git状态见[GIT-SEAL.md](GIT-SEAL.md)。旧版本PRIVATE边界和原生连接缺口均不得当作当前未解决结论。

状态：PARTIAL。个人缓冲与preview已完成，但旧二进制客户端的PRIVATE直写仍未撤销，不能把新版源码入口关闭等同于所有旧客户端旁路关闭。本记录替换旧的“62人缺依据 review”和“必须统一 rolloutAt”语义；二者均不再是阻塞。九宫格 DEFER。

## 新规则

- 受批准历史快照的62个 teacherId 以完整 SHA256 白名单保存在 legacy-candidates.json；已知1个 gift 保留。
- 管理员及离线 preview 均返回 legacy_free_candidate / firstOpenPending；不生成批量启动个人缓冲的令牌，不写入时间戳。旧批量初始化入口拒绝候选人，不能提前消耗五天。
- 新版 splash 在静默登录成功后非阻塞调用 openMembership；正式业务授权入口也调用同一幂等初始化，处理重试与直接进入页面。请求不能提供 teacherId、身份或时间戳；使用原生 OPENID 和服务端时间。
- 首次打开时事务绑定已有学生原文档，原文档不改写；每人只写一次 transitionStartedAt，结束时间为该值加五天。换设备/重装不会重置，未打开者没有账本或计时。
- 缓冲期间原学生继续可用；到期后按既有固定保留学生规则收口，不删除学生或历史记录。新老师直接 free，可信已删除学生事实也计入生命周期名额。
- historical/gift/long-term 通过受保护依据、签名 preview 和管理员应用覆盖候选；source/grant/audit 独立且幂等。保留已有 grant、个人时间戳与消费名额，有限期限赠送不能缩短 long-term。显式 review 或到期时待处理身份依据不自动转 free。
- 正式配置不含 rolloutAt；核心冻结模块的 launchAt 参数仅传本次服务端时间以关闭旧全局过渡推导，核心协议未改。

## 验证证据

备份/证据目录：D:\membership-backups\final-a-20260911。修改前完整副本位于 personal-transition-before。

- personal-final-tests.txt：新增个人规则12项 PASS；personal-native-boundary-test.txt：新增原生入口请求防伪1项 PASS。后者为本地运行时测试，不冒充微信实机。
- personal-admin-preview-check.json：62人管理员 preview 均只读、时间戳为空、无 apply token。
- preview-personal-transition.json：63唯一老师，62 legacy_free_candidate、1 gift、0 historical、0 long-term、0 free、0 review。候选不是永久 free。
- personal-cloud-result.json：新增2组真实云数据库验证 PASS，请求 e21a835d-f828-46b0-8ced-ebfde39eaae9，runId personal_1789119668154。仅3个合成老师、1个合成学生；含并发事务、晚打开、无缓冲新用户、三个来源覆盖与重复应用。时间边界使用受控服务端时钟。
- personal-readonly-verification.json：真实62人账本数仍为0，已知gift分类保留；普通老师41份学生身份投影字段与前快照一致，之前受控复习记录、掌握记录与保存证据一致。前快照为投影，未宣称全部历史字段的全量比对。
- personal-compile.json：正确 IDE、Final-A 工作区编译成功。启动配置无九宫格条件。额外自动化9422未监听，恢复尝试后停止；本轮未新增原生点击/首次打开实机证据。原生学习、复习、Full Pull与active第32名沿用已通过记录，没有重跑。

## 正式写入口与旧数据

- 正式新增/编辑页面只调用服务端 addStudent/correctProfile，原30人本地上限继续移除；原生身份、幂等名额与身份纠错/审核语义保留。
- 备份学生路径 syncExistingStudent 只核验已有原文档，缺失返回 review，不能借恢复创建新学生；教师显示更新只接受显示字段，不能替换学生身份。
- 新业务授权发现学生原文档姓名/年级与正式绑定身份不符时拒绝并提示核实；自行直写新增但未绑定的学生不获得新版业务授权。
- 本结论针对本次正式交付源码入口和新版服务端授权。students=PRIVATE 原有所有者底层能力保留，不能声称已撤销所有历史二进制客户端的直接数据库写权限；未改 ACL 或冻结协议。
- 正常学习/复习保存处理、抗遗忘算法、统计与云同步写入协议未因本轮个人缓冲改变。已有记录只读复查、合成旧文档字节不变测试及前轮已通过主链路证据共同覆盖本轮影响，不做完整历史恢复或完整同步E2E。
- 九宫格既有未提交内容保留，DEFER，未测试或继续修改，不纳入完成条件。

## 部署与数据边界

- membership_business 最终 build-09 已部署，Nodejs18.15 / Active；请求2755d05f-e358-4753-8e82-95d6ab06241a。环境 cloudbase-4gafzdch60ad597b。
- 配置已恢复 enabledTeachers=[]、administrators=[]、allTeachersEnabled=false，删除旧 rolloutAt；配置请求eac3f4c1-85ba-4b46-8aee-3696786bc8a9。
- 临时受控函数只运行新的个人规则文件，原9组未调用；执行后清空key/run，关闭请求42e40d2d-25a7-477b-b6ec-8aa48fd42ec8。
- 本轮没有写入普通真实用户数据、批量初始化62人、修改其权益、付款、发布或提交推送。合成数据保留审计。
- 未发现本轮引入的数据损坏P0。权限P1仍有1项：仍运行旧代码的客户端可以使用原PRIVATE直写能力，未进入新版授权路径；在不调整访问控制/旧版本准入的前提下，单改新版调用入口无法撤销旧代码能力。新版拒绝未绑定学生不等于旧版不能继续使用它们。未取得新增原生自动化证据也如上说明，不以编译代替该证据。
- 后续启用属于 rollout：经用户授权后对获批新版开放服务端启用配置；62人仍各自在首次打开时开始计时，不执行预先批量写时间戳或批量发权益。本轮到此停止。
