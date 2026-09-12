/goal 从 Final-D b842065ef4accde7e447a9a67027455aa0a5c6da 建立独立工作区 D:\WordMasterApp-Membership-Formal-Android 和分支 codex/membership-formal-android-purchase，复用已有支付核心接通 Android 正式399元订单、官方支付参数、通知、查单、补偿及12个月 payment grant。
验证：运行 node --test test/membership-formal/*.test.js；验证服务端商品与归属、防篡改、长期会员拒绝、Android门禁、幂等、正式/TEST隔离；保留云端合成事务、部署源码读回、编译、页面交互截图及真实账本未变证据。
约束：总购买开关关闭；不扣款、不发真实权益、不rollout62名老师、不启动5天缓冲、不重跑冻结矩阵、不重新设计会员系统、不发布、不Git封板。
边界：仅在独立工作区修改正式购买直接依赖；云端仅授权相关函数、商品、索引及独立合成验证资源；保留所有历史学习、复习、统计和同步数据。禁止reset、stash、clean、merge main及覆盖其他工作区。
迭代策略：按新增行为小步实现并验证；失败先查看证据，重复同一失败至多三次后改变诊断方法；不以模拟器、合成数据冒充真机或真实支付。
完成条件：所有本轮完成条件有对应证据，无新增P0/P1，正式购买关闭且无399元支付，达到 READY_FOR_FORMAL_ANDROID_PAYMENT 立即停止；未实付本身不是开发缺口。
暂停条件：可能扣399元、登录扫码验证码、人工Secret、开放普通购买或rollout、不可逆生产操作、官方平台必须本人操作时暂停并说明缺失条件。
