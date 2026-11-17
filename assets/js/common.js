/* index.html / post.html 共通のユーティリティ */
(() => {
  const INDEX_URL = 'posts/index.json';

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const encodeSlug = (slug) => String(slug).split('/').map(encodeURIComponent).join('/');

  // ?palette=xxx で色を試しているときはリンク先にも引き継ぐ
  const trialPalette = new URLSearchParams(location.search).get('palette');
  const paletteQs = trialPalette ? `&palette=${encodeURIComponent(trialPalette)}` : '';

  const postUrl = (slug, hash = '') => `post.html?p=${encodeSlug(slug)}${paletteQs}${hash}`;

  const listUrl = (params = {}) => {
    const sp = new URLSearchParams();
    if (trialPalette) sp.set('palette', trialPalette);
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    const q = sp.toString();
    return q ? `index.html?${q}` : 'index.html';
  };

  let indexPromise = null;
  const loadIndex = () => {
    indexPromise ??= fetch(INDEX_URL, { cache: 'no-cache' }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`${INDEX_URL} の取得に失敗しました (${res.status})。python3 tools/build_index.py を実行してください。`);
      }
      const data = await res.json();
      const posts = Array.isArray(data) ? data : data.posts || [];
      return posts.map((p) => ({ category: '', tags: [], summary: '', text: '', ...p }));
    });
    return indexPromise;
  };

  const categoryCrumbs = (category) => {
    if (!category) return '';
    const parts = category.split('/');
    return parts
      .map((name, i) => {
        const path = parts.slice(0, i + 1).join('/');
        return `<a href="${listUrl({ cat: path })}">${escapeHtml(name)}</a>`;
      })
      .join('<span class="sep">/</span>');
  };

  function initChrome() {
    const title = window.SITE?.title;
    if (title) document.querySelectorAll('[data-site-title]').forEach((el) => (el.textContent = title));

    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    const btn = document.getElementById('themeBtn');
    btn?.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (_) { /* noop */ }
    });
  }

  document.addEventListener('DOMContentLoaded', initChrome);

  window.Site = { escapeHtml, encodeSlug, postUrl, listUrl, loadIndex, categoryCrumbs };
})();
