#!/usr/bin/env python3
"""新しい記事の雛形を作る。

    python3 tools/new_post.py research/thermal/lhp-model -t "LHP のモデル化" --tags thermal,research
      → posts/research/thermal/2026-11-17-lhp-model.md

    --no-date  ファイル名に日付を付けない
    --draft    draft: true を付ける（公開されない）
"""
import argparse
import datetime as dt
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "posts"

TEMPLATE = """---
title: {title}
date: {date}
tags: [{tags}]
summary:
{draft}---

ここに本文を書きます。インライン数式は $E = mc^2$ や \\( a^2 + b^2 = c^2 \\)。

## 見出し

$$
\\int_0^1 x^2 \\, dx = \\frac{{1}}{{3}}
$$
"""


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", help="カテゴリ/ファイル名（.md と日付は不要）例: dev/my-note")
    ap.add_argument("-t", "--title", default="")
    ap.add_argument("--tags", default="", help="カンマ区切り")
    ap.add_argument("--no-date", action="store_true")
    ap.add_argument("--draft", action="store_true")
    a = ap.parse_args()

    today = dt.date.today().isoformat()
    rel = Path(a.path.strip("/").removesuffix(".md"))
    name = rel.name
    if not a.no_date and not re.match(r"^\d{4}-\d{2}-\d{2}-", name):
        name = f"{today}-{name}"
    dest = POSTS / rel.parent / f"{name}.md"
    if dest.exists():
        sys.exit(f"既に存在します: {dest.relative_to(ROOT)}")

    tags = ", ".join(t.strip() for t in a.tags.split(",") if t.strip())
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        TEMPLATE.format(title=a.title or rel.name, date=today, tags=tags, draft="draft: true\n" if a.draft else ""),
        encoding="utf-8",
    )
    print(f"created {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
