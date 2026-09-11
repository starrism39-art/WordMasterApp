# Final-C 最小会员运营手册

仅内部负责人使用。目标环境 `cloudbase-4gafzdch60ad597b`，入口 `membership_ops`，正式商品 `teacher_member_12m` / 39900分 / 12个月 / 不自动续费。该函数没有创建订单、支付参数、发起退款、初始化老师或启动缓冲的动作。

## 授权与安全配置

服务端读取 `MEMBERSHIP_OPS_CONFIG`。微信入口只信任 `getWXContext()` 中本 AppID、明确的原生来源和独立 `administrators` 身份列表，不使用昵称、事件传入身份或 repairNames 权限。内部入口要求 `internalOperators`、独立 HMAC 密钥、五分钟时效、随机 nonce 防重放；签名绑定 AppID、EnvId、函数名和完整请求。空配置拒绝服务。

`writeTeachers` 是本阶段额外的写入范围锁；初始为空。后续负责人明确批准某老师的具体操作后，将可信 teacherId 加入此列表才可 apply、复核确认或处理退款。添加名单只是解除范围锁，仍须逐笔证据、原因、预览和审计。不得批量加入62名候选或用昵称推断身份。当前没有普通老师写入授权。

独立密钥：`MEMBERSHIP_OPS_PREVIEW_KEY`、`MEMBERSHIP_OPS_INTERNAL_KEY`、`MEMBERSHIP_OPS_EVIDENCE_KEY`。查询官方接口复用原服务端 AppSecret / AppKey；不复制到小程序。部署现场密钥加密保存于仓库外 Windows DPAPI 文件，不纳入 Git。

普通用户对新增集合采用 ADMINONLY。函数内依然执行应用鉴权，管理 API 权限不能代替内部签名。无公开 HTTP 网关，无定时器。

## 调用方法

微信原生独立管理员可调用 `{action, request}`。内部运营优先使用 `scripts/membership-ops.js`：从本机安全环境注入 `MEMBERSHIP_OPS_INTERNAL_KEY`，输入一个 JSON 文件，输出一个**新文件**，内容可交给已配置 CloudBase MCP `manageFunctions`。输出中已固定 `action=invokeFunction`、`functionName=membership_ops`。工具不发网络请求、不写数据库；提交时核对 MCP 当前完整环境ID。

```text
node scripts/membership-ops.js <本机请求JSON路径> <新调用参数JSON路径>
```

输入结构为 `{"operator":"final_c_operator","action":"listAudit","request":{}}`。生成参数五分钟内提交；重试业务动作使用同一个 requestId，重新生成新 nonce 的签名。不要把密钥或签名参数贴进聊天、Git或普通日志。请求文件中身份和付款依据也仅保存在受控内部位置。

## 能力与流程

| 动作 | request字段及含义 |
|---|---|
| getTeacher | teacherId；精确查 teachers.teacher_id，唯一匹配才返回会员账本投影、来源及revision。只读，不初始化 |
| getOrder | orderId；仅正式域原订单，脱敏输出状态、金额、商品、平台paidAt与退款状态 |
| listReview | 可选offset/teacherId/orderId；每页扫描20笔，必须沿nextOffset翻页，即使本页items为空。包含异常、退款复核，排除已退款终态 |
| listHistoricalReviews | 可选offset/teacherId；查看证据不足、身份不明或权益冲突的补录请求。只能核实事实后发起新的preview，不可直接强制apply |
| listAudit | 可选offset/teacherId/orderId；分页查询脱敏审计。账本操作保留before/after，支付审计保留证据摘要和经办人；所有已鉴权读写尝试另记调用审计 |
| previewGrant | 下表的规范请求；返回before/after、revision、previewAt和签名token。历史证据不足返回review，不返回可apply token |
| applyGrant | `{request:原预览请求,revision,previewAt,token}`；5分钟内、账本revision未变才可执行。并发/重复request或同笔历史依据不得重发 |
| queryOfficial | orderId/requestId/reason；服务端查询原平台订单并验证身份、金额、付款时间和余额，返回脱敏状态及证据hash，不能自动开通 |
| recordEvidence | **仅签名内部入口**：reference/kind/orderId/sourceReference/payload/reason。必须来自独立获取的官方原始记录，不得使用前端success、人工猜测或订单截图中的不完整信息冒充确认。依据引用不可覆写；服务端签名存储 |
| reviewDecision | orderId/requestId/reason/decision，decision=hold或reject。reject拒绝本次人工补开判断；保持付款待确认，不伪造支付失败、不鼓励重复付款 |
| confirmPaidAndGrant | orderId/requestId/reason/reference；reference指已独立记录的official_order证据。再次官方查单确认仍为全额付款且余额未退款，调用原confirmPaidAndGrant事务 |
| processRefund | orderId/requestId/reason/reference；reference指official_refund证据，仅消费官方最终通知/已核实官方原始结果。不调用退款申请接口。金额不足、部分退款或证据不一致进入复核，保留原权益 |

