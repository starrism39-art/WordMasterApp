"""
啃词(WordMaster) 数据模拟与业务指标分析管线
==========================================
基于项目中真实的数据结构（wordMastery / learningRecords / stats / syncStatus）
生成仿真数据并进行多维度业务分析。

输出: output/raw_data.json（原始仿真数据）
      output/analysis_results.json（分析指标结果，供 dashboard 使用）

数据结构参考:
  cloud-sync.js       → wordMastery 三层嵌套, learningRecords, syncStatus
  cloud-migration.js  → mergeWordMasteryRecord, isWordMasteryRecord
  stats-engine.js     → calculateStudentCoreStats, saveStudentStats
  safe-merge-restore.js → buildStudentMatchKeys, mergeArrayByIdentity
"""

import json, os, random
from datetime import datetime, timedelta
from collections import defaultdict

CONFIG = {
    "num_teachers": 3,
    "students_per_teacher": (5, 12),
    "wordbooks_per_student": (1, 4),
    "words_per_wordbook": (50, 200),
    "simulation_days": 90,
    "avg_sessions_per_week": 4.5,
    "words_per_session": (5, 25),
    "mastered_rate_base": 0.58,
    "offline_rate": 0.18,
    "random_seed": 42,
}
random.seed(CONFIG["random_seed"])
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")

# ============ 数据生成 ============

def _gen_student_id(idx):
    return f"stu_{idx:04d}"

def _gen_wordbook_id(prefix, idx):
    return f"wb_{prefix}_{idx}"

def _gen_word(word_idx):
    words = ["apple","banana","cherry","date","elderberry","fig","grape","honeydew","kiwi","lemon",
             "mango","nectarine","orange","papaya","quince","raspberry","strawberry","tangerine","ugli","voavanga",
             "watermelon","xigua","yam","zucchini","apricot","blackberry","cantaloupe","dragonfruit","emblic","feijoa",
             "gooseberry","huckleberry","ilama","jackfruit","kumquat","lime","mulberry","nance","olive","pomegranate"]
    base = words[word_idx % len(words)]
    group = word_idx // len(words) + 1
    return f"z_10bit_norm_{base}_{group}"

def _generate_study_pattern(student_id, wordbook_id, word_ids, days):
    now = datetime(2026, 3, 1, 8, 0, 0)
    first_seen_day = {w: random.randint(0, days - 10) for w in word_ids}
    mastery_data = {}
    for word_id in word_ids:
        fs_day = first_seen_day[word_id]
        base_time = now + timedelta(days=fs_day)
        first_mastery_ts = int(base_time.timestamp() * 1000)
        review_count = random.randint(2, 15)
        timeline = []
        cumulative_rc = 0
        last_review_ts = first_mastery_ts
        for i in range(review_count):
            cumulative_rc += 1
            interval_days = min(2 ** i, 30)
            review_time = base_time + timedelta(days=min(interval_days, days - fs_day - 1))
            review_time += timedelta(hours=random.randint(-6, 6))
            review_ts = int(review_time.timestamp() * 1000)
            if cumulative_rc <= 3:
                status = random.choices(["correct","wrong","seen"], weights=[0.35,0.45,0.20])[0]
            elif cumulative_rc <= 7:
                status = random.choices(["correct","wrong","seen"], weights=[0.65,0.20,0.15])[0]
            else:
                status = random.choices(["correct","wrong","seen"], weights=[0.85,0.08,0.07])[0]
            timeline.append({"time": review_ts, "reviewCount": cumulative_rc, "status": status})
            last_review_ts = review_ts
        mastered = random.random() < 0.68
        difficult = (not mastered) if random.random() < 0.72 else mastered
        anti_forgetting = mastered and random.random() < 0.75
        next_review_ts = int((datetime.fromtimestamp(last_review_ts / 1000) + timedelta(days=random.randint(3,14))).timestamp() * 1000)
        mastery_data[word_id] = {
            "reviewCount": review_count,
            "firstMasteryTime": first_mastery_ts,
            "lastReviewTime": last_review_ts,
            "nextReviewTime": next_review_ts,
            "mastered": mastered, "difficult": difficult,
            "antiForgettingSeed": anti_forgetting, "isLearned": True,
            "reviewTimeline": sorted(timeline, key=lambda x: x["time"]),
        }
    return mastery_data

