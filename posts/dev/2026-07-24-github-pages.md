---
title: GitHub Pages に置く最小構成
date: 2026-07-24
tags: [develop, github]
---

静的ファイルだけで公開するための最小構成メモ。

## ローカルで確認

```bash
python3 tools/serve.py
# → http://localhost:8000
```

`file://` で HTML を直接開くと `fetch` がブロックされるため、必ずサーバー経由で開く。

## デプロイ

`main` に push すると GitHub Actions が `posts/index.json` を生成して Pages に公開する。

```yaml
- run: python3 tools/build_index.py
- uses: actions/upload-pages-artifact@v3
  with:
    path: .
```

初回のみ **Settings → Pages → Source** を「GitHub Actions」にしておく。
