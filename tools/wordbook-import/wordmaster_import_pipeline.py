#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""WordMaster wordbook import pipeline.

Converts PDF, CSV, and Excel sources into the cloud wordbook JSON shape used by
WordMaster. The PDF parser is profile based: the shared pipeline is reusable,
while source-specific layout rules stay explicit and auditable.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


POS_PATTERN = re.compile(
    r"^(n|v|vt|vi|adj|adv|prep|conj|pron|num|det|art|int|abbr|title|modal v|aux v|linking v)"
    r"(\./?|\.|)([/, ]+(n|v|vt|vi|adj|adv|prep|conj|pron|num|det|art|int|abbr|title|modal v|aux v|linking v)\.?)*/?$",
    re.IGNORECASE,
)
CJK_PATTERN = re.compile(r"[\u4e00-\u9fff]")
PHONETIC_PATTERN = re.compile(r"^[/\[].*[/\]]$")

FIELD_ALIASES = {
    "word": ["word", "词汇", "单词", "vocabulary"],
    "phonetic": ["phonetic", "音标", "pronunciation"],
    "pos": ["pos", "词性", "part_of_speech", "partOfSpeech"],
    "meaning": ["meaning", "中文释义", "释义", "translation"],
    "definition": ["definition", "英文释义", "英文定义", "english_definition"],
    "order": ["order", "序号", "顺序"],
}


@dataclass
class ImportedEntry:
    word: str
    phonetic: str
    pos: str
    meaning: str
    definition: str
    order: int
    wordbookId: str
    sourcePage: Optional[int] = None
    sourceSection: str = ""

    def to_json(self) -> Dict[str, object]:
        return {
            "word": self.word,
            "phonetic": self.phonetic,
            "pos": self.pos,
            "meaning": self.meaning,
            "definition": self.definition,
            "order": self.order,
            "wordbookId": self.wordbookId,
        }


def compact_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def has_cjk(value: str) -> bool:
    return bool(CJK_PATTERN.search(value or ""))


def normalize_pos(value: str) -> str:
    value = compact_text(value).replace("．", ".")
    value = value.replace(" / ", "/").replace(" /", "/").replace("/ ", "/")
    if value and not value.endswith(".") and value.lower() not in {"modal v"} and "/" not in value:
        value = value + "."
    value = value.replace("n./adj..", "n./adj.").replace("v./n..", "v./n.")
    return value


def make_meaning(pos: str, chinese: str) -> str:
    pos = normalize_pos(pos)
    chinese = compact_text(chinese)
    if not chinese:
        return pos
    if pos and not chinese.lower().startswith(pos.lower()):
        return f"{pos} {chinese}".strip()
    return chinese


def looks_like_pos(value: str) -> bool:
    return bool(POS_PATTERN.match(normalize_pos(value)))


def repair_row_fields(row: Dict[str, object]) -> Dict[str, object]:
    fixed = dict(row)
    phonetic = compact_text(fixed.get("phonetic"))
    pos = normalize_pos(compact_text(fixed.get("pos")))
    meaning = compact_text(fixed.get("meaning"))
    definition = compact_text(fixed.get("definition"))

    if phonetic and not (phonetic.startswith("/") or phonetic.startswith("[")):
        parts = phonetic.rsplit(" ", 1)
        if len(parts) == 2 and (parts[1].startswith("/") or parts[1].startswith("[")):
            prefix, tail = parts
            if looks_like_pos(prefix) and not pos:
                pos = normalize_pos(prefix)
            phonetic = tail
        elif looks_like_pos(phonetic) and not pos:
            pos = normalize_pos(phonetic)
            phonetic = ""
        else:
            matches = re.findall(r"[/\[][^\s]+[/\]]", phonetic)
            if matches:
                phonetic = matches[-1]

    if pos and has_cjk(pos):
        match = re.match(r"^([A-Za-z./, ]+\.)\s*(.+)$", pos)
        if match:
            pos = normalize_pos(match.group(1))
            if not meaning or not meaning.lower().startswith(pos.lower()):
                meaning = match.group(2)

    if not pos and meaning:
        match = re.match(r"^([A-Za-z./, ]+\.)\s+(.+)$", meaning)
        if match and looks_like_pos(match.group(1)):
            pos = normalize_pos(match.group(1))
            meaning = match.group(2)

    if phonetic and definition and phonetic in definition:
        definition = compact_text(definition.replace(phonetic, ""))

    if meaning:
        meaning = re.split(r"\s+[A-Z][A-Za-z'.,;!?-]*(?:\s|$)", meaning, maxsplit=1)[0]

    fixed["phonetic"] = phonetic
    fixed["pos"] = pos
    fixed["meaning"] = meaning
    fixed["definition"] = definition
    return fixed