所有时间为明确的epoch毫秒，按已有北京时间日历规则运算。

| previewGrant.kind | 必填数据与保护 |
|---|---|
| historical | teacherId/requestId/reason/paidAt/amount/paymentReference/evidence/timePrecision；amount为原实际收款分，可非39900；固定12个月。date_only必须另给timeBasis，不假造时间精度。paymentReference应稳定标识同一原付款，不因文件名、批次或请求ID改变。跨老师绑定也拒绝；重放同一付款不发第二份。原区间或既有权益将发生重排时review，过期历史不重新变一年 |
| gift | teacherId/requestId/reason/startsAt/duration；duration采用已有months或milliseconds格式。独立gift来源，有限期，不作为付款 |
| longTerm | teacherId/requestId/reason/startsAt；不传duration，独立internal_long_term来源。重复请求幂等，普通付款/退款不撤销 |
| adjustment | teacherId/requestId/reason/startsAt/operation；operation=grant须duration，operation=revoke_remaining须targetGrantId。只操作所指来源，不提供无审计直接改到期字段的动作；付款确认也不能自定义金额或期限 |

历史补录示例（仅合成示例，不能直接替换为真实名单批量执行）：

```json
{"kind":"historical","teacherId":"synthetic_teacher","requestId":"history_request_1","reason":"核实原始收款依据","paidAt":1788832800000,"amount":20000,"paymentReference":"original_receipt_1","evidence":"受控原始收据引用","timePrecision":"exact"}
```

official_order payload使用原订单及平台事实：reference由函数补入，其余含mode=short_series_goods、status=paid、orderId、teacherId、appId、env、productId（平台原商品）、channel、amount、currency、unit、transactionId、paidAt、offerId、quantity。服务器逐项比较原订单快照和可信查单候选；管理员传错金额、商品、时长无法补开。

official_refund payload必须为平台原始加密通知 `{body,query}`，含原始Encrypt与msg_signature/timestamp/nonce；函数使用独立服务端通知token/AES配置和已有验签解密器核验AppID及原始账号。**手填明文退款JSON即使由签名管理员提交也只进入review，不具备撤销权限。** 解密后核对原订单及ToUserName、MsgType=event、Event=xpay_refund_notify、OpenId、MchOrderId、WxOrderId、WxRefundId、RetCode、RefundFee、RefundSuccTimestamp。必须保留sourceReference；拿不到原始可信通知则继续复核，不能猜测或改走未验证平台字段。RetCode非0保留权益并记录失败；全额成功只撤销该订单payment grant剩余权益，原订单永久保留退款终态。部分退款不推算扣时。

## 验证与恢复

长期定向测试入口为 `node --test test/membership-final-c/ops.test.js`，用于以后修改相关能力时按授权范围验证；Git封板不执行它，也不重跑任何冻结历史矩阵。实现阶段使用的临时云验收合成夹具不纳入Git或正式包；当时只写 `membership_ops_validation` 独立集合，没有平台网络调用，临时入口已关闭。

冻结退款验证使用加密合成可信退款证据：退款处理代码/运营闭环已验证，**尚未执行真实平台退款端到端验收**。后续如需真实平台退款，必须单独取得明确授权，不能以本手册或合成验证作为自动发起退款的许可。

生产打包：`node scripts/package-membership-final-c.js <不存在的新目录>`，仅生成membership_ops，固定SDK版本。按云函数Event / Nodejs18.15部署。生产包不含测试夹具。

恢复先将独立运营名单清空或关闭独立函数入口；保留审计和已发记录。已发生的权益变化应通过新的具名纠错记录处理，不能删除grant或手改isVip。Git回退不能撤销云端记录。该入口与业务、展示、Stage5函数独立，停用不会改写它们。

始终保持正式购买关闭、62人未rollout、个人缓冲未启动。独立分支Git封板不构成部署、正式发布或任何真实权益操作授权。
