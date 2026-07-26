document.addEventListener('DOMContentLoaded', () => {
  const articles = [
    {
      id: 'research-thermal-lhp',
      title: 'LaTeX を使う記事テンプレート',
      date: '2026-07-26',
      dir: 'posts/research/thermal',
      path: 'posts/research/thermal/2026-07-26-lhp.md',
      summary: '数式を含む研究メモのサンプル。',
      tags: ['LaTeX', 'MathJax'],
      content: `
        <p>インライン数式は <code>\\(a^2 + b^2 = c^2\\)</code> のように書けます。</p>
        <p>ディスプレイ数式は以下のように表示できます。</p>
        <div class="math-note">\\[\\frac{d}{dx}\\int_0^x f(t)\\,dt = f(x)\\]</div>
        <p>研究系の記事は <code>posts/research/</code> 配下に置く、というルールを決めると整理しやすくなります。</p>
      `
    },
    {
      id: 'research-thermal-cpl',
      title: 'GitHub Pages に置く最小構成',
      date: '2026-07-24',
      dir: 'posts/dev',
      path: 'posts/dev/2026-07-24-github-pages.md',
      summary: '静的ファイルだけで公開するための最小構成メモ。',
      tags: ['Deploy', 'Static'],
      content: `
        <p>まずは <code>index.html</code> と <code>posts/</code> だけで始められます。</p>
        <pre><code>repo/
├─ index.html
└─ posts/
   ├─ research/
   └─ dev/</code></pre>
        <p>この原型では、記事一覧は <code>path</code> を見てグループ化しています。</p>
      `
    },
    {
      id: 'diary-trip',
      title: '見た目を抑えたカード UI',
      date: '2026-07-20',
      dir: 'posts/diary',
      path: 'posts/diary/2026-07-20-trip.md',
      summary: '読みやすさを優先した、控えめなカードデザインの例。',
      tags: ['UI', 'Cards'],
      content: `
        <p>旅行記や日記のようなものは <code>posts/diary/</code> に置く、というふうに使い分けられます。</p>
        <blockquote>主役は装飾ではなく、記事そのもの。</blockquote>
        <p>フォルダが違えば見せ方も少し変える、という設計にしても分かりやすいです。</p>
      `
    },
    {
      id: 'research-mission-dsotv',
      title: 'Mission Notes の置き場所例',
      date: '2026-07-18',
      dir: 'posts/research/mission',
      path: 'posts/research/mission/2026-07-18-dsotv.md',
      summary: '研究テーマの下に、さらに小分類を切る例。',
      tags: ['Research', 'Mission'],
      content: `
        <p>たとえば <code>posts/research/mission/</code> のように、研究の中でもテーマ別に掘ることができます。</p>
        <p>フォルダで管理すると、記事一覧も「研究 → 熱設計」「研究 → ミッション」のように自然に見せられます。</p>
      `
    },
    {
        id: "thermal_example",
        title: "新しいポストの例",
        date: "2026-7-26",
        dir: "posts",
        path: "posts/thermal.md",
        summary: "新しいポストを実際に作成してみた",
        tags: ["example", "thermal"],
        content: `
            <p>ためしに</p>
            <p>新しい記事を</p>
            <p>書いてみた</p>
        `
    }
  ];

  const state = { query: '', dir: 'all', activeId: null };
  const dirs = ['all', ...new Set(articles.map(a => a.dir))].sort((a, b) => a.localeCompare(b));

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

  function dirLabel(dir) {
    if (dir === 'all') return 'All';
    const parts = dir.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }

  function renderTree() {
    const counts = Object.fromEntries(
      dirs.map(d => [d, d === 'all' ? articles.length : articles.filter(a => a.dir === d).length])
    );

    els.treeList.innerHTML = '';
    dirs.forEach(dir => {
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
      .filter(article => {
        const byDir = state.dir === 'all' || article.dir === state.dir;
        const haystack = [article.title, article.summary, article.dir, article.path, ...article.tags].join(' ').toLowerCase();
        const byQuery = !q || haystack.includes(q);
        return byDir && byQuery;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function openArticle(article) {
    state.activeId = article.id;
    els.articleTitle.textContent = article.title;
    els.articleMeta.textContent = `${article.date} • ${article.dir} • ${article.path}`;
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

    filtered.forEach(article => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-top">
          <span class="badge">${article.dir}</span>
          <span class="meta">${article.date}</span>
        </div>
        <h4>${article.title}</h4>
        <p class="excerpt">${article.summary}</p>
        <div class="tag-row">
          <span class="path">${article.path}</span>
          ${article.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
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
      const active = articles.find(a => a.id === state.activeId);
      if (active) openArticle(active);
    }
  }

  els.searchInput.addEventListener('input', (e) => {
    state.query = e.target.value;
    render();
  });

  els.themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  });

  els.year.textContent = new Date().getFullYear();
  render();
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

