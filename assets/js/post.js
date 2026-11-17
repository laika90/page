/* 記事ページ：Markdown + LaTeX のレンダリング、目次、前後記事、関連記事 */

/**
 * Markdown を HTML に変換する。数式部分は marked に触らせないよう退避してから戻す。
 * （\\ や _ や * が Markdown として解釈されて数式が壊れるのを防ぐ）
 */
function renderMarkdown(md) {
  const esc = window.Site.escapeHtml;
  const codes = [];
  const maths = [];
  const holdCode = (s) => `MJXCODE${codes.push(s) - 1}E`;
  const holdMath = (s) => `MJXMATH${maths.push(s) - 1}E`;

  let t = md;
  // 1) コードは数式より先に退避（コード中の $ や \[ を数式扱いしない）
  t = t.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm, holdCode);
  t = t.replace(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, holdCode);

  // 2) 数式を退避（ディスプレイ → 環境 → インライン の順）
  t = t.replace(/\$\$[\s\S]+?\$\$/g, holdMath);
  t = t.replace(/\\\[[\s\S]+?\\\]/g, holdMath);
  t = t.replace(/\\begin\{([a-zA-Z]+\*?)\}[\s\S]+?\\end\{\1\}/g, holdMath);
  t = t.replace(/\\\([\s\S]+?\\\)/g, holdMath);
  t = t.replace(/(^|[^\\$])(\$(?=\S)(?:\\\$|[^$\n])+?(?<=\S)\$)(?!\d)/g, (_, pre, m) => pre + holdMath(m));
  t = t.replace(/\\\$/g, holdMath); // 数式外の \$ は MathJax にそのまま渡して "$" と表示させる

  // 3) コードを戻して Markdown 変換
  t = t.replace(/MJXCODE(\d+)E/g, (_, i) => codes[i]);
  let html = window.marked?.parse
    ? window.marked.parse(t, { gfm: true })
    : `<pre>${esc(t)}</pre>`;

  // 4) 数式を戻す（HTML エスケープして MathJax にテキストとして渡す）
  html = html.replace(/MJXMATH(\d+)E/g, (_, i) => esc(maths[i]));
  return html;
}