def _generate_learning_records(student_id, wordbook_id, word_mastery, days):
    records = []
    events = []
    for word_id, rec in word_mastery.items():
        for entry in rec.get("reviewTimeline", []):
            events.append({"word_id": word_id, "time": entry["time"], "reviewCount": entry["reviewCount"], "status": entry["status"]})
    events.sort(key=lambda x: x["time"])
    sessions = defaultdict(list)
    for ev in events:
        dt = datetime.fromtimestamp(ev["time"] / 1000).strftime("%Y-%m-%d")
        sessions[dt].append(ev)
    session_index = 0
    for date_str, evts in sorted(sessions.items()):
        session_index += 1
        word_ids_in_session = list(set(e["word_id"] for e in evts))
        not_mastered_ids = list(set(e["word_id"] for e in evts if e["status"] == "wrong"))
        difficult_ids = list(set(e["word_id"] for e in evts if e["status"] == "wrong"))
        records.append({
            "id": f"{student_id}|{wordbook_id}|{date_str}|{len(word_ids_in_session)}",
            "studentId": student_id, "student_id": student_id,
            "wordbookId": wordbook_id, "wordbook_id": wordbook_id,
            "studyDate": date_str, "date": date_str,
            "timestamp": int(datetime.strptime(date_str, "%Y-%m-%d").timestamp() * 1000),
            "totalWords": len(word_ids_in_session),
            "masteredWords": len(set(e["word_id"] for e in evts if e["status"] == "correct")),
            "notMasteredWordIds": not_mastered_ids,
            "difficultWordIds": difficult_ids,
            "recordType": "normal", "sessionIndex": session_index,
        })
    return records

def generate_dataset(config=None):
    cfg = config or CONFIG
    days = cfg["simulation_days"]
    word_mastery, learning_records_list, learning_progress = {}, [], {}
    student_info, teachers, stats_cache = [], [], {}
    wordbook_prefixes = ["renjiao_7","renjiao_8","yilin_7","yilin_8","beishi_1"]
    total_students = total_wordbooks = total_words = 0
    for t in range(cfg["num_teachers"]):
        teacher_id = f"teacher_{t+1:03d}"
        teachers.append(teacher_id)
        num_students = random.randint(*cfg["students_per_teacher"])
        for s in range(num_students):
            total_students += 1
            student_id = _gen_student_id(total_students)
            student_info.append({"id": student_id, "student_id": student_id, "name": f"Student_{total_students}",
                "grade": random.choice(["Grade 7","Grade 8","Grade 9"]), "teacher_id": teacher_id})
            num_wordbooks = random.randint(*cfg["wordbooks_per_student"])
            student_mastery = {}
            student_wordbooks = {}
            student_learned = 0
            for wb in range(num_wordbooks):
                total_wordbooks += 1
                prefix = random.choice(wordbook_prefixes)
                wordbook_id = _gen_wordbook_id(prefix, total_wordbooks)
                num_words = random.randint(*cfg["words_per_wordbook"])
                word_ids = [_gen_word(i) for i in range(total_words, total_words + num_words)]
                total_words += num_words
                mastery = _generate_study_pattern(student_id, wordbook_id, word_ids, days)
                student_mastery[wordbook_id] = mastery
                records = _generate_learning_records(student_id, wordbook_id, mastery, days)
                learning_records_list.extend(records)
                wb_mastered = sum(1 for rec in mastery.values() if rec["mastered"] or rec["difficult"])
                wb_total = len(mastery)
                student_learned += wb_mastered
                last_review = max((rec["lastReviewTime"] for rec in mastery.values()), default=0)
                student_wordbooks[wordbook_id] = {"completedCount": wb_mastered, "learnedWords": wb_mastered, "totalCount": wb_total, "lastStudyTime": last_review}
            word_mastery[student_id] = student_mastery
            student_total = sum(wb["totalCount"] for wb in student_wordbooks.values())
            learning_progress[student_id] = {"learnedWords": student_learned, "totalWords": student_total, "wordbooks": student_wordbooks}
            stats_cache[f"stats_{student_id}"] = {
                "masteredCount": student_learned, "notMasteredCount": student_total - student_learned,
                "checkinDays": len(set(r["studyDate"] for r in learning_records_list if r["studentId"] == student_id)),
                "calculatedAt": int(datetime.now().timestamp() * 1000), "isManualOverride": False}
    sync_status = {"pending": 0, "lastOk": int(datetime.now().timestamp() * 1000), "lastFail": int((datetime.now() - timedelta(days=2)).timestamp() * 1000)}
    pending_words = {}
    if random.random() < 0.15:
        sid = random.choice(list(word_mastery.keys()))
        wbid = random.choice(list(word_mastery[sid].keys()))
        for w in list(word_mastery[sid][wbid].keys())[:3]:
            pending_words[w] = {**word_mastery[sid][wbid][w], "student_id": sid, "wordbook_id": wbid}
    return {"metadata": {"generated_at": datetime.now().isoformat(), "schema_version": "2.0"},
        "summary": {"teachers": len(teachers), "students": total_students, "wordbooks": total_wordbooks,
            "words": total_words, "learning_records": len(learning_records_list), "checkin_days": days},
        "teachers": teachers, "student_info": student_info, "word_mastery": word_mastery,
        "learning_records": learning_records_list, "learning_progress": learning_progress,
        "stats_cache": stats_cache, "sync_status": sync_status, "pending_word_mastery_sync": pending_words}

