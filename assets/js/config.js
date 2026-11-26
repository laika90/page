/*
 * サイト設定（<head> で同期的に読み込む）
 *  - SITE: サイト名・パレットなど
 *  - テーマ（ダーク/ライト）のちらつき防止
 *  - MathJax の設定（独自マクロはここに追加）
 */
window.SITE = {
  title: 'Keishiro Sakamoto',
  // 差し色: 'blue' | 'red' | 'green' | 'orange' | 'purple' | 'mono'（theme.css に追加した独自名も可）
  palette: 'purple',
  // 初期テーマ: 'system'（OS に合わせる） | 'light' | 'dark'
  defaultTheme: 'system',
  // 記事の h2 見出しに 01, 02 … と番号を振る
  numberHeadings: true,
  // 読了時間の目安（1分あたりの文字数）
  charsPerMinute: 500,
};

(function () {
  const root = document.documentElement;
  const S = window.SITE;

  // パレット（?palette=red で一時的に試せる）
  const trial = new URLSearchParams(location.search).get('palette');
  root.dataset.palette = trial || S.palette || 'blue';
  if (S.numberHeadings) root.classList.add('number-headings');

  // テーマ
  let theme = S.defaultTheme;
  try { theme = localStorage.getItem('theme') || theme; } catch (_) { /* noop */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.dataset.theme = theme;

  // MathJax
  let resolveReady;
  window.mathjaxReady = new Promise((r) => (resolveReady = r));

  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true, // \begin{align} ... \end{align} を直接書ける
      tags: 'ams',               // \label / \eqref による式番号
      macros: {
        // よく使うマクロをここに登録できます
        R: '\\mathbb{R}',
        dd: '\\mathrm{d}',
        vb: ['\\boldsymbol{#1}', 1],
        pdv: ['\\frac{\\partial #1}{\\partial #2}', 2],
      },
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    },
    startup: {
      typeset: false, // 記事の描画後に手動で typeset する
      ready() {
        window.MathJax.startup.defaultReady();
        window.MathJax.startup.promise.then(resolveReady);
      },
    },
  };
})();
