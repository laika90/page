document.addEventListener('DOMContentLoaded', async () => {
  const articleEl = document.getElementById('articleView');
  const titleEl = document.getElementById('articleTitle');
  const metaEl = document.getElementById('articleMeta');
  const bodyEl = document.getElementById('articleBody');
  const themeBtn = document.getElementById('themeBtn');
  const yearEl = document.getElementById('year');

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([articleEl]);
      }
    });
  }

  const params = new URLSearchParams(location.search);
  const path = params.get('path');

  if (!path) {
    if (titleEl) titleEl.textContent = '記事が指定されていません';
    if (metaEl) metaEl.textContent = '';
    if (bodyEl) bodyEl.innerHTML = '<p>URL に <code>?path=...</code> がありません。</p>';
    return;
  }

  const resolvedUrl = new URL(path, document.baseURI).href;

  try {
    const res = await fetch(resolvedUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`failed to fetch ${resolvedUrl} (${res.status})`);
    }

    const raw = await res.text();
    const { meta, body } = parseFrontMatter(raw);

    document.title = meta.title || 'Post';
    if (titleEl) titleEl.textContent = meta.title || path;
    if (metaEl) metaEl.textContent = [meta.date, meta.dir].filter(Boolean).join(' • ');

    const protectedResult = protectMathDelimiters(body);
    const html = window.marked?.parse
      ? window.marked.parse(protectedResult.text)
      : `<pre>${escapeHtml(protectedResult.text)}</pre>`;

    if (bodyEl) {
      bodyEl.innerHTML = html;
      restoreMathDelimiters(bodyEl, protectedResult.tokens);
    }

    if (window.MathJax?.typesetPromise) {
      await window.MathJax.typesetPromise([articleEl]);
    }
  } catch (error) {
    console.error(error);
    if (titleEl) titleEl.textContent = '記事の読み込みに失敗しました';
    if (metaEl) metaEl.textContent = resolvedUrl;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <p>Markdown の取得に失敗しました。</p>
        <pre>${escapeHtml(String(error?.message || error))}</pre>
      `;
    }
  }

  function parseFrontMatter(text) {
    const trimmed = text.replace(/^\uFEFF/, '');
    const match = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

    if (!match) {
      return { meta: {}, body: trimmed };
    }

    const meta = {};
    const block = match[1];

    for (const line of block.split(/\r?\n/)) {
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

    return { meta, body: match[2] };
  }

  function protectMathDelimiters(md) {
    const tokens = [];
    let text = md;

    const pushToken = (placeholder, math) => {
      tokens.push({ placeholder, math });
      return placeholder;
    };

    // display math: \[ ... \]
    text = text.replace(/\\\[((?:.|\n)*?)\\\]/g, (_, math) => {
      const placeholder = `@@MATH_BLOCK_${tokens.length}@@`;
      return pushToken(placeholder, `\\[${math}\\]`);
    });

    // display math: $$ ... $$
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      const placeholder = `@@MATH_DOLLAR_${tokens.length}@@`;
      return pushToken(placeholder, `$$${math}$$`);
    });

    // inline math: \( ... \)
    text = text.replace(/\\\(((?:.|\n)*?)\\\)/g, (_, math) => {
      const placeholder = `@@MATH_INLINE_${tokens.length}@@`;
      return pushToken(placeholder, `\\(${math}\\)`);
    });

    return { text, tokens };
  }

  function restoreMathDelimiters(root, tokens) {
    let html = root.innerHTML;
    for (const item of tokens) {
      html = html.replaceAll(item.placeholder, item.math);
    }
    root.innerHTML = html;
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