# ============ 数据扁平化 ============

def flatten_word_mastery(wm):
    rows = []
    for student_id, wordbooks in wm.items():
        for wordbook_id, words in wordbooks.items():
            for word_id, record in words.items():
                rows.append({
                    "student_id": student_id, "wordbook_id": wordbook_id, "word_id": word_id,
                    "review_count": record.get("reviewCount", 0),
                    "first_mastery_time": record.get("firstMasteryTime"),
                    "last_review_time": record.get("lastReviewTime"),
                    "mastered": record.get("mastered", False),
                    "difficult": record.get("difficult", False),
                    "anti_forgetting_seed": record.get("antiForgettingSeed", False),
                    "is_learned": record.get("isLearned", False),
                    "timeline_entries": len(record.get("reviewTimeline", [])),
                })
    return rows

def flatten_learning_records(records):
    rows = []
    for rec in records:
        rows.append({
            "record_id": rec.get("id"),
            "student_id": rec.get("studentId") or rec.get("student_id"),
            "wordbook_id": rec.get("wordbookId") or rec.get("wordbook_id"),
            "study_date": rec.get("studyDate") or rec.get("date"),
            "timestamp": rec.get("timestamp"),
            "total_words": rec.get("totalWords", 0),
            "mastered_words": rec.get("masteredWords", 0),
            "not_mastered_count": len(rec.get("notMasteredWordIds", [])),
            "difficult_count": len(rec.get("difficultWordIds", [])),
            "record_type": rec.get("recordType", "normal"),
        })
    return rows

# ============ 业务指标计算 ============

def calculate_mastery_metrics(flat_mastery):
    total = len(flat_mastery)
    if total == 0: return {"error": "empty"}
    mastered = sum(1 for r in flat_mastery if r["mastered"])
    difficult = sum(1 for r in flat_mastery if r["difficult"])
    anti_f = sum(1 for r in flat_mastery if r["anti_forgetting_seed"])
    review_buckets = defaultdict(list)
    for r in flat_mastery:
        rc = min(r["review_count"], 15)
        review_buckets[rc].append(r["mastered"])
    review_accuracy = {str(rc): {"count": len(results), "mastered_rate": round(sum(results)/len(results),4)}
                       for rc, results in sorted(review_buckets.items())}
    return {"total_words": total, "mastered_words": mastered, "difficult_words": difficult,
            "anti_forgetting_words": anti_f, "mastery_rate": round(mastered/total,4),
            "difficult_rate": round(difficult/total,4),
            "anti_forgetting_coverage": round(anti_f/max(mastered,1),4),
            "review_accuracy_by_count": review_accuracy}

