---
title: 記事の書き方（このサイトの使い方）
date: 2026-11-17
tags: [guide, latex, markdown]
summary: front matter・数式・コード・画像・記事間リンクの書き方まとめ。
---

このサイトでは **`posts/` 以下に Markdown ファイルを置くだけ** で記事が増えます。
一覧（`posts/index.json`）はスクリプトが自動生成するので、手で編集する必要はありません。

## ファイルの置き場所 = カテゴリ

フォルダ階層がそのままカテゴリ（階層構造）になります。

```text
posts/
├── research/
│   └── thermal/
│       ├── 2026-07-26-lhp.md      → カテゴリ research/thermal
│       └── img/lhp.svg            → 記事から ./img/lhp.svg で参照
├── dev/
│   └── 2026-07-24-github-pages.md → カテゴリ dev
└── _drafts/                       → "_" で始まるフォルダは無視される
```

記事の URL は `post.html?p=research/thermal/2026-07-26-lhp` のようになります。

## front matter

ファイル先頭に書くメタ情報です。**すべて省略可能**です。

```yaml
---
title: 記事タイトル          # 省略時は本文の最初の "# 見出し" → ファイル名
date: 2026-11-17            # 省略時はファイル名先頭の日付 → 更新日時
updated: 2026-11-20         # 更新日（任意）
tags: [thermal, research]   # カンマ区切り or YAML のリスト
category: research/thermal  # 省略時はフォルダ階層
summary: 一覧に出る説明文     # 省略時は本文の冒頭から自動生成
draft: true                 # 公開しない
unlisted: true              # 一覧には出さないが URL で読める
---
```

タグは次のようにリスト形式でも書けます。

```yaml
tags:
  - thermal
  - research
```

## 数式（LaTeX）

MathJax を使っています。Markdown の記法と干渉しないよう、数式部分は保護してから変換しています。

### インライン

`$...$` または `\(...\)` で書きます：$E = mc^2$、\( \alpha_{\mathrm{eff}} = \frac{k}{\rho c_p} \)。

ドル記号そのものを書きたいときは `\$` とエスケープします（例：\$100）。

### ディスプレイ

`$$...$$` または `\[...\]`：

$$
\nabla \cdot \boldsymbol{q} = -\rho c_p \frac{\partial T}{\partial t} + \dot{q}_{\mathrm{gen}}
$$

### 番号付き数式と参照

`\begin{align}` などの環境は **そのまま** 書けます。`\label` を付ければ `\eqref` で参照できます。

\begin{align}
  Q &= U A \, \Delta T_{\mathrm{lm}} \label{eq:lmtd} \\
  \Delta T_{\mathrm{lm}} &= \frac{\Delta T_1 - \Delta T_2}{\ln(\Delta T_1 / \Delta T_2)} \label{eq:dtlm}
\end{align}

式 \eqref{eq:lmtd} に式 \eqref{eq:dtlm} を代入すると……のように書けます。

### 独自マクロ

`assets/js/config.js` の `macros` に登録すると全記事で使えます。初期状態で以下が入っています。

$$
\pdv{T}{t} = \alpha \nabla^2 T, \qquad \vb{x} \in \R^3, \qquad \int f(x)\,\dd x
$$

## コード

言語名を付けるとハイライトされます（右上に Copy ボタン）。

```python
import numpy as np

def lmtd(dt1: float, dt2: float) -> float:
    """対数平均温度差"""
    return (dt1 - dt2) / np.log(dt1 / dt2)
```

コード中の `$x$` や `\[` は数式として扱われません。

## 表

| 物質 | 熱伝導率 $k$ [W/(m·K)] |
| ---- | ---------------------: |
| 銅   | 398 |
| アルミ | 237 |
| 水   | 0.61 |

## 画像と記事間リンク

画像は Markdown ファイルからの **相対パス** で書けます（記事と同じフォルダに置けば管理が楽です）。

```markdown
![LHP の模式図](./img/lhp.svg)
```

他の記事へのリンクも `.md` ファイルへの相対パスで書けば、自動で記事ページへのリンクに変換されます。

- [LHP のメモ](../research/thermal/2026-07-26-lhp.md)
- [GitHub Pages に置く最小構成](../dev/2026-07-24-github-pages.md#デプロイ)

> 引用やメモにはブロッククォートが使えます。