def canonical_header_map(headers: Sequence[object]) -> Dict[str, int]:
    lowered = [compact_text(item).lower() for item in headers]
    result: Dict[str, int] = {}
    for canonical, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            alias_l = alias.lower()
            if alias_l in lowered:
                result[canonical] = lowered.index(alias_l)
                break
    return result


def standardize_rows(rows: Iterable[Dict[str, object]], wordbook_id: str) -> List[ImportedEntry]:
    entries: List[ImportedEntry] = []
    for index, row in enumerate(rows, start=1):
        row = repair_row_fields(row)
        word = compact_text(row.get("word"))
        if not word:
            continue
        pos = normalize_pos(compact_text(row.get("pos")))
        chinese = compact_text(row.get("meaning"))
        entries.append(
            ImportedEntry(
                word=word,
                phonetic=compact_text(row.get("phonetic")),
                pos=pos,
                meaning=make_meaning(pos, chinese),
                definition=compact_text(row.get("definition")),
                order=int(row.get("order") or index),
                wordbookId=wordbook_id,
                sourcePage=row.get("sourcePage") if isinstance(row.get("sourcePage"), int) else None,
                sourceSection=compact_text(row.get("sourceSection")),
            )
        )
    return entries


def parse_csv(source: Path, wordbook_id: str) -> List[ImportedEntry]:
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        rows = list(reader)
    if not rows:
        return []
    header_map = canonical_header_map(rows[0])
    normalized_rows = []
    for raw_index, row in enumerate(rows[1:], start=1):
        item = {}
        for field, col in header_map.items():
            item[field] = row[col] if col < len(row) else ""
        item.setdefault("order", raw_index)
        normalized_rows.append(item)
    return standardize_rows(normalized_rows, wordbook_id)


def parse_excel(source: Path, wordbook_id: str) -> List[ImportedEntry]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise RuntimeError("Excel import requires openpyxl in the Python environment") from exc

    workbook = load_workbook(source, read_only=True, data_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    header_map = canonical_header_map(rows[0])
    normalized_rows = []
    for raw_index, row in enumerate(rows[1:], start=1):
        item = {}
        for field, col in header_map.items():
            item[field] = row[col] if col < len(row) else ""
        item.setdefault("order", raw_index)
        normalized_rows.append(item)
    workbook.close()
    return standardize_rows(normalized_rows, wordbook_id)


def nearest_bullet(top: float, bullet_tops: Sequence[float]) -> int:
    return min(range(len(bullet_tops)), key=lambda idx: abs(top - bullet_tops[idx]))


def collect_entry_tokens(page, bullet_tops: Sequence[float]) -> List[List[Dict[str, object]]]:
    words = page.extract_words(
        x_tolerance=1,
        y_tolerance=3,
        keep_blank_chars=False,
        use_text_flow=False,
    )
    groups: List[List[Dict[str, object]]] = [[] for _ in bullet_tops]
    if not bullet_tops:
        return groups

    min_top = min(bullet_tops) - 18
    max_top = max(bullet_tops) + 18
    for token in words:
        text = token["text"]
        if text in {"•", "词汇", "英文释义", "音标", "词性", "中文释义"}:
            continue
        if token["top"] < min_top or token["top"] > max_top:
            continue
        idx = nearest_bullet(float(token["top"]), bullet_tops)
        if abs(float(token["top"]) - bullet_tops[idx]) <= 20:
            groups[idx].append(token)
    for group in groups:
        group.sort(key=lambda item: (round(float(item["top"]), 1), float(item["x0"])))
    return groups


def row_tokens(group: Sequence[Dict[str, object]], bullet_top: float, tolerance: float = 5.0):
    return [t for t in group if abs(float(t["top"]) - bullet_top) <= tolerance]


def join_tokens(tokens: Sequence[Dict[str, object]]) -> str:
    return compact_text(" ".join(str(t["text"]) for t in sorted(tokens, key=lambda item: (item["top"], item["x0"]))))


def parse_round1_page(page, page_number: int, wordbook_id: str) -> List[Dict[str, object]]:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False, use_text_flow=False)
    bullet_tops = [float(w["top"]) for w in words if w["text"] == "•" and 10 <= float(w["x0"]) <= 22]
    if not bullet_tops:
        return []

    groups = collect_entry_tokens(page, bullet_tops)
    rows: List[Dict[str, object]] = []
    for bullet_top, group in zip(bullet_tops, groups):
        same_row = row_tokens(group, bullet_top)
        word = join_tokens([t for t in same_row if 20 <= float(t["x0"]) < 100])
        phonetic_tokens = extract_phonetic_tokens([t for t in same_row if 300 <= float(t["x0"]) < 450], max_x=450)
        phonetic = join_tokens(phonetic_tokens)
        phonetic_left = float(phonetic_tokens[0]["x0"]) if phonetic_tokens else 365
        phonetic_right = max(float(t["x1"]) for t in phonetic_tokens) if phonetic_tokens else 440

        cjk_same_row = [t for t in same_row if has_cjk(str(t["text"])) and float(t["x0"]) > phonetic_right]
        meaning_left = min((float(t["x0"]) for t in cjk_same_row), default=490)
        pos = join_tokens([t for t in same_row if phonetic_right <= float(t["x0"]) < meaning_left])
        definition = join_tokens([t for t in group if 95 <= float(t["x0"]) < phonetic_left])
        meaning = join_tokens([t for t in group if meaning_left <= float(t["x0"])])
        if word:
            rows.append(
                {
                    "word": word,
                    "phonetic": phonetic,
                    "pos": pos,
                    "meaning": meaning,
                    "definition": definition,
                    "sourcePage": page_number,
                    "sourceSection": "round1",
                }
            )
    return rows