def calculate_temporal_metrics(flat_mastery, flat_records):
    intervals = []
    for row in flat_mastery:
        if row["first_mastery_time"] and row["last_review_time"]:
            interval_days = (row["last_review_time"] - row["first_mastery_time"]) / (1000*3600*24)
            intervals.append({"word_id": row["word_id"], "student_id": row["student_id"],
                "interval_days": round(interval_days,1), "review_count": row["review_count"], "mastered": row["mastered"]})
    interval_buckets = defaultdict(lambda: {"count":0, "mastered":0})
    for item in intervals:
        bucket = min(int(item["interval_days"]/7), 12)
        key = f"{bucket*7}-{(bucket+1)*7}d"
        interval_buckets[key]["count"] += 1
        if item["mastered"]: interval_buckets[key]["mastered"] += 1
    interval_retention = {b: {"count":v["count"], "retention_rate":round(v["mastered"]/max(v["count"],1),4)}
                          for b,v in sorted(interval_buckets.items())}
    dates = sorted(set(r["study_date"] for r in flat_records if r.get("study_date")))
    daily_active = defaultdict(int)
    student_weekly_active = defaultdict(set)
    student_monthly_active = defaultdict(set)
    for r in flat_records:
        if r.get("study_date") and r.get("student_id"):
            daily_active[r["study_date"]] += 1
            dt = datetime.strptime(r["study_date"], "%Y-%m-%d")
            wk = f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]}"
            student_weekly_active[wk].add(r["student_id"])
            student_monthly_active[r["study_date"][:7]].add(r["student_id"])
    dau_v = [v for k,v in sorted(daily_active.items())]
    wau_v = [len(v) for k,v in sorted(student_weekly_active.items())]
    return {"interval_retention": interval_retention,
        "dau": {"dates": sorted(daily_active.keys()), "values": dau_v, "avg": round(sum(dau_v)/max(len(dau_v),1),1), "max": max(dau_v) if dau_v else 0},
        "wau": {"weeks": sorted(student_weekly_active.keys()), "values": wau_v, "avg": round(sum(wau_v)/max(len(wau_v),1),1)}}

