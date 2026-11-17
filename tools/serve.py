#!/usr/bin/env python3
"""ローカルプレビュー用サーバー。

    python3 tools/serve.py            # http://localhost:8000
    python3 tools/serve.py 8080       # ポート指定
    python3 tools/serve.py --drafts   # 下書きも一覧に表示

posts/index.json へのリクエストのたびに自動で再生成するので、
記事を書いて保存 → ブラウザを再読み込み、だけで反映されます。
"""
import argparse
import functools
import http.server
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_index import ROOT, build  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("port", nargs="?", type=int, default=8000)
    ap.add_argument("--drafts", action="store_true")
    args = ap.parse_args()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path.split("?")[0].endswith("/posts/index.json"):
                try:
                    build(include_drafts=args.drafts, quiet=True)
                except Exception as e:  # noqa: BLE001
                    self.log_error("index build failed: %s", e)
            super().do_GET()

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

    build(include_drafts=args.drafts)
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as httpd:
        print(f"Serving http://localhost:{args.port}/  (Ctrl+C で終了)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