function parseFrontMatter(text) {
  const src = text.replace(/^﻿/, '');
  const m = src.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };

  const meta = {};
  let key = null;
  const scalar = (v) => v.trim().replace(/^(['"])(.*)\1$/, '$2');
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(meta[key])) meta[key] = [];
      meta[key].push(scalar(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) meta[key] = v.slice(1, -1).split(',').map(scalar).filter(Boolean);
    else meta[key] = v === '' ? null : scalar(v);
  }
  return { meta, body: m[2] };
}

document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml: esc, postUrl, listUrl, categoryCrumbs } = window.Site;
  const $ = (id) => document.getElementById(id);
  const titleEl = $('articleTitle');
  const metaEl = $('articleMeta');
  const crumbEl = $('articleCategory');
  const tagsEl = $('articleTags');
  const bodyEl = $('articleBody');
  const tocWrap = $('tocWrap');
  const tocEl = $('toc');

  const slug = getSlug();
  if (!slug) return showError('記事が指定されていません', 'URL に <code>?p=カテゴリ/ファイル名</code> を指定してください。');

  const mdUrl = new URL(`posts/${window.Site.encodeSlug(slug)}.md`, document.baseURI);
  const [mdRes, index] = await Promise.all([
    fetch(mdUrl, { cache: 'no-cache' }).catch((e) => e),
    window.Site.loadIndex().catch(() => []),
  ]);

  if (!(mdRes instanceof Response) || !mdRes.ok) {
    return showError('記事が見つかりません', `<code>${esc(mdUrl.pathname)}</code> (${esc(mdRes.status ?? mdRes.message)})`);
  }

  const { meta: fm, body: rawBody } = parseFrontMatter(await mdRes.text());
  const entry = index.find((p) => p.slug === slug);
  const toList = (v) => (Array.isArray(v) ? v : v ? String(v).split(',') : []).map((s) => s.trim()).filter(Boolean);
  const meta = {
    title: entry?.title || fm.title || rawBody.match(/^#\s+(.+)$/m)?.[1] || slug.split('/').pop(),
    date: entry?.date || fm.date || '',
    updated: entry?.updated || fm.updated || '',
    tags: entry?.tags || toList(fm.tags ?? fm.tag),
    category: entry?.category ?? String(fm.category || fm.dir || slug.split('/').slice(0, -1).join('/')).replace(/^\/?posts\/?/, ''),
  };

  // 本文先頭の "# タイトル" がタイトルと同じなら重複表示しない
  const body = rawBody.replace(/^\s*#\s+(.+)\s*\n/, (all, h) => (h.trim() === meta.title ? '' : all));

  bodyEl.innerHTML = renderMarkdown(body);
  renderHeader(meta, bodyEl.textContent.replace(/\s+/g, '').length);
  rewriteLinks(bodyEl, mdUrl);
  decorate(bodyEl);
  buildToc(bodyEl);
  renderNeighbors(index, slug, meta);

  try {
    await window.mathjaxReady;
    await window.MathJax.typesetPromise([bodyEl, tocEl]);
  } catch (e) {
    console.error('MathJax error', e);
  }

  if (location.hash) {
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }

  // ---------------------------------------------------------------- helpers
  function getSlug() {
    const sp = new URLSearchParams(location.search);
    const p = sp.get('p');
    if (p) return p.replace(/^\/+|\/+$/g, '').replace(/\.md$/, '');
    // 旧形式 ?path=posts/xxx.md との互換
    const legacy = sp.get('path');
    return legacy ? legacy.replace(/^\/?posts\//, '').replace(/\.md$/, '') : '';
  }

  function showError(title, html) {
    document.title = title;
    titleEl.textContent = title;
    metaEl.innerHTML = '';
    bodyEl.innerHTML = `<p>${html}</p><p><a href="index.html">← 記事一覧へ</a></p>`;
  }

  function renderHeader(m, chars) {
    document.title = `${m.title} | ${window.SITE?.title || document.title}`;
    titleEl.textContent = m.title;
    crumbEl.innerHTML = m.category ? categoryCrumbs(m.category) : '';

    const minutes = Math.max(1, Math.round(chars / (window.SITE?.charsPerMinute || 500)));
    const fmt = (d) => esc(String(d).replaceAll('-', '.'));
    metaEl.innerHTML = [
      m.date && `<div><dt>Published</dt><dd><time datetime="${esc(m.date)}">${fmt(m.date)}</time></dd></div>`,
      m.updated && m.updated !== m.date && `<div><dt>Updated</dt><dd><time datetime="${esc(m.updated)}">${fmt(m.updated)}</time></dd></div>`,
      `<div><dt>Reading</dt><dd>約 ${minutes} 分</dd></div>`,
    ].filter(Boolean).join('');

    tagsEl.innerHTML = m.tags.map((t) => `<a class="tag" href="${listUrl({ tag: t })}">${esc(t)}</a>`).join('');
    $('tagsBlock').hidden = !m.tags.length;
  }

  /** 相対パスの画像・リンクを .md ファイルの位置基準に解決する。他記事の .md へのリンクは記事ページに変換 */
  function rewriteLinks(root, base) {
    const isAbs = (u) => /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(u);
    const postsBase = new URL('posts/', document.baseURI).pathname;

    root.querySelectorAll('img[src]').forEach((img) => {
      const s = img.getAttribute('src');
      if (!isAbs(s)) img.src = new URL(s, base).href;
      img.loading = 'lazy';
    });

    root.querySelectorAll('a[href]').forEach((a) => {
      const h = a.getAttribute('href');
      if (isAbs(h)) {
        if (/^https?:/i.test(h) && new URL(h).origin !== location.origin) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
        return;
      }
      const u = new URL(h, base);
      if (u.pathname.startsWith(postsBase) && u.pathname.endsWith('.md')) {
        a.href = postUrl(decodeURIComponent(u.pathname.slice(postsBase.length, -3)), u.hash);
      } else {
        a.href = u.href;
      }
    });
  }

  function decorate(root) {
    // 表は横スクロールできるようにラップ
    root.querySelectorAll('table').forEach((tbl) => {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      tbl.replaceWith(wrap);
      wrap.appendChild(tbl);
    });

    // コードハイライト + コピーボタン
    root.querySelectorAll('pre > code').forEach((code) => {
      if (window.hljs) window.hljs.highlightElement(code);
      const pre = code.parentElement;
      const lang = [...code.classList].find((c) => c.startsWith('language-'))?.slice(9);
      if (lang) pre.dataset.lang = lang;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.innerText);
          btn.textContent = 'Copied!';
        } catch (_) {
          btn.textContent = 'Failed';
        }
        setTimeout(() => (btn.textContent = 'Copy'), 1500);
      });
      pre.appendChild(btn);
    });
  }

  function buildToc(root) {
    const heads = [...root.querySelectorAll('h2, h3')];
    const used = new Set();
    heads.forEach((h) => {
      let id = h.id || h.textContent.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '') || 'section';
      let n = id;
      for (let i = 2; used.has(n) || (document.getElementById(n) && document.getElementById(n) !== h); i++) n = `${id}-${i}`;
      used.add(n);
      h.id = n;
    });

    if (heads.length < 2) return;

    const numbered = document.documentElement.classList.contains('number-headings');
    let n2 = 0;
    tocEl.innerHTML = `<ol>${heads
      .map((h) => {
        const isH2 = h.tagName === 'H2';
        if (isH2) n2++;
        const num = numbered && isH2 ? `<span class="num">${String(n2).padStart(2, '0')}</span>` : '';
        return `<li class="toc-${h.tagName.toLowerCase()}"><a href="#${encodeURIComponent(h.id)}">${num}<span>${h.innerHTML}</span></a></li>`;
      })
      .join('')}</ol>`;
    tocWrap.hidden = false;

    heads.forEach((h) => {
      const a = document.createElement('a');
      a.className = 'anchor';
      a.href = `#${encodeURIComponent(h.id)}`;
      a.setAttribute('aria-label', 'この見出しへのリンク');
      a.textContent = '#';
      h.appendChild(a);
    });

    // スクロール位置に応じて目次をハイライト
    const links = new Map([...tocEl.querySelectorAll('a')].map((a, i) => [heads[i], a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          tocEl.querySelectorAll('a.active').forEach((a) => a.classList.remove('active'));
          links.get(e.target)?.classList.add('active');
        });
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    heads.forEach((h) => io.observe(h));
  }

  function renderNeighbors(all, current, m) {
    const i = all.findIndex((p) => p.slug === current);

    const related = all
      .filter((p) => p.slug !== current)
      .map((p) => ({
        p,
        score: p.tags.filter((t) => m.tags.includes(t)).length * 2 + (m.category && p.category === m.category ? 1 : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.p.date || '').localeCompare(a.p.date || ''))
      .slice(0, 5);

    if (related.length) {
      $('related').innerHTML = `<h2>Related</h2><ul>${related
        .map(({ p }) => `<li><a href="${postUrl(p.slug)}">${esc(p.title)}</a><span class="date">${esc(p.date.replaceAll('-', '.'))}</span></li>`)
        .join('')}</ul>`;
      $('related').hidden = false;
    }

    if (i < 0) return;
    const newer = all[i - 1];
    const older = all[i + 1];
    const link = (p, label, cls) =>
      p ? `<a class="pager-link ${cls}" href="${postUrl(p.slug)}"><span class="label">${label}</span>${esc(p.title)}</a>` : '';
    $('pager').innerHTML = link(older, '← Previous', 'prev') + link(newer, 'Next →', 'next');
    $('pager').hidden = !older && !newer;
  }
});
