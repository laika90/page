#!/usr/bin/env python3
"""posts/ 以下の Markdown を走査して posts/index.json を自動生成する。

標準ライブラリのみで動作します。

    python3 tools/build_index.py            # 通常
    python3 tools/build_index.py --drafts   # draft: true の記事も含める

ルール
  * posts/ 配下の *.md がすべて記事になる（manifest の手書きは不要）
  * フォルダ階層がそのままカテゴリになる（例: posts/research/thermal/x.md → research/thermal）
  * `_` や `.` で始まるフォルダ・ファイルは無視（下書き置き場などに使える）
  * front matter の `draft: true` は公開しない、`unlisted: true` は一覧に出さない（URL 直打ちでは読める）
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "posts"
OUT_FILE = POSTS_DIR / "index.json"

SUMMARY_LEN = 120
SEARCH_TEXT_LEN = 4000

FM_RE = re.compile(r"\A﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)(.*)\Z", re.S)
DATE_RE = re.compile(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})")
FILENAME_DATE_RE = re.compile(r"^(\d{4}-\d{1,2}-\d{1,2})[-_]?")


# ---------------------------------------------------------------- front matter
def _scalar(value: str):
    v = value.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    low = v.lower()
    if low in ("true", "yes"):
        return True
    if low in ("false", "no"):
        return False
    return v


def parse_front_matter(text: str) -> tuple[dict, str]:
    """YAML のごく一部（key: value / key: [a, b] / key:\\n  - a）だけを解釈する。"""
    m = FM_RE.match(text)
    if not m:
        return {}, text.lstrip("﻿")

    meta: dict = {}
    key = None
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        item = re.match(r"^\s*-\s+(.*)$", line)
        if item and key:
            if not isinstance(meta.get(key), list):
                meta[key] = []
            meta[key].append(_scalar(item.group(1)))
            continue
        kv = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not kv:
            continue
        key, val = kv.group(1), kv.group(2).strip()
        if val.startswith("[") and val.endswith("]"):
            meta[key] = [_scalar(s) for s in val[1:-1].split(",") if s.strip()]
        elif val == "":
            meta[key] = None  # 次行以降に "- item" が続く可能性
        else:
            meta[key] = _scalar(val)
    return meta, m.group(2)


def as_str(v) -> str:
    if v is None or isinstance(v, list):
        return ""
    return str(v).strip()


def as_list(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        items = v
    else:
        items = str(v).split(",")
    return [str(s).strip() for s in items if str(s).strip()]


def norm_date(v) -> str:
    m = DATE_RE.search(as_str(v))
    if not m:
        return ""
    y, mo, d = map(int, m.groups())
    try:
        return dt.date(y, mo, d).isoformat()
    except ValueError:
        return ""


# ---------------------------------------------------------------- text utils
def plain_text(md: str, keep_math: bool) -> str:
    t = re.sub(r"^ {0,3}(`{3,}|~{3,}).*?^ {0,3}\1[ \t]*$", " ", md, flags=re.S | re.M)
    if keep_math:
        t = re.sub(r"\$\$|\\\[|\\\]|\\\(|\\\)", " ", t)
    else:
        t = re.sub(r"\$\$.*?\$\$|\\\[.*?\\\]|\\begin\{(\w+\*?)\}.*?\\end\{\1\}", " ", t, flags=re.S)
        t = re.sub(r"\\\(.*?\\\)|(?<![\\$])\$[^$\n]+?\$", " ", t, flags=re.S)
    t = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+", "", t, flags=re.M)
    t = re.sub(r"[`*_~|]", "", t)
    t = re.sub(r"^\s*:?-{3,}:?\s*$", " ", t, flags=re.M)
    return re.sub(r"\s+", " ", t).strip()


def first_heading(md: str) -> str:
    m = re.search(r"^#\s+(.+?)\s*#*\s*$", md, flags=re.M)
    return m.group(1).strip() if m else ""


# ---------------------------------------------------------------- build
def build(include_drafts: bool = False, quiet: bool = False) -> list[dict]:
    log = (lambda *a: None) if quiet else (lambda *a: print(*a, file=sys.stderr))
    posts: list[dict] = []

    for path in sorted(POSTS_DIR.rglob("*.md")):
        rel = path.relative_to(POSTS_DIR)
        if any(part.startswith(("_", ".")) for part in rel.parts):
            continue

        text = path.read_text(encoding="utf-8")
        meta, body = parse_front_matter(text)

        if meta.get("draft") is True and not include_drafts:
            log(f"  skip (draft)    {rel.as_posix()}")
            continue
        if meta.get("unlisted") is True:
            log(f"  skip (unlisted) {rel.as_posix()}")
            continue

        slug = rel.with_suffix("").as_posix()

        category = as_str(meta.get("category")) or as_str(meta.get("dir"))
        category = re.sub(r"^/?posts/?", "", category).strip("/")
        if not category:
            parent = rel.parent.as_posix()
            category = "" if parent == "." else parent

        date = norm_date(meta.get("date"))
        if not date:
            fm = FILENAME_DATE_RE.match(path.stem)
            date = norm_date(fm.group(1)) if fm else ""
        if not date:
            date = dt.date.fromtimestamp(path.stat().st_mtime).isoformat()
            log(f"  warn: date がないため更新日時を使用 → {rel.as_posix()}")

        title = as_str(meta.get("title")) or first_heading(body)
        if not title:
            title = FILENAME_DATE_RE.sub("", path.stem).replace("-", " ").replace("_", " ")
            log(f"  warn: title がないためファイル名を使用 → {rel.as_posix()}")

        summary = as_str(meta.get("summary"))
        if not summary:
            s = plain_text(body, keep_math=False)
            if s.startswith(title):
                s = s[len(title):].strip()
            summary = s[:SUMMARY_LEN] + ("…" if len(s) > SUMMARY_LEN else "")

        posts.append(
            {
                "slug": slug,
                "title": title,
                "date": date,
                "updated": norm_date(meta.get("updated")),
                "category": category,
                "tags": as_list(meta.get("tags", meta.get("tag"))),
                "summary": summary,
                "draft": bool(meta.get("draft") is True),
                "text": plain_text(body, keep_math=True)[:SEARCH_TEXT_LEN],
            }
        )

    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)

    payload = json.dumps({"posts": posts}, ensure_ascii=False, indent=1) + "\n"
    old = OUT_FILE.read_text(encoding="utf-8") if OUT_FILE.exists() else ""
    if payload != old:
        OUT_FILE.write_text(payload, encoding="utf-8")
        log(f"wrote {OUT_FILE.relative_to(ROOT)} ({len(posts)} posts)")
    else:
        log(f"{OUT_FILE.relative_to(ROOT)} is up to date ({len(posts)} posts)")
    return posts


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--drafts", action="store_true", help="draft: true の記事も含める")
    args = ap.parse_args()
    build(include_drafts=args.drafts)


if __name__ == "__main__":
    main()
