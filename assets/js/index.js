/* 記事一覧ページ：検索・カテゴリ（階層タブ）・タグ・ページネーション。状態は URL に保存される */
document.addEventListener('DOMContentLoaded', async () => {
  const PAGE_SIZE = 10;
  const { escapeHtml: esc, postUrl } = window.Site;
  const $ = (id) => document.getElementById(id);

  const els = {
    search: $('searchInput'),
    tabs: $('categoryTabs'),
    tagList: $('tagList'),
    list: $('postList'),
    count: $('resultCount'),
    title: $('listTitle'),
    filters: $('activeFilters'),
    pagination: $('pagination'),
  };

  const state = readState();
  let posts = [];

  try {
    posts = await window.Site.loadIndex();
  } catch (e) {
    console.error(e);
    els.list.innerHTML = `<li class="empty">記事一覧の読み込みに失敗しました。<br>${esc(e.message)}</li>`;
    return;
  }

  posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title, 'ja'));
  posts.forEach((p, i) => {
    p._hay = [p.title, p.summary, p.category, p.tags.join(' '), p.text].join(' ').toLowerCase();
    p._no = String(posts.length - i).padStart(2, '0'); // 古い順の通し番号
  });

  els.search.value = state.q;
  render();

  let typingTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      state.q = els.search.value;
      state.page = 1;
      update(true);
    }, 120);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      els.search.focus();
    }
  });

  window.addEventListener('popstate', () => {
    Object.assign(state, readState());
    els.search.value = state.q;
    render();
  });

  // ------------------------------------------------------------ state <-> URL
  function readState() {
    const sp = new URLSearchParams(location.search);
    return {
      q: sp.get('q') || '',
      tag: sp.get('tag') || '',
      cat: sp.get('cat') || '',
      page: Math.max(1, parseInt(sp.get('page') || '1', 10) || 1),
    };
  }

  function update(replace = false) {
    const sp = new URLSearchParams();
    const trialPalette = new URLSearchParams(location.search).get('palette');
    if (trialPalette) sp.set('palette', trialPalette);
    if (state.q) sp.set('q', state.q);
    if (state.cat) sp.set('cat', state.cat);
    if (state.tag) sp.set('tag', state.tag);
    if (state.page > 1) sp.set('page', state.page);
    const qs = sp.toString();
    history[replace ? 'replaceState' : 'pushState'](null, '', qs ? `?${qs}` : location.pathname);
    render();
  }

  function setFilter(patch) {
    Object.assign(state, patch, { page: 1 });
    update();
  }

  // ------------------------------------------------------------ render
  function render() {
    renderTabs();
    renderTags();
    renderPosts();
  }

  /** カテゴリの木を作る（count は子孫を含む） */
  function buildTree() {
    const root = { children: new Map() };
    for (const p of posts) {
      if (!p.category) continue;
      let node = root;
      let path = '';
      for (const part of p.category.split('/')) {
        path = path ? `${path}/${part}` : part;
        if (!node.children.has(part)) node.children.set(part, { name: part, path, count: 0, children: new Map() });
        node = node.children.get(part);
        node.count++;
      }
    }
    return root;
  }

  function renderTabs() {
    els.tabs.innerHTML = '';
    els.tabs.appendChild(tab('All', '', posts.length, 0));

    const walk = (node, depth) => {
      [...node.children.values()]
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
        .forEach((child) => {
          els.tabs.appendChild(tab(child.name, child.path, child.count, depth));
          walk(child, depth + 1);
        });
    };
    walk(buildTree(), 1);
  }

  function tab(label, path, count, depth) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    const active = path === state.cat && (path !== '' || (!state.tag && !state.q));
    btn.className = `tab${active ? ' active' : ''}${depth > 1 ? ' sub' : ''}`;
    btn.setAttribute('aria-pressed', String(active));
    btn.innerHTML = `${depth > 1 ? '└ ' : ''}${esc(label)} <span class="n">${count}</span>`;
    btn.addEventListener('click', () => (path === '' ? setFilter({ cat: '', tag: '', q: (els.search.value = '') }) : setFilter({ cat: path })));
    li.appendChild(btn);
    return li;
  }

  function renderTags() {
    const counts = new Map();
    posts.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));

    els.tagList.innerHTML = tags.length ? '' : '<span class="meta">タグはまだありません</span>';
    tags.forEach(([tag, n]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tag${state.tag === tag ? ' active' : ''}`;
      btn.setAttribute('aria-pressed', String(state.tag === tag));
      btn.innerHTML = `${esc(tag)} <small>${n}</small>`;
      btn.addEventListener('click', () => {
        setFilter({ tag: state.tag === tag ? '' : tag });
        $('posts').scrollIntoView({ behavior: 'smooth' });
      });
      els.tagList.appendChild(btn);
    });
  }

  function filteredPosts() {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return posts.filter((p) => {
      if (state.tag && !p.tags.includes(state.tag)) return false;
      if (state.cat && p.category !== state.cat && !p.category.startsWith(`${state.cat}/`)) return false;
      return terms.every((t) => p._hay.includes(t));
    });
  }

  function renderFilters() {
    const chips = [];
    if (state.cat) chips.push(['cat', state.cat]);
    if (state.tag) chips.push(['tag', `#${state.tag}`]);
    if (state.q) chips.push(['q', `“${state.q}”`]);

    els.title.textContent = state.tag ? `#${state.tag}` : state.cat || (state.q ? 'Search' : 'All');
    els.filters.innerHTML = '';
    chips.forEach(([key, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-chip';
      btn.title = 'このフィルタを解除';
      btn.innerHTML = `${esc(label)} <span aria-hidden="true">×</span>`;
      btn.addEventListener('click', () => {
        if (key === 'q') els.search.value = '';
        setFilter({ [key]: '' });
      });
      els.filters.appendChild(btn);
    });
  }

  function renderPosts() {
    renderFilters();
    const list = filteredPosts();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const items = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    els.count.textContent = `${list.length}件`;
    els.list.innerHTML = '';

    if (!items.length) {
      els.list.innerHTML = '<li class="empty">該当する記事がありません。</li>';
      renderPagination(0);
      return;
    }

    els.list.innerHTML = items
      .map(
        (p) => `
        <li class="row">
          <a class="row-link" href="${postUrl(p.slug)}">
            <span class="row-no">${p._no}</span>
            <span class="row-main">
              <span class="row-title">${esc(p.title)}${p.draft ? ' <span class="draft">[draft]</span>' : ''}</span>
              ${p.summary ? `<span class="row-summary">${esc(p.summary)}</span>` : ''}
              ${p.tags.length ? `<span class="row-tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</span>` : ''}
            </span>
            <span class="row-cat">${esc(p.category.split('/').join(' / '))}</span>
            <time class="row-date" datetime="${esc(p.date)}">${esc(p.date.replaceAll('-', '.'))}</time>
          </a>
        </li>`
      )
      .join('');

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const el = els.pagination;
    el.innerHTML = '';
    if (totalPages <= 1) return;

    const make = (label, page, disabled = false, active = false) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `page-btn${active ? ' active' : ''}`;
      btn.textContent = label;
      btn.disabled = disabled;
      if (active) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => {
        if (page === state.page) return;
        state.page = page;
        update();
        $('posts').scrollIntoView({ behavior: 'smooth' });
      });
      return btn;
    };

    el.appendChild(make('←', Math.max(1, state.page - 1), state.page === 1));
    buildPageList(totalPages, state.page).forEach((item) => {
      if (item === '...') {
        const span = document.createElement('span');
        span.className = 'page-ellipsis';
        span.textContent = '…';
        el.appendChild(span);
      } else {
        el.appendChild(make(String(item), item, false, item === state.page));
      }
    });
    el.appendChild(make('→', Math.min(totalPages, state.page + 1), state.page === totalPages));
  }

  function buildPageList(total, current) {
    const pages = [1];
    const left = Math.max(2, current - 2);
    const right = Math.min(total - 1, current + 2);
    if (left > 2) pages.push('...');
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < total - 1) pages.push('...');
    if (total > 1) pages.push(total);
    return pages;
  }
});
