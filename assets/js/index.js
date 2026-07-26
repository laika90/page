document.addEventListener('DOMContentLoaded', () => {
  const MANIFEST_URL = 'posts/manifest.json';

  const els = {
    treeList: document.getElementById('treeList'),
    searchInput: document.getElementById('searchInput'),
    postList: document.getElementById('postList'),
    resultCount: document.getElementById('resultCount'),
    currentDirTitle: document.getElementById('currentDirTitle'),
    currentDirPath: document.getElementById('currentDirPath'),
    themeBtn: document.getElementById('themeBtn'),
    year: document.getElementById('year'),
  };

  const state = {
    query: '',
    dir: 'all',
  };

  let posts = [];
  let dirs = ['all'];

  init().catch((error) => {
    console.error(error);
    els.postList.innerHTML = `
      <div class="card">
        記事一覧の読み込みに失敗しました。<br>
        <span class="meta">${escapeHtml(String(error?.message || error))}</span>
      </div>
    `;
  });

  async function init() {
    els.year.textContent = new Date().getFullYear();
    bindThemeToggle();
    bindSearch();

    posts = await loadManifest();
    dirs = ['all', ...new Set(posts.map((p) => p.dir || 'uncategorized'))].sort((a, b) =>
      a.localeCompare(b)
    );

    render();
  }

  async function loadManifest() {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`manifest fetch failed: ${response.status}`);
    }

    const data = await response.json();

    // いろいろな manifest 形式を吸収
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'string') {
        return data.map((path) => normalizePost({ path }));
      }
      return data.map(normalizePost).filter((p) => p.path);
    }

    if (Array.isArray(data.files)) {
      return data.files.map((path) => normalizePost({ path }));
    }

    if (Array.isArray(data.paths)) {
      return data.paths.map((path) => normalizePost({ path }));
    }

    return [];
  }

  function normalizePost(post) {
    const path = post.path || '';
    return {
      title: post.title || titleFromPath(path),
      date: post.date || '',
      summary: post.summary || '',
      path,
      dir: post.dir || pathDirectory(path),
    };
  }

  function render() {
    renderTree();
    renderPosts();
  }

  function renderTree() {
    const counts = Object.fromEntries(
      dirs.map((d) => [
        d,
        d === 'all' ? posts.length : posts.filter((p) => p.dir === d).length,
      ])
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

  function filteredPosts() {
    const q = state.query.trim().toLowerCase();

    return posts
      .filter((post) => {
        const byDir = state.dir === 'all' || post.dir === state.dir;
        const haystack = [post.title, post.summary, post.dir, post.path].join(' ').toLowerCase();
        const byQuery = !q || haystack.includes(q);
        return byDir && byQuery;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function renderPosts() {
    const list = filteredPosts();
    els.resultCount.textContent = `${list.length}件`;
    els.currentDirTitle.textContent = state.dir === 'all' ? 'All articles' : state.dir;
    els.currentDirPath.textContent = state.dir === 'all' ? '/' : `/${state.dir}/`;
    els.postList.innerHTML = '';

    if (!list.length) {
      els.postList.innerHTML = '<div class="card">該当する記事がありません。</div>';
      return;
    }

    list.forEach((post) => {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = `post.html?path=${encodeURIComponent(post.path)}`;
      card.innerHTML = `
        <div class="card-top">
          <span class="badge">${escapeHtml(post.dir)}</span>
          <span class="meta">${escapeHtml(post.date)}</span>
        </div>
        <h4>${escapeHtml(post.title)}</h4>
        <p class="excerpt">${escapeHtml(post.summary)}</p>
        <div class="tag-row">
          <span class="path">${escapeHtml(post.path)}</span>
        </div>
      `;
      els.postList.appendChild(card);
    });
  }

  function bindSearch() {
    els.searchInput.addEventListener('input', (e) => {
      state.query = e.target.value;
      renderPosts();
    });
  }

  function bindThemeToggle() {
    els.themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  }

  function pathDirectory(path) {
    const parts = String(path).split('/');
    parts.pop();
    return parts.join('/');
  }

  function titleFromPath(path) {
    const file = String(path).split('/').pop() || '';
    return file
      .replace(/\.md$/i, '')
      .replace(/^\d{4}-\d{2}-\d{2}-/, '')
      .replace(/[-_]+/g, ' ');
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
    displayMath: [['$$', '$$'], ['\\[', '\\]']]
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
  }
};
