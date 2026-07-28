document.addEventListener('DOMContentLoaded', () => {
  const MANIFEST_URL = 'posts/manifest.json';

  const els = {
    treeList: document.getElementById('treeList'),
    searchInput: document.getElementById('searchInput'),
    postList: document.getElementById('postList'),
    resultCount: document.getElementById('resultCount'),
    currentTagTitle: document.getElementById('currentDirTitle'),
    currentTagPath: document.getElementById('currentDirPath'),
    themeBtn: document.getElementById('themeBtn'),
    year: document.getElementById('year'),
  };

  const PAGE_SIZE = 6;

  const state = {
    query: '',
    tag: 'all',
    page: 1,
  };

  let posts = [];
  let tags = ['all'];

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
    tags = ['all', ...new Set(posts.flatMap((p) => p.tags))].sort((a, b) =>
      a.localeCompare(b, 'ja')
    );

    render();
  }

  async function loadManifest() {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`manifest fetch failed: ${response.status}`);
    }

    const data = await response.json();

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
    const tags = normalizeTags(post.tags || post.tag || post.dir);

    return {
      title: post.title || titleFromPath(path),
      date: post.date || '',
      summary: post.summary || '',
      path,
      tags: tags.length ? tags : ['未分類'],
    };
  }

  function normalizeTags(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
    return String(value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function render() {
    renderTree();
    renderPosts();
  }

  function renderTree() {
    const counts = Object.fromEntries(
      tags.map((t) => [
        t,
        t === 'all' ? posts.length : posts.filter((p) => p.tags.includes(t)).length,
      ])
    );

    els.treeList.innerHTML = '';
    tags.forEach((tag) => {
      const li = document.createElement('li');
      li.className = `tree-item ${state.tag === tag ? 'active' : ''}`;
      li.innerHTML = `<span>${tag === 'all' ? 'All articles' : tag}</span><span class="count">${counts[tag]}</span>`;

      li.addEventListener('click', () => {
        state.tag = tag;
        state.page = 1;
        render();
      });

      els.treeList.appendChild(li);
    });
  }


  // function renderTree() {
  //   const counts = Object.fromEntries(
  //     tags.map((t) => [
  //       t,
  //       t === 'all' ? posts.length : posts.filter((p) => p.tags.includes(t)).length,
  //     ])
  //   );
  //
  //   els.treeList.innerHTML = '';
  //   tags.forEach((tag) => {
  //     const li = document.createElement('li');
  //     li.className = `tree-item ${state.tag === tag ? 'active' : ''}`;
  //     li.innerHTML = `<span>${tag === 'all' ? 'All articles' : tag}</span><span class="count">${counts[tag]}</span>`;
  //     li.addEventListener('click', () => {
  //       state.tag = tag;
  //       render();
  //     });
  //     els.treeList.appendChild(li);
  //   });
  // }

  function filteredPosts() {
    const q = state.query.trim().toLowerCase();

    return posts
      .filter((post) => {
        const byTag = state.tag === 'all' || post.tags.includes(state.tag);
        const haystack = [post.title, post.summary, post.tags.join(' '), post.path].join(' ').toLowerCase();
        const byQuery = !q || haystack.includes(q);
        return byTag && byQuery;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function renderPosts() {
    const list = filteredPosts();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    els.resultCount.textContent = `${list.length}件`;
    els.currentTagTitle.textContent = state.tag === 'all' ? 'All articles' : state.tag;
    els.currentTagPath.textContent = state.tag === 'all' ? 'tag: all' : `tag: ${state.tag}`;
    els.postList.innerHTML = '';

    if (!pageItems.length) {
      els.postList.innerHTML = '<div class="card">該当する記事がありません。</div>';
      renderPagination(0);
      return;
    }

    pageItems.forEach((post) => {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = `post.html?path=${encodeURIComponent(post.path)}`;
      card.innerHTML = `
        <div class="card-top">
          <div class="card-tags">
            ${post.tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('')}
          </div>
          <span class="meta card-date">${escapeHtml(post.date)}</span>
        </div>
        <h4>${escapeHtml(post.title)}</h4>
        <p class="excerpt">${escapeHtml(post.summary)}</p>
      `;
      els.postList.appendChild(card);
    });

    renderPagination(totalPages);
  }

  // function renderPosts() {
  //   const list = filteredPosts();
  //   els.resultCount.textContent = `${list.length}件`;
  //   els.currentTagTitle.textContent = state.tag === 'all' ? 'All articles' : state.tag;
  //   els.currentTagPath.textContent = state.tag === 'all' ? 'tag: all' : `tag: ${state.tag}`;
  //   els.postList.innerHTML = '';
  //
  //   if (!list.length) {
  //     els.postList.innerHTML = '<div class="card">該当する記事がありません。</div>';
  //     return;
  //   }
  //
  //   list.forEach((post) => {
  //     const card = document.createElement('a');
  //     card.className = 'card';
  //     card.href = `post.html?path=${encodeURIComponent(post.path)}`;
  //     card.innerHTML = `
  //       <div class="card-top">
  //         <div class="card-tags">
  //           ${post.tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('')}
  //         </div>
  //         <span class="meta card-date">${escapeHtml(post.date)}</span>
  //       </div>
  //       <h4>${escapeHtml(post.title)}</h4>
  //       <p class="excerpt">${escapeHtml(post.summary)}</p>
  //     `;
  //     els.postList.appendChild(card);
  //   });
  // }
  //

  function renderPagination(totalPages) {
    const paginationEl = document.getElementById('pagination');
    if (!paginationEl) return;

    paginationEl.innerHTML = '';
    if (totalPages <= 1) return;

    const createButton = (label, page, disabled = false, active = false) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `page-btn ${active ? 'active' : ''}`;
      btn.textContent = label;
      btn.disabled = disabled;
      btn.addEventListener('click', () => {
        if (page === state.page) return;
        state.page = page;
        renderPosts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return btn;
    };

    paginationEl.appendChild(
      createButton('Prev', Math.max(1, state.page - 1), state.page === 1)
    );

    const pages = buildPageList(totalPages, state.page);
    pages.forEach((item) => {
      if (item === '...') {
        const span = document.createElement('span');
        span.className = 'page-ellipsis';
        span.textContent = '...';
        paginationEl.appendChild(span);
      } else {
        paginationEl.appendChild(
          createButton(String(item), item, false, item === state.page)
        );
      }
    });

    paginationEl.appendChild(
      createButton('Next', Math.min(totalPages, state.page + 1), state.page === totalPages)
    );
  }

  function buildPageList(totalPages, currentPage) {
    const pages = [];
    const delta = 2;

    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);

    if (left > 2) pages.push('...');

    for (let p = left; p <= right; p++) {
      pages.push(p);
    }
 
    if (right < totalPages - 1) pages.push('...');

    if (totalPages > 1) pages.push(totalPages);

    return [...new Set(pages)];
  }

  function bindSearch() {
    els.searchInput.addEventListener('input', (e) => {
      state.query = e.target.value;
      state.page = 1;
      renderPosts();
    });
  }


  // function bindSearch() {
  //   els.searchInput.addEventListener('input', (e) => {
  //     state.query = e.target.value;
  //     renderPosts();
  //   });
  // }

  function bindThemeToggle() {
    els.themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
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
