document.addEventListener('DOMContentLoaded', () => {
  const MANIFEST_URL = 'posts/manifest.json';
  const FALLBACK_PATHS = [
    "posts/thermal.md"
  ];

  const state = { query: '', dir: 'all', activeId: null };
  const els = {
    treeList: document.getElementById('treeList'),
    searchInput: document.getElementById('searchInput'),
    postList: document.getElementById('postList'),
    resultCount: document.getElementById('resultCount'),
    currentDirTitle: document.getElementById('currentDirTitle'),
    currentDirPath: document.getElementById('currentDirPath'),
    articleTitle: document.getElementById('articleTitle'),
    articleMeta: document.getElementById('articleMeta'),
    articleBody: document.getElementById('articleBody'),
    articleView: document.getElementById('articleView'),
    themeBtn: document.getElementById('themeBtn'),
    year: document.getElementById('year')
  };

  let articles = [];
  let dirs = ['all'];

  init().catch((error) => {
    console.error(error);
    els.postList.innerHTML = `<div class="card">記事の読み込みに失敗しました。<br><span class="meta">${escapeHtml(String(error?.message || error))}</span></div>`;
  });

  async function init() {
    els.year.textContent = new Date().getFullYear();
    bindThemeToggle();
    bindSearch();

    articles = await loadArticles();
    dirs = ['all', ...new Set(articles.map((a) => a.dir))].sort((a, b) => a.localeCompare(b));

    render();
    if (articles[0]) {
      openArticle(articles[0]);
    }
  }

  async function loadArticles() {
    const paths = await loadManifestPaths();
    const loaded = await Promise.all(paths.map(loadArticleFromMarkdown));
    return loaded
      .filter(Boolean)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  async function loadManifestPaths() {
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`manifest fetch failed: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.files)) return data.files;
      if (Array.isArray(data.paths)) return data.paths;
    } catch (error) {
      console.warn('Using fallback markdown paths because manifest could not be loaded:', error);
    }
    return FALLBACK_PATHS;
  }

  async function loadArticleFromMarkdown(path) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`failed to fetch ${path} (${response.status})`);
      const raw = await response.text();
      const { meta, body } = parseFrontMatter(raw);

      const article = {
        id: meta.id || slugFromPath(path),
        title: meta.title || titleFromPath(path),
        date: meta.date || '',
        dir: meta.dir || pathDirectory(path),
        path,
        summary: meta.summary || extractSummary(body),
        tags: normalizeTags(meta.tags),
        content: renderMarkdown(body)
      };
      return article;
    } catch (error) {
      console.warn(`Skipping article: ${path}`, error);
      return null;
    }
  }

  function parseFrontMatter(text) {
    const trimmed = text.replace(/^\uFEFF/, '');
    const match = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!match) {
      return { meta: {}, body: trimmed };
    }
    return { meta: parseMetaBlock(match[1]), body: match[2] };
  }

  function parseMetaBlock(block) {
    const meta = {};
    let currentKey = null;

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (!line.trim()) continue;

      const arrayItem = line.match(/^\s*-\s*(.+)$/);
      if (arrayItem && currentKey && Array.isArray(meta[currentKey])) {
        meta[currentKey].push(unquote(arrayItem[1].trim()));
        continue;
      }

      const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (pair) {
        const key = pair[1];
        const value = pair[2].trim();
        currentKey = key;

        if (!value) {
          meta[key] = [];
          continue;
        }

        if (value.startsWith('[') && value.endsWith(']')) {
          meta[key] = value
            .slice(1, -1)
            .split(',')
            .map((item) => unquote(item.trim()))
            .filter(Boolean);
          continue;
        }

        meta[key] = unquote(value);
        continue;
      }
    }

    return meta;
  }

  function renderMarkdown(markdown) {
    if (window.marked?.parse) {
      return window.marked.parse(markdown);
    }
    // Minimal fallback in case marked.js is not loaded.
    return escapeHtml(markdown)
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>')
      .replace(/<p>```([\s\S]*?)```<\/p>/g, '<pre><code>$1</code></pre>');
  }

  function extractSummary(body) {
    const plain = body
      .replace(/^---[\s\S]*?---\s*/m, '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.slice(0, 90);
  }

  function normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
    return String(tags)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function pathDirectory(path) {
    return path.split('/').slice(0, -1).join('/');
  }

  function titleFromPath(path) {
    const filename = path.split('/').pop() || path;
    return filename.replace(/\.md$/i, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/[-_]+/g, ' ');
  }

  function slugFromPath(path) {
    return path
      .replace(/^posts\//, '')
      .replace(/\.md$/i, '')
      .replace(/\//g, '-');
  }

  function unquote(value) {
    return value.replace(/^['"]|['"]$/g, '');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dirLabel(dir) {
    if (dir === 'all') return 'All';
    const parts = dir.split('/').filter(Boolean);
    return parts[parts.length - 1] || dir;
  }

  function renderTree() {
    const counts = Object.fromEntries(
      dirs.map((d) => [d, d === 'all' ? articles.length : articles.filter((a) => a.dir === d).length])
    );

    els.treeList.innerHTML = '';
    dirs.forEach((dir) => {
      const li = document.createElement('li');
      li.className = `tree-item ${state.dir === dir ? 'active' : ''}`;
      li.innerHTML = `<span>${dir === 'all' ? 'All articles' : dir}</span><span class="count">${counts[dir]}</span>`;
      li.addEventListener('click', () => {
        state.dir = dir;
        render();
      });
      els.treeList.appendChild(li);
    });
  }

  function filteredArticles() {
    const q = state.query.trim().toLowerCase();
    return articles
      .filter((article) => {
        const byDir = state.dir === 'all' || article.dir === state.dir;
        const haystack = [article.title, article.summary, article.dir, article.path, ...article.tags].join(' ').toLowerCase();
        const byQuery = !q || haystack.includes(q);
        return byDir && byQuery;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function openArticle(article) {
    state.activeId = article.id;
    els.articleTitle.textContent = article.title;
    els.articleMeta.textContent = `${article.date || '-'} • ${article.dir} • ${article.path}`;
    els.articleBody.innerHTML = article.content;
    els.articleView.classList.add('active');

    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([els.articleBody]);
    }

    els.articleView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderPosts() {
    const filtered = filteredArticles();
    els.resultCount.textContent = `${filtered.length}件`;
    els.currentDirTitle.textContent = state.dir === 'all' ? 'All articles' : dirLabel(state.dir);
    els.currentDirPath.textContent = state.dir === 'all' ? '/' : `/${state.dir}/`;
    els.postList.innerHTML = '';

    if (!filtered.length) {
      els.postList.innerHTML = '<div class="card">該当する記事がありません。</div>';
      return;
    }

    filtered.forEach((article) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-top">
          <span class="badge">${escapeHtml(article.dir)}</span>
          <span class="meta">${escapeHtml(article.date || '')}</span>
        </div>
        <h4>${escapeHtml(article.title)}</h4>
        <p class="excerpt">${escapeHtml(article.summary)}</p>
        <div class="tag-row">
          <span class="path">${escapeHtml(article.path)}</span>
          ${article.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      `;
      card.addEventListener('click', () => openArticle(article));
      els.postList.appendChild(card);
    });
  }

  function render() {
    renderTree();
    renderPosts();

    if (state.activeId) {
      const active = articles.find((a) => a.id === state.activeId);
      if (active) openArticle(active);
    }
  }

  function bindSearch() {
    els.searchInput.addEventListener('input', (e) => {
      state.query = e.target.value;
      render();
    });
  }

  function bindThemeToggle() {
    els.themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    });
  }
});

window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']]
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
  }
};

