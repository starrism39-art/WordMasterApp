import json, os
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

BASE = os.path.dirname(os.path.dirname(__file__))
d = json.load(open(os.path.join(BASE, "output", "dashboard_data.json")))
s, m, t, c, sr = d["summary"], d["mastery"], d["temporal"], d["checkin"], d["sync_reliability"]

def pct(v):
    return "{:.1f}%".format(v * 100)

doc = Document()

# --- Global style defaults ---
style = doc.styles["Normal"]
style.font.name = "Microsoft YaHei"
style.font.size = Pt(11)
style.paragraph_format.space_after = Pt(6)
style.paragraph_format.line_spacing = 1.35
style.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")

for level in [1, 2, 3]:
    hs = doc.styles["Heading " + str(level)]
    hs.font.name = "Microsoft YaHei"
    hs.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    hs.font.color.rgb = RGBColor(0x0D, 0x47, 0xA1)

# --- Page 1: Title ---
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(120)
run = p.add_run("啃词 / WordMaster")
run.font.size = Pt(28)
run.font.color.rgb = RGBColor(0x1A, 0x73, 0xE8)
run.bold = True

p2 = doc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
run2 = p2.add_run("数据分析作品集")
run2.font.size = Pt(18)
run2.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

p3 = doc.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
p3.paragraph_format.space_before = Pt(40)
run3 = p3.add_run("基于微信小程序真实代码结构\n")
run3.font.size = Pt(11)
run3.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
run3b = p3.add_run("数据来源: cloud-sync.js, stats-engine.js, cloud-migration.js")
run3b.font.size = Pt(10)
run3b.font.color.rgb = RGBColor(0x99, 0x99, 0x99)

doc.add_page_break()

# --- Section 1: Project Overview ---
doc.add_heading("一、项目背景与数据概览", level=1)
doc.add_paragraph(
    "啃词（WordMaster）是一款面向英语教师的微信背词小程序。核心功能包括：多端离线同步、"
    "CRDT 语义合并引擎、抗遗忘间隔重复、多教材支持（人教版/译林版/北师大版等）。"
    "本项目基于其实际代码结构生成仿真数据集，对用户学习行为与系统容灾机制进行量化分析。"
)

table = doc.add_table(rows=6, cols=3)
table.style = "Light Grid"
table.alignment = WD_TABLE_ALIGNMENT.CENTER
headers = ["指标", "数值", "说明"]
for i, h in enumerate(headers):
    cell = table.rows[0].cells[i]
    cell.text = h
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.bold = True

data_rows = [
    ("教师数", str(s["teachers"]), "模拟课堂教学场景"),
    ("学生数", str(s["students"]), "每教师管理 5-12 人"),
    ("词书数", str(s["wordbooks"]), "含多版本教材"),
    ("单词记录数", str(s["words"]), "覆盖 50-200 词/词书"),
    ("学习会话", str(s["learning_records"]), "90 天完整模拟周期"),
]
for idx, (label, val, note) in enumerate(data_rows):
    table.rows[idx + 1].cells[0].text = label
    table.rows[idx + 1].cells[1].text = val
    table.rows[idx + 1].cells[2].text = note

# --- Section 2: Key Metrics ---
doc.add_heading("二、核心业务指标", level=1)
doc.add_paragraph(
    "以下指标基于 5732 条单词掌握记录和 4397 条学习会话计算得出，"
    "覆盖掌握率、活跃度、留存和容灾四个维度。"
)

kt = doc.add_table(rows=2, cols=6)
kt.style = "Light Grid"
kt.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, label in enumerate(["掌握率", "困难词率", "日均DAU", "平均打卡", "最大连续", "数据完整率"]):
    kt.rows[0].cells[i].text = label
    for p in kt.rows[0].cells[i].paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.size = Pt(9)

vals = [pct(m["mastery_rate"]), pct(m["difficult_rate"]),
        str(round(t["dau"]["avg"], 1)), str(round(c["avg_checkin_days"])) + "天",
        str(round(c["avg_max_streak"])) + "天", pct(sr["estimated_data_integrity_rate"])]
for i, v in enumerate(vals):
    kt.rows[1].cells[i].text = v
    for p in kt.rows[1].cells[i].paragraphs:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs:
            r.font.size = Pt(14)
            r.font.color.rgb = RGBColor(0x1A, 0x73, 0xE8)
            r.bold = True

# --- Section 3: Review Count vs Mastery ---
doc.add_heading("三、复习次数与掌握率分析", level=1)
doc.add_paragraph(
    "按 reviewCount 分组的 mastered 比例，用于验证间隔重复策略的有效性。"
    "数据来源于 wordMastery 三层嵌套结构（studentId → wordbookId → wordId → Record）的 reviewCount 和 mastered 字段。"
)

buckets = sorted(m["review_accuracy_by_count"].items(), key=lambda x: int(x[0]))
rt = doc.add_table(rows=min(len(buckets), 12) + 1, cols=3)
rt.style = "Light Grid"
for i, h in enumerate(["复习次数", "样本量", "掌握率"]):
    rt.rows[0].cells[i].text = h
    for p in rt.rows[0].cells[i].paragraphs:
        for r in p.runs:
            r.bold = True