FUNCTION_POS_BY_HEADING = {
    "情态动词": "modal v.",
    "冠词": "art.",
    "介词": "prep.",
    "连词": "conj.",
    "不定代词": "pron.",
    "复合不定代词": "pron.",
    "指示代词": "pron.",
    "疑问代词": "pron.",
}


def detect_function_heading(page, bullet_top: float, default_heading: str = "") -> str:
    tokens = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False, use_text_flow=False)
    candidates: List[Tuple[float, str]] = []
    for token in tokens:
        text = str(token["text"])
        if text in FUNCTION_POS_BY_HEADING and float(token["top"]) < bullet_top:
            candidates.append((float(token["top"]), text))
    if not candidates:
        return default_heading
    return max(candidates, key=lambda item: item[0])[1]


def extract_phonetic_tokens(tokens: Sequence[Dict[str, object]], max_x: float = 190) -> List[Dict[str, object]]:
    sorted_tokens = sorted(tokens, key=lambda item: item["x0"])
    start_index = next(
        (idx for idx, token in enumerate(sorted_tokens)
         if str(token["text"]).startswith("[") or str(token["text"]).startswith("/")),
        None,
    )
    if start_index is None:
        return []

    result = []
    for token in sorted_tokens[start_index:]:
        if float(token["x0"]) >= max_x:
            break
        result.append(token)
        joined = " ".join(str(t["text"]) for t in result)
        if (joined.startswith("[") and "]" in joined) or (joined.startswith("/") and joined.endswith("/")):
            break
    return result


def parse_function_page(page, page_number: int, wordbook_id: str, default_heading: str = "") -> List[Dict[str, object]]:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False, use_text_flow=False)
    bullet_tops = [float(w["top"]) for w in words if w["text"] == "•" and 10 <= float(w["x0"]) <= 22]
    if not bullet_tops:
        return []

    groups = collect_entry_tokens(page, bullet_tops)
    rows: List[Dict[str, object]] = []
    for bullet_top, group in zip(bullet_tops, groups):
        same_row = row_tokens(group, bullet_top, tolerance=7)
        heading = detect_function_heading(page, bullet_top, default_heading=default_heading)
        pos = FUNCTION_POS_BY_HEADING.get(heading, "")

        phonetic_tokens = extract_phonetic_tokens([t for t in same_row if float(t["x0"]) >= 95])
        phonetic_start = float(phonetic_tokens[0]["x0"]) if phonetic_tokens else None
        phonetic_token_ids = {id(token) for token in phonetic_tokens}
        word_limit = phonetic_start if phonetic_start is not None else 110
        word_tokens = [t for t in same_row if 20 <= float(t["x0"]) < word_limit]

        meaning_left = 150 if phonetic_tokens else 110
        meaning_tokens = [
            t for t in group
            if meaning_left <= float(t["x0"]) < 340
            and id(t) not in phonetic_token_ids
            and not str(t["text"]).startswith("[")
            and not str(t["text"]).startswith("/")
        ]
        # Remove the word itself from the meaning bucket when wide words cross x=115.
        word = join_tokens(word_tokens)
        meaning_text = join_tokens(meaning_tokens)
        if word and meaning_text.startswith(word + " "):
            meaning_text = compact_text(meaning_text[len(word):])
        meaning_text = re.split(r"\s+[A-Z][A-Za-z'.,;!?-]*\s", meaning_text, maxsplit=1)[0]

        if word:
            rows.append(
                {
                    "word": word,
                    "phonetic": join_tokens(phonetic_tokens),
                    "pos": pos,
                    "meaning": meaning_text,
                    "definition": "",
                    "sourcePage": page_number,
                    "sourceSection": f"function:{heading}" if heading else "function",
                }
            )
    return rows


