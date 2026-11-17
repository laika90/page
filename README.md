# My Notes

Markdown + LaTeX で書ける、GitHub Pages 向けの静的な技術ブログです。

- **記事を追加するときは `posts/` に `.md` を置くだけ**。一覧 (`posts/index.json`) は自動で生成されます
- **フォルダ階層 = カテゴリ**（入れ子にできます）＋ **タグ**（複数可）
- LaTeX は MathJax で表示。`$...$` / `$$...$$` / `\(...\)` / `\[...\]` / `\begin{align}` などに対応、式番号と `\eqref` も使えます
- コードのハイライトとコピーボタン、目次（スクロール位置に追従）、前後の記事・関連記事、全文検索
- 一覧の絞り込みは URL に残るので（`index.html?tag=thermal` など）、リンクとして共有できます
- ダーク / ライトの切り替え

## ディレクトリ構成

```text
.
├── index.html              記事一覧
├── post.html               記事ページ（post.html?p=カテゴリ/ファイル名）
├── 404.html
├── assets/
│   ├── css/theme.css     色・フォント・サイズ（ここを編集）
│   ├── css/style.css     レイアウト
│   └── js/
│       ├── config.js       サイト設定（タイトル・差し色など）と MathJax 設定
│       ├── common.js       共通処理
│       ├── index.js        一覧ページ
│       └── post.js         記事ページ（Markdown + 数式のレンダリング）
├── posts/
│   ├── index.json          ← 自動生成（手で編集しない）
│   ├── about.md            About ページ（unlisted）
│   ├── guide/…             ← 書き方のサンプル記事
│   ├── dev/…
│   └── research/thermal/…  （画像は記事と同じフォルダに置ける）
├── tools/
│   ├── build_index.py      index.json の生成（Python 標準ライブラリのみ）
│   ├── serve.py            ローカルプレビュー（index.json を自動で再生成）
│   └── new_post.py         記事の雛形を作成
└── .github/workflows/deploy.yml   push するだけで公開
```

## 使い方

### ローカルで確認

```bash
python3 tools/serve.py        # → http://localhost:8000
```

記事を保存してブラウザを再読み込みするだけで反映されます（index.json を毎回自動で作り直すので、ビルドの手順は要りません）。

### 記事を書く

```bash
python3 tools/new_post.py research/thermal/lhp-model -t "LHP のモデル化" --tags thermal,research
# → posts/research/thermal/2026-11-17-lhp-model.md
```

もちろん、手でファイルを作っても構いません。front matter はすべて省略可能です。

```yaml
---
title: 記事タイトル
date: 2026-11-17
tags: [thermal, research]
summary: 一覧に表示される説明（省略すると本文の冒頭から自動生成）
draft: true        # 公開しない
unlisted: true     # 一覧に出さない（URL を知っていれば読める）
---
```

詳しい書き方はサンプル記事 `posts/guide/2026-11-17-how-to-write.md` を見てください。

### 公開（GitHub Pages）

1. このフォルダをリポジトリとして push する
2. GitHub の **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
3. あとは `main` に push するたびに、Actions が `index.json` を生成して公開します

> Actions を使わず「ブランチから公開」したい場合は、push 前に `python3 tools/build_index.py` を実行して `posts/index.json` もコミットしてください。

## 旧構成からの移行

- `manifest.json` は不要になりました。記事の情報は各 `.md` の front matter に書きます
- `tag:` / `tags:` / `dir:` は引き続き使えます（`dir: posts/research/thermal` はカテゴリとして扱います）
- 旧形式の URL `post.html?path=posts/xxx.md` も読めます

## デザインのカスタマイズ

デザインは「Swiss」スタイル（大きな文字・罫線・グリッド）です。見た目に関わる設定は次の2ファイルにまとまっています。

### `assets/js/config.js` の `SITE`

```js
window.SITE = {
  title: 'Keishiro Sakamoto', // ヘッダー・フッター・タブのタイトル
  palette: 'blue',            // 差し色: blue | red | green | orange | purple | mono
  defaultTheme: 'system',     // system | light | dark
  numberHeadings: true,       // h2 に 01, 02 … の番号
  charsPerMinute: 500,        // 読了時間の目安
};
```

URL に `?palette=red` を付けると、設定を変えずにその色をその場で試せます（リンク先にも引き継がれます）。

### `assets/css/theme.css`

| 変えたいもの | 変数 |
| --- | --- |
| 背景・文字・罫線の色（ライト / ダーク別） | `--bg` `--text` `--muted` `--line` `--rule` など |
| 差し色の追加 | `html[data-palette="名前"] { --accent-light: …; --accent-dark: …; }` を追加し、`palette: '名前'` |
| フォント | `--font-sans` `--font-mono`（Google Fonts の読み込みは各 HTML の `<head>`） |
| 大見出し・記事タイトル・本文の大きさ | `--hero-size` `--title-size` `--body-size` |
| 角丸 | `--radius`（0 でシャープ、6px などで柔らかく） |
| ページ幅 | `--maxw` |

`--accent-light` は白背景、`--accent-dark` は黒背景の上で読める濃さ（コントラスト比 4.5:1 以上）を選んでください。

### その他

| やりたいこと | 場所 |
| --- | --- |
| トップの「Notes.」や紹介文 | `index.html` の `.hero` |
| ナビゲーション | `index.html` / `post.html` の `<nav>` |
| レイアウト・部品の形 | `assets/css/style.css` |
| LaTeX マクロ | `assets/js/config.js` の `macros` |
| 1ページの記事数 | `assets/js/index.js` の `PAGE_SIZE` |