for idx, (rc, v) in enumerate(buckets[:12]):
    rt.rows[idx + 1].cells[0].text = str(rc) + " 次"
    rt.rows[idx + 1].cells[1].text = str(v["count"])
    rt.rows[idx + 1].cells[2].text = pct(v["mastered_rate"])

doc.add_paragraph(
    "\n分析说明：随着 reviewCount 增加，掌握率呈上升趋势。"
    "该指标需结合 reviewTimeline 数组中的逐轮 status 字段进行更精细的 Ebbinghaus 遗忘曲线验证。"
    "reviewTimeline 的去重合并逻辑（复合键: time + reviewCount + status）参见 mergeWordMasteryRecord。"
)

# --- Section 4: Interval Retention ---
doc.add_heading("四、间隔-留存分析", level=1)
doc.add_paragraph(
    "首次学习时间（firstMasteryTime）到最近复习时间（lastReviewTime）的间隔天数与留存率的关系。"
    "留存率定义为 mastered = true 的比例，间隔越长留存率越低反映遗忘过程。"
)

it = doc.add_table(rows=len(t["interval_retention"]) + 1, cols=3)
it.style = "Light Grid"
for i, h in enumerate(["时间间隔", "样本量", "留存率"]):
    it.rows[0].cells[i].text = h
    for p in it.rows[0].cells[i].paragraphs:
        for r in p.runs:
            r.bold = True

for idx, (k, v) in enumerate(sorted(t["interval_retention"].items())):
    it.rows[idx + 1].cells[0].text = k
    it.rows[idx + 1].cells[1].text = str(v["count"])
    it.rows[idx + 1].cells[2].text = pct(v["retention_rate"])

# --- Section 5: Reliability ---
doc.add_heading("五、容灾协议量化评估", level=1)
doc.add_paragraph(
    "基于代码层的反退化协议（5维状态校验: reviewCount, lastReviewTime, mastered, difficult, isLearned）"
    "和持久化重试队列（pendingWordMasterySync, pendingLearningProgressSync），"
    "估算在弱网场景下对数据完整性的保护效果。"
)

srt = doc.add_table(rows=5, cols=2)
srt.style = "Light Grid"
srt.rows[0].cells[0].text = "评估维度"
srt.rows[0].cells[1].text = "数值"
for p in srt.rows[0].cells[0].paragraphs:
    for r in p.runs: r.bold = True
for p in srt.rows[0].cells[1].paragraphs:
    for r in p.runs: r.bold = True

srt.rows[1].cells[0].text = "总记录数"
srt.rows[1].cells[1].text = str(sr["total_words"])
srt.rows[2].cells[0].text = "冲突窗口记录数（18%场景）"
srt.rows[2].cells[1].text = str(sr["estimated_conflict_window_records"])
srt.rows[3].cells[0].text = "防退化协议拦截保护"
srt.rows[3].cells[1].text = str(sr["protected_from_regression"]) + " 条记录"
srt.rows[4].cells[0].text = "预期数据完整率"
srt.rows[4].cells[1].text = pct(sr["estimated_data_integrity_rate"])

doc.add_paragraph(
    "防退化协议逻辑参见 syncWordMasteryBatch 中的 cloudFresher 校验: "
    "写入前先 get 云端记录，在 5 个维度上逐条比对；仅当本地数据在任一维度上更新时才写入，"
    "否则跳过以保护云端不退化为旧值。"
)

# --- Section 6: Findings ---
doc.add_heading("六、核心发现与业务建议", level=1)

findings = [
    ("间隔重复策略有效，需阈值引导",
     "reviewCount ≥ 5 后掌握率显著提升。建议在 App 内引导学生在每个新词上至少完成 5 次复习，"
     "以达到稳定记忆。此功能可通过检查 wordMastery[student][wordbook][word].reviewCount 实现。"),
    ("28 天为留存拐点",
     "间隔超过 28 天后的留存率出现明显下降。建议将抗遗忘算法的 nextReviewTime 上限从默认值调低至 21 天，"
     "在遗忘曲线的陡降段之前介入复习。"),
    ("容灾协议具有工程必要性",
     "防退化 5 维校验 + pending 持久化重试队列在弱网场景下预期保护约 10% 的记录免于被旧数据覆写。"
     "建议在 __syncStatus 基础上增加实时监控面板，跟踪实际 intercepted/skipped 比。"),
    ("词书难度差异可作为分班依据",
     "不同词书的掌握率标准差显著。建议利用 stats_{studentId} 缓存中的 masteredCount 数据，"
     "为教师提供可视化的词书难度对比，辅助教学资源分配。"),
]

for title, detail in findings:
    p = doc.add_paragraph()
    run_title = p.add_run(title + "\n")
    run_title.bold = True
    run_title.font.size = Pt(11)
    run_detail = p.add_run(detail)
    run_detail.font.size = Pt(10)
    run_detail.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

# --- Save ---
out = os.path.join(BASE, "reports", "WordMaster_Data_Analysis_Portfolio.docx")
doc.save(out)
print("OK:", out)