def calculate_checkin_analytics(flat_records):
    student_dates = defaultdict(set)
    for r in flat_records:
        if r.get("student_id") and r.get("study_date"):
            student_dates[r["student_id"]].add(r["study_date"])
    streaks = []
    for sid, dates in student_dates.items():
        sorted_dates = sorted(dates)
        max_streak = 1
        current_streak = 1
        for i in range(1, len(sorted_dates)):
            prev = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d")
            curr = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            if (curr - prev).days == 1:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 1
        streaks.append({"student_id": sid, "total_checkin_days": len(dates), "max_streak": max_streak,
                        "active_days_ratio": round(len(dates)/max(dates.__len__() if hasattr(dates, '__len__') else len(dates), 0) if False else len(dates)/CONFIG["simulation_days"], 4)})
    # Fix: recalculate properly
    streaks = []
    for sid, dates in student_dates.items():
        sorted_dates = sorted(dates)
        max_streak = current_streak = 1 if len(sorted_dates) > 0 else 0
        for i in range(1, len(sorted_dates)):
            prev = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d")
            curr = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            if (curr - prev).days == 1:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 1
        streaks.append({"student_id": sid, "total_checkin_days": len(dates), "max_streak": max_streak,
                        "active_days_ratio": round(len(dates)/CONFIG["simulation_days"], 4)})
    checkin_dist = defaultdict(int)
    for s in streaks:
        bucket = min(s["total_checkin_days"] // 10 * 10, 80)
        checkin_dist[f"{bucket}-{bucket+10}d"] += 1
    return {"student_checkin_stats": streaks, "avg_checkin_days": round(sum(s["total_checkin_days"] for s in streaks)/max(len(streaks),1),1),
        "avg_max_streak": round(sum(s["max_streak"] for s in streaks)/max(len(streaks),1),1),
        "checkin_distribution": dict(sorted(checkin_dist.items())),
        "students_with_high_streak": sum(1 for s in streaks if s["max_streak"] >= 14)}

def calculate_wordbook_comparison(flat_mastery):
    wb_groups = defaultdict(list)
    for r in flat_mastery:
        wb_groups[r["wordbook_id"]].append(r)
    comparison = {}
    for wbid, words in wb_groups.items():
        total = len(words)
        mastered = sum(1 for w in words if w["mastered"])
        comparison[wbid] = {"total_words": total, "mastered": mastered,
            "mastery_rate": round(mastered/max(total,1),4),
            "avg_review_count": round(sum(w["review_count"] for w in words)/max(total,1),2)}
    return comparison

def calculate_sync_reliability_metrics(stats_cache, pending_words, sync_status, total_words):
    conflict_rate = CONFIG["offline_rate"]
    estimated_conflicts = int(total_words * conflict_rate)
    protection_rate = 0.60
    protected_records = int(estimated_conflicts * protection_rate)
    pending_count = len(pending_words)
    pending_recovery_rate = 0.92
    recovered = int(pending_count * pending_recovery_rate)
    manual_protection = sum(1 for v in stats_cache.values() if v.get("isManualOverride"))
    return {"total_words": total_words, "estimated_conflict_window_records": estimated_conflicts,
        "anti_degradation_protection_rate": protection_rate, "protected_from_regression": protected_records,
        "pending_queue": {"current_pending_count": pending_count, "estimated_recovery_rate": pending_recovery_rate, "estimated_recovered": recovered},
        "manual_override_protected_students": manual_protection,
        "estimated_data_integrity_rate": round(1 - (estimated_conflicts * (1-protection_rate) / max(total_words,1)), 4)}

# ============ 主入口 ============

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("=" * 60)
    print("WordMaster 数据模拟与分析管线")
    print("=" * 60)
    print("\n[1/3] 生成仿真数据...")
    dataset = generate_dataset()
    s = dataset["summary"]
    print(f"      教师: {s['teachers']} | 学生: {s['students']} | 词书: {s['wordbooks']} | 单词: {s['words']} | 学习记录: {s['learning_records']}")
    with open(os.path.join(OUTPUT_DIR, "raw_data.json"), "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    print("\n[2/3] 执行业务指标分析...")
    flat_mastery = flatten_word_mastery(dataset["word_mastery"])
    flat_records = flatten_learning_records(dataset["learning_records"])
    results = {
        "data_summary": s,
        "mastery_metrics": calculate_mastery_metrics(flat_mastery),
        "temporal_metrics": calculate_temporal_metrics(flat_mastery, flat_records),
        "checkin_analytics": calculate_checkin_analytics(flat_records),
        "wordbook_comparison": calculate_wordbook_comparison(flat_mastery),
        "sync_reliability": calculate_sync_reliability_metrics(dataset["stats_cache"], dataset["pending_word_mastery_sync"], dataset["sync_status"], len(flat_mastery)),
        "computed_at": datetime.now().isoformat(),
    }
    m = results["mastery_metrics"]
    print(f"      掌握率: {m['mastery_rate']*100:.1f}% ({m['mastered_words']}/{m['total_words']})")
    print(f"      困难词率: {m['difficult_rate']*100:.1f}%")
    t = results["temporal_metrics"]
    print(f"      日均DAU: {t['dau']['avg']}, 峰值: {t['dau']['max']}")
    c = results["checkin_analytics"]
    print(f"      平均打卡天数: {c['avg_checkin_days']}, 长连续(>=14天): {c['students_with_high_streak']}人")
    sr = results["sync_reliability"]
    print(f"      防退化保护记录: {sr['protected_from_regression']}条, 数据完整率: {sr['estimated_data_integrity_rate']*100:.1f}%")
    with open(os.path.join(OUTPUT_DIR, "analysis_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    # Dashboard data (lightweight)
    dash = {
        "summary": s,
        "mastery": {"mastery_rate": m["mastery_rate"], "difficult_rate": m["difficult_rate"],
            "anti_forgetting_coverage": m["anti_forgetting_coverage"],
            "review_accuracy_by_count": m["review_accuracy_by_count"]},
        "temporal": {"interval_retention": t["interval_retention"], "dau": t["dau"], "wau": t["wau"]},
        "checkin": {"avg_checkin_days": c["avg_checkin_days"], "avg_max_streak": c["avg_max_streak"],
            "checkin_distribution": c["checkin_distribution"], "students_with_high_streak": c["students_with_high_streak"]},
        "wordbook_comparison": results["wordbook_comparison"],
        "sync_reliability": sr,
    }
    with open(os.path.join(OUTPUT_DIR, "dashboard_data.json"), "w", encoding="utf-8") as f:
        json.dump(dash, f, ensure_ascii=False, indent=2)
    print(f"\n[3/3] 完成! 所有输出位于 {OUTPUT_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
