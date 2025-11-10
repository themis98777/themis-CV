(function(){
  const GRID_SELECTOR = '.media-grid';
  const FILTERS_SELECTOR = '#filters';
  const SEARCH_SELECTOR = '#gallery-search';
  const DATA_URL = 'assets/data/media.json';

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function renderImage(item) {
    const img = el('img', {
      class: 'media-card__thumb',
      src: item.src,
      alt: item.alt || '',
      loading: 'lazy',
      width: item.width || undefined,
      height: item.height || undefined,
    });
    // Figure element is created below; wire click after fig exists
    const controls = [];
    if (item.detail) controls.push(makeViewStory(item));
    const caption = el('figcaption', { class: 'media-card__caption' }, item.caption || '', ...controls);
    const fig = el('figure', { class: 'media-card reveal', role: 'group', 'aria-label': item.caption || item.alt || 'Image' }, img, item.caption || item.detail ? caption : null);
    // Dataset for lightbox navigation and filtering/search
    fig.dataset.type = 'image';
    fig.dataset.src = item.src;
    fig.dataset.alt = item.alt || '';
    fig.dataset.caption = item.caption || '';
    fig.dataset.poster = '';
    // Open lightbox with origin figure reference
    img.addEventListener('click', () => openLightbox({ type: 'image', src: item.src, alt: item.alt, caption: item.caption, originFig: fig }));
    setCategories(fig, item.categories);
    setSearchData(fig, item);
    return fig;
  }

  function renderVideo(item) {
    const video = el('video', {
      class: 'media-card__thumb',
      controls: item.controls !== false,
      preload: 'metadata',
      playsInline: item.playsinline !== false,
      muted: !!item.muted,
      loop: !!item.loop,
      poster: item.poster || undefined,
    });
    const source = el('source', { src: item.src, type: 'video/mp4' });
    video.appendChild(source);
    video.addEventListener('click', (e) => {
      // Open in lightbox only when not interacting with controls
      if (e.target !== video) return;
      openLightbox({ type: 'video', src: item.src, caption: item.caption, poster: item.poster, originFig: fig });
    });
    // Hover preview (muted loop on hover)
    video.addEventListener('mouseenter', () => {
      try {
        video.muted = true;
        video.loop = true;
        video.play().catch(() => {});
      } catch {}
    });
    video.addEventListener('mouseleave', () => {
      try { video.pause(); } catch {}
    });
    const controls = [];
    if (item.detail) controls.push(makeViewStory(item));
    const caption = el('figcaption', { class: 'media-card__caption' }, item.caption || '', ...controls);
    const fig = el('figure', { class: 'media-card reveal', role: 'group', 'aria-label': item.caption || 'Video' }, video, item.caption || item.detail ? caption : null);
    // Dataset for lightbox navigation
    fig.dataset.type = 'video';
    fig.dataset.src = item.src;
    fig.dataset.alt = '';
    fig.dataset.caption = item.caption || '';
    fig.dataset.poster = item.poster || '';
    setCategories(fig, item.categories);
    setSearchData(fig, item);
    return fig;
  }

  function renderPlaceholder(text) {
    return el('figure', { class: 'media-card' }, el('div', { class: 'placeholder' }, text));
  }

  function setCategories(fig, categories) {
    if (!Array.isArray(categories) || categories.length === 0) return;
    fig.dataset.categories = categories.join(',');
  }

  function setSearchData(fig, item) {
    const title = item.detail?.title || '';
    const fields = [item.caption, item.alt, title].filter(Boolean).join(' ').toLowerCase();
    fig.dataset.search = fields;
  }

  function makeViewStory(item) {
    const btn = el('button', { class: 'view-story-btn', type: 'button' }, 'View story');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCaseStudy(item);
    });
    return btn;
  }

  function buildFilters(items) {
    const container = document.querySelector(FILTERS_SELECTOR);
    if (!container) return () => {};
    const setCats = new Set();
    items.forEach(it => Array.isArray(it.categories) && it.categories.forEach(c => setCats.add(c)));
    const cats = Array.from(setCats).sort();
    container.innerHTML = '';
    if (cats.length === 0) return () => {};

    const selected = new Set();
    const allBtn = makeFilterBtn('All', '*', false);
    container.appendChild(allBtn);
    cats.forEach(c => container.appendChild(makeFilterBtn(c, c, false)));

    function toggle(value) {
      if (value === '*') {
        selected.clear();
      } else {
        if (selected.has(value)) selected.delete(value); else selected.add(value);
      }
      // Update pressed states
      container.querySelectorAll('.filter-btn').forEach(btn => {
        const v = btn.dataset.value;
        if (v === '*') btn.setAttribute('aria-pressed', selected.size === 0 ? 'true' : 'false');
        else btn.setAttribute('aria-pressed', selected.has(v) ? 'true' : 'false');
      });
      applyFilters();
    }
    function makeFilterBtn(label, value, pressed=false) {
      const btn = el('button', { class: 'filter-btn', type: 'button', 'aria-pressed': pressed ? 'true' : 'false' });
      btn.textContent = label;
      btn.dataset.value = value;
      btn.addEventListener('click', () => toggle(value));
      return btn;
    }
    // Initialize All as pressed
    toggle('*');

    return {
      getSelected: () => new Set(selected),
      clear: () => toggle('*')
    };
  }

  // Combined filtering with search
  function applyFilters() {
    const grid = document.querySelector(GRID_SELECTOR);
    if (!grid) return;
    const cards = grid.querySelectorAll('.media-card');
    const state = window.__galleryState || { selected: new Set(), search: '' };
    const selected = state.selected;
    const search = (state.search || '').trim().toLowerCase();

    let visibleCount = 0;
    cards.forEach(card => {
      // Category match: union logic
      const cats = (card.dataset.categories || '').split(',').map(s => s.trim()).filter(Boolean);
      const catMatch = selected.size === 0 || cats.some(c => selected.has(c));
      // Search match
      const text = (card.dataset.search || '');
      const searchMatch = search === '' || text.includes(search);
      const show = catMatch && searchMatch;
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    updateGalleryCount(visibleCount);
  }

  function updateGalleryCount(count) {
    const elCount = document.getElementById('gallery-count');
    if (!elCount) return;
    elCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  }

  // Lightbox
  let lightbox, lightboxBody, lightboxCaption, lightboxPrevBtn, lightboxNextBtn;
  let lightboxItems = [];
  let lightboxIndex = -1;
  function ensureLightboxRefs() {
    if (!lightbox) {
      lightbox = document.getElementById('lightbox');
      lightboxBody = document.getElementById('lightbox-body');
      lightboxCaption = document.getElementById('lightbox-caption');
      lightboxPrevBtn = document.getElementById('lightbox-prev');
      lightboxNextBtn = document.getElementById('lightbox-next');
      if (lightbox) {
        lightbox.addEventListener('click', (e) => {
          if (e.target.hasAttribute('data-close')) closeLightbox();
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !lightbox.hasAttribute('hidden')) closeLightbox();
          if (!lightbox.hasAttribute('hidden')) {
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
          }
        });
        if (lightboxPrevBtn) lightboxPrevBtn.addEventListener('click', () => navigateLightbox(-1));
        if (lightboxNextBtn) lightboxNextBtn.addEventListener('click', () => navigateLightbox(1));
      }
    }
  }
  function openLightbox({ type, src, alt = '', caption = '', poster, originFig }) {
    ensureLightboxRefs();
    if (!lightbox) return;
    // Build visible list and find index for navigation
    lightboxItems = getVisibleMedia();
    if (originFig) {
      const idx = lightboxItems.findIndex(it => it.node === originFig);
      lightboxIndex = idx >= 0 ? idx : 0;
    } else {
      // fallback by matching src
      const idx = lightboxItems.findIndex(it => it.src === src && it.type === type);
      lightboxIndex = idx >= 0 ? idx : 0;
    }
    showLightboxItem(lightboxItems[lightboxIndex] || { type, src, alt, caption, poster });
  }
  function showLightboxItem(item) {
    if (!item) return;
    document.body.classList.add('modal-open');
    lightbox.removeAttribute('hidden');
    lightboxBody.innerHTML = '';
    if (item.type === 'image') {
      const img = el('img', { src: item.src, alt: item.alt || '' });
      lightboxBody.appendChild(img);
    } else if (item.type === 'video') {
      const video = el('video', { controls: true, autoplay: true, playsInline: true, poster: item.poster || undefined });
      const source = el('source', { src: item.src, type: 'video/mp4' });
      video.appendChild(source);
      lightboxBody.appendChild(video);
    }
    lightboxCaption.textContent = item.caption || '';
    updateLightboxNavButtons();
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    lightboxBody.innerHTML = '';
    lightboxCaption.textContent = '';
    lightboxItems = [];
    lightboxIndex = -1;
  }
  function getVisibleMedia() {
    const grid = document.querySelector(GRID_SELECTOR);
    if (!grid) return [];
    const figs = Array.from(grid.querySelectorAll('.media-card'))
      .filter(card => card.style.display !== 'none');
    return figs.map(fig => ({
      node: fig,
      type: fig.dataset.type || 'image',
      src: fig.dataset.src || '',
      alt: fig.dataset.alt || '',
      caption: fig.dataset.caption || '',
      poster: fig.dataset.poster || ''
    }));
  }
  function navigateLightbox(delta) {
    if (!lightboxItems.length) return;
    lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
    showLightboxItem(lightboxItems[lightboxIndex]);
  }
  function updateLightboxNavButtons() {
    if (!lightboxPrevBtn || !lightboxNextBtn) return;
    const disabled = lightboxItems.length <= 1;
    lightboxPrevBtn.disabled = disabled;
    lightboxNextBtn.disabled = disabled;
  }

  async function load() {
    const grid = document.querySelector(GRID_SELECTOR);
    if (!grid) return;

    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load media.json: ${res.status}`);
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) {
        grid.appendChild(renderPlaceholder('No media yet. Add items to assets/data/media.json'));
        return;
      }

      // Clear any existing static items
      grid.innerHTML = '';

      // Build filters and search state
      const filters = buildFilters(items);
      window.__galleryState = { selected: new Set(), search: '' };
      // wire search
      const searchEl = document.querySelector(SEARCH_SELECTOR);
      if (searchEl) {
        searchEl.addEventListener('input', (e) => {
          window.__galleryState.search = e.target.value || '';
          applyFilters();
        });
      }

      for (const item of items) {
        if (!item || !item.type || !item.src) continue;
        if (item.type === 'image') grid.appendChild(renderImage(item));
        else if (item.type === 'video') grid.appendChild(renderVideo(item));
      }

      // Initialize state from filters (All pressed => selected empty)
      if (filters && typeof filters.getSelected === 'function') {
        window.__galleryState.selected = filters.getSelected();
      }
      // Observe filter button toggles by overriding toggle inside closure via click handlers already wired
      // Update selected set whenever filters are clicked
      const filtersContainer = document.querySelector(FILTERS_SELECTOR);
      if (filtersContainer) {
        filtersContainer.addEventListener('click', () => {
          if (filters && typeof filters.getSelected === 'function') {
            window.__galleryState.selected = filters.getSelected();
          }
          applyFilters();
        });
      }

      applyFilters();

      // Reveal-on-scroll observer
      initRevealObserver();
    } catch (err) {
      console.error(err);
      const grid = document.querySelector(GRID_SELECTOR);
      if (grid) grid.appendChild(renderPlaceholder('Failed to load media. Check media.json path.'));
    }

    // Back-to-top button logic
    const backTop = document.getElementById('back-to-top');
    if (backTop) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 400) backTop.removeAttribute('hidden');
        else backTop.setAttribute('hidden', '');
      });
      backTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Masonry layout toggle
    const layoutToggle = document.getElementById('layout-toggle');
    if (layoutToggle && grid) {
      layoutToggle.addEventListener('click', () => {
        const on = grid.classList.toggle('masonry');
        layoutToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        layoutToggle.textContent = `Masonry: ${on ? 'On' : 'Off'}`;
      });
    }
  }

  // Case-study modal logic
  let caseModal, caseTitle, caseMeta, caseDescription, caseGallery;
  function ensureCaseRefs() {
    if (!caseModal) {
      caseModal = document.getElementById('case-modal');
      caseTitle = document.getElementById('case-title');
      caseMeta = document.getElementById('case-meta');
      caseDescription = document.getElementById('case-description');
      caseGallery = document.getElementById('case-gallery');
      if (caseModal) {
        caseModal.addEventListener('click', (e) => {
          if (e.target.hasAttribute('data-close')) closeCaseStudy();
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !caseModal.hasAttribute('hidden')) closeCaseStudy();
        });
      }
    }
  }
  function openCaseStudy(item) {
    if (!item || !item.detail) return;
    ensureCaseRefs();
    if (!caseModal) return;
    const d = item.detail;
    caseTitle.textContent = d.title || item.caption || 'Project';
    caseMeta.innerHTML = '';
    const tags = [];
    if (d.placement) tags.push(`Placement: ${d.placement}`);
    if (Array.isArray(d.style) && d.style.length) tags.push(...d.style);
    if (d.date) tags.push(d.date);
    tags.forEach(t => caseMeta.appendChild(el('span', {}, t)));
    caseDescription.textContent = d.description || '';
    caseGallery.innerHTML = '';
    if (Array.isArray(d.images)) {
      d.images.forEach(src => caseGallery.appendChild(el('img', { src, alt: item.alt || '' })));
    }
    if (Array.isArray(d.videos)) {
      d.videos.forEach(src => {
        const v = el('video', { controls: true, preload: 'metadata', playsInline: true });
        v.appendChild(el('source', { src, type: 'video/mp4' }));
        caseGallery.appendChild(v);
      });
    }
    document.body.classList.add('modal-open');
    caseModal.removeAttribute('hidden');
  }
  function closeCaseStudy() {
    if (!caseModal) return;
    caseModal.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    caseTitle.textContent = '';
    caseMeta.innerHTML = '';
    caseDescription.textContent = '';
    caseGallery.innerHTML = '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  // Reveal observer helper
  let _revealObserver;
  function initRevealObserver() {
    if (_revealObserver) return;
    const grid = document.querySelector(GRID_SELECTOR);
    if (!grid) return;
    _revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          _revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    grid.querySelectorAll('.media-card.reveal').forEach(card => _revealObserver.observe(card));
  }
})();
