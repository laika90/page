document.addEventListener('DOMContentLoaded', async () => {
  const articleView = document.getElementById('articleView');
  const titleEl = document.getElementById('articleTitle');
  const metaEl = document.getElementById('articleMeta');
  const bodyEl = document.getElementById('articleBody');
  const themeBtn = document.getElementById('themeBtn');
  const yearEl = document.getElementById('year');

  yearEl.textContent = new Date().getFullYear();

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    });
  }

  const params = new URLSearchParams(location.search);
  const path = params.get('path');

  if (!path) {
    bodyEl.innerHTML = '<p>記事が指定されていません。</p>';
    return;
  }

  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`failed to fetch ${path} (${res.status})`);
    const raw = await res.text();

    const { meta, body } = parseFrontMatter(raw);
    document.title = meta.title || 'Post';

    titleEl.textContent = meta.title || path;
    metaEl.textContent = `${meta.date || ''} • ${meta.dir || ''}`.trim();

    bodyEl.innerHTML = marked.parse(body);

    if (window.MathJax?.typesetPromise) {
      await MathJax.typesetPromise([articleView]);
    }
  } catch (error) {
    console.error(error);
    bodyEl.innerHTML = `<p>記事の読み込みに失敗しました。</p><pre>${escapeHtml(String(error?.message || error))}</pre>`;
  }

  function parseFrontMatter(text) {
    const m = text.replace(/^\uFEFF/, '').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: text };

    const meta = {};
    for (const line of m[1].split(/\r?\n/)) {
      const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!pair) continue;
      const key = pair[1];
      let value = pair[2].trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else {
        value = value.replace(/^['"]|['"]$/g, '');
      }
      meta[key] = value;
    }

    return { meta, body: m[2] };
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});

window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
  },
};
