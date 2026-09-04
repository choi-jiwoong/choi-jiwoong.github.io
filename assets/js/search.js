(function () {
  const overlay = document.querySelector('.search-overlay');
  const openButtons = Array.from(document.querySelectorAll('.search-open'));
  const closeButton = document.querySelector('.search-close');
  const input = document.querySelector('.search-input');
  const results = document.querySelector('.search-results');
  const count = document.querySelector('.search-count');
  const tags = document.querySelector('.search-tags');

  if (!overlay || !openButtons.length || !input || !results || !count || !tags) return;

  let posts = [];
  let activeTag = '';
  let loaded = false;

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('ko-KR').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function loadPosts() {
    if (loaded) return;
    const response = await fetch('/search.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('search index load failed');
    posts = await response.json();
    loaded = true;
    renderTags();
  }

  function scorePost(post, query) {
    if (!query) return 1;

    const title = normalize(post.title);
    const description = normalize(post.description);
    const categories = normalize((post.categories || []).join(' '));
    const tagText = normalize((post.tags || []).join(' '));
    const content = normalize(post.content);

    let score = 0;
    if (title.includes(query)) score += 12;
    if (tagText.includes(query)) score += 8;
    if (categories.includes(query)) score += 6;
    if (description.includes(query)) score += 4;
    if (content.includes(query)) score += 2;
    return score;
  }

  function renderTags() {
    const tagSet = new Set();
    posts.forEach(function (post) {
      (post.tags || []).forEach(function (tag) { tagSet.add(tag); });
      (post.categories || []).forEach(function (category) { tagSet.add(category); });
    });

    const sorted = Array.from(tagSet).sort(function (a, b) {
      return a.localeCompare(b, 'ko-KR');
    });

    tags.innerHTML = '<button class="search-tag is-active" type="button" data-tag="">전체</button>' +
      sorted.map(function (tag) {
        return '<button class="search-tag" type="button" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</button>';
      }).join('');

    tags.querySelectorAll('.search-tag').forEach(function (button) {
      button.addEventListener('click', function () {
        activeTag = button.dataset.tag || '';
        tags.querySelectorAll('.search-tag').forEach(function (item) {
          item.classList.toggle('is-active', item === button);
        });
        renderResults();
      });
    });
  }

  function renderResults() {
    const query = normalize(input.value);
    let matches = posts
      .map(function (post) {
        return { post: post, score: scorePost(post, query) };
      })
      .filter(function (item) {
        if (item.score <= 0) return false;
        if (!activeTag) return true;
        const values = (item.post.tags || []).concat(item.post.categories || []);
        return values.includes(activeTag);
      });

    if (query) {
      matches.sort(function (a, b) { return b.score - a.score; });
    }

    matches = matches.slice(0, 20);
    count.textContent = matches.length + ' posts';

    if (!matches.length) {
      results.innerHTML = '<div class="search-empty"><strong>검색 결과가 없습니다.</strong><span>다른 키워드나 태그를 검색해보세요.</span></div>';
      return;
    }

    results.innerHTML = matches.map(function (item) {
      const post = item.post;
      const meta = [];
      if (post.categories && post.categories.length) meta.push(post.categories.join(', '));
      if (post.tags && post.tags.length) meta.push(post.tags.slice(0, 4).join(' · '));
      return '<a class="search-result" href="' + escapeHtml(post.url) + '">' +
        '<div class="search-result-top"><span>' + escapeHtml(post.date) + '</span><span>↗</span></div>' +
        '<h3>' + escapeHtml(post.title) + '</h3>' +
        '<p>' + escapeHtml(post.description || '') + '</p>' +
        '<div class="search-result-meta">' + escapeHtml(meta.join(' · ')) + '</div>' +
      '</a>';
    }).join('');
  }

  async function openSearch() {
    overlay.hidden = false;
    document.body.classList.add('search-opened');
    try {
      await loadPosts();
      renderResults();
    } catch (error) {
      results.innerHTML = '<div class="search-empty"><strong>검색 데이터를 불러오지 못했습니다.</strong><span>잠시 후 다시 시도해주세요.</span></div>';
    }
    window.setTimeout(function () { input.focus(); }, 20);
  }

  function closeSearch() {
    overlay.hidden = true;
    document.body.classList.remove('search-opened');
  }

  openButtons.forEach(function (button) {
    button.addEventListener('click', openSearch);
  });
  if (closeButton) closeButton.addEventListener('click', closeSearch);
  input.addEventListener('input', renderResults);

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeSearch();
  });

  document.addEventListener('keydown', function (event) {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      if (overlay.hidden) openSearch(); else closeSearch();
      return;
    }
    if (event.key === '/' && overlay.hidden && !/input|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === 'Escape' && !overlay.hidden) closeSearch();
  });
})();