def parse_pdf(source: Path, wordbook_id: str, profile: str) -> List[ImportedEntry]:
    try:
        import pdfplumber
    except ImportError as exc:
        raise RuntimeError("PDF import requires pdfplumber in the Python environment") from exc

    rows: List[Dict[str, object]] = []
    with pdfplumber.open(source) as pdf:
        current_function_heading = ""
        for index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            is_round1 = "[ Round 1_" in text and "词汇" in text and "英文释义" in text and "中文释义" in text
            if is_round1:
                rows.extend(parse_round1_page(page, index, wordbook_id))
                continue
            if profile == "junior1600" and "其他功能词" in text and "单词 音标 中文释义 英文例句" in text:
                for heading in FUNCTION_POS_BY_HEADING:
                    if heading in text:
                        current_function_heading = heading
                # Page 234 is the numeral table without bullet vocabulary rows; it is kept out
                # until a source-specific config requires numbered entries.
                rows.extend(parse_function_page(page, index, wordbook_id, default_heading=current_function_heading))

    for order, row in enumerate(rows, start=1):
        row["order"] = order
    return standardize_rows(rows, wordbook_id)


def validate_entries(entries: Sequence[ImportedEntry]) -> Dict[str, object]:
    word_counts = Counter(entry.word.lower() for entry in entries)
    duplicate_words = [
        {"word": word, "count": count}
        for word, count in sorted(word_counts.items())
        if count > 1
    ]

    issues = []
    for entry in entries:
        empty = [field for field in ["word", "meaning", "pos"] if not getattr(entry, field)]
        if empty:
            issues.append({"order": entry.order, "word": entry.word, "type": "empty_field", "fields": empty})
        if entry.phonetic and not PHONETIC_PATTERN.match(entry.phonetic):
            issues.append({"order": entry.order, "word": entry.word, "type": "phonetic_format", "phonetic": entry.phonetic})
        if entry.pos and not POS_PATTERN.match(entry.pos):
            issues.append({"order": entry.order, "word": entry.word, "type": "pos_format", "pos": entry.pos})
        if entry.meaning and not has_cjk(entry.meaning):
            issues.append({"order": entry.order, "word": entry.word, "type": "meaning_no_chinese", "meaning": entry.meaning})

    source_counts = Counter(entry.sourceSection or "unknown" for entry in entries)
    page_counts = Counter(entry.sourcePage for entry in entries if entry.sourcePage)
    return {
        "rawCount": len(entries),
        "cleanedCount": len(entries),
        "deletedCount": 0,
        "duplicateWords": duplicate_words,
        "issueCount": len(issues),
        "issues": issues,
        "sourceCounts": dict(source_counts),
        "pageCounts": {str(key): value for key, value in sorted(page_counts.items())},
        "firstWords": [entry.word for entry in entries[:10]],
        "lastWords": [entry.word for entry in entries[-10:]],
    }


def write_outputs(entries: Sequence[ImportedEntry], output: Path, report: Path) -> Dict[str, object]:
    output.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    payload = [entry.to_json() for entry in entries]
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    validation = validate_entries(entries)
    report.write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return validation


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Convert source wordbooks into WordMaster cloud JSON.")
    parser.add_argument("--input", required=True, help="PDF, CSV, XLSX, or XLS source path.")
    parser.add_argument("--format", choices=["pdf", "csv", "excel"], required=True)
    parser.add_argument("--wordbook-id", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument(
        "--pdf-profile",
        choices=["round1", "junior1600"],
        default="round1",
        help="round1 extracts screenshot-style Round 1 tables; junior1600 also includes the function-word appendix.",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    source = Path(args.input)
    output = Path(args.output)
    report = Path(args.report)

    if args.format == "pdf":
        entries = parse_pdf(source, args.wordbook_id, args.pdf_profile)
    elif args.format == "csv":
        entries = parse_csv(source, args.wordbook_id)
    else:
        entries = parse_excel(source, args.wordbook_id)

    validation = write_outputs(entries, output, report)
    print(json.dumps({
        "output": str(output),
        "report": str(report),
        "count": len(entries),
        "issueCount": validation["issueCount"],
        "duplicateWordCount": len(validation["duplicateWords"]),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
