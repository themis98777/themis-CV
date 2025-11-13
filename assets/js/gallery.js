document.addEventListener("DOMContentLoaded", () => {
  /* =============================
     Design Compatibility Helpers
     ============================= */
  function getGrid() {
    return (
      document.getElementById("work-grid") ||
      document.querySelector(".work-grid") ||
      document.querySelector(".media-grid")
    );
  }
  function getSearchInput() {
    return (
      document.getElementById("gallery-search") ||
      document.querySelector(".search input") ||
      null
    );
  }
  function getFiltersContainer() {
    return (
      document.querySelector(".filters") ||
      document.getElementById("filters") ||
      null
    );
  }
  function usingWorkDesign() {
    const g = getGrid();
    return !!(g && (g.id === "work-grid" || g.classList.contains("work-grid")));
  }

  // Mobile nav toggle (unchanged)
  const navToggle = document.querySelector(".nav-toggle");
  const navList = document.querySelector(".nav-list");
  if (navToggle && navList) {
    navToggle.addEventListener("click", () => navList.classList.toggle("open"));
  }

  const grid = getGrid();
  if (!grid) return; // nothing to do if no gallery container

  const searchInput = getSearchInput();
  let filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
  const nextBtn = document.getElementById("next-page");

  // Pagination state (2 rows only)
  let currentPage = 0;
  let perPage = 0; // computed from grid column count * 2 rows

  function getColumnCount() {
    const style = window.getComputedStyle(grid);
    let template = style.getPropertyValue("grid-template-columns");
    if (!template) return 1;
    template = template.trim();
    // If browser returns explicit tracks like '294px 294px 294px', count tokens
    let explicit = template.split(/\s+/).filter(Boolean);
    if (explicit.length > 1 && !explicit[0].includes("repeat")) {
      return explicit.length;
    }
    // Fallback: estimate based on min card width including gap
    const gap = parseFloat(style.getPropertyValue("gap")) || 16;
    const minCard = 230;
    return Math.max(1, Math.floor((grid.clientWidth + gap) / (minCard + gap)));
  }
  function computePerPage() {
    const cols = getColumnCount();
    perPage = Math.max(1, cols * 2); // baseline: exactly 2 rows
  }

  // Robust measurement by temporarily laying out some cards to count columns
  function measureColumnsByLayout(sampleItems) {
    if (!sampleItems || !sampleItems.length) return null;
    const maxProbe = Math.min(sampleItems.length, 12);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < maxProbe; i++) frag.appendChild(renderCard(sampleItems[i]));
    const prev = grid.innerHTML;
    const prevVis = grid.style.visibility;
    grid.style.visibility = "hidden";
    grid.innerHTML = "";
    grid.appendChild(frag);
    const kids = Array.from(grid.children);
    let cols = 1;
    if (kids.length) {
      const top0 = kids[0].offsetTop;
      cols = kids.findIndex((el) => el.offsetTop !== top0);
      if (cols === -1) cols = kids.length; // all on same row
    }
    grid.innerHTML = "";
    grid.style.visibility = prevVis;
    // restore will be handled by render following call
    return cols || 1;
  }
  // initialize perPage and update on resize
  computePerPage();
  window.addEventListener("resize", () => {
    const before = perPage;
    computePerPage();
    if (perPage !== before) {
      currentPage = 0; // reset to first when layout changes
      render();
    }
  });

  // Lightbox compatibility (old & new markup)
  const lightbox = document.getElementById("lightbox") || document.querySelector(".lightbox");
  let lightboxMedia = null;
  let lightboxCaption = null;
  let lightboxClose = null;
  let lightboxBackdrop = null;
  if (lightbox) {
    lightboxMedia = lightbox.querySelector(".lightbox-media") || lightbox.querySelector("#lightbox-body") || lightbox.querySelector(".lightbox__body");
    lightboxCaption = lightbox.querySelector(".lightbox-caption") || lightbox.querySelector("#lightbox-caption") || lightbox.querySelector(".lightbox__caption");
    lightboxClose = lightbox.querySelector(".lightbox-close") || lightbox.querySelector(".lightbox__close");
    lightboxBackdrop = lightbox.querySelector(".lightbox-backdrop") || lightbox.querySelector(".lightbox__backdrop");
  }

  let items = [];
  let activeFilter = "all";
  let searchTerm = "";
  let categorySet = new Set();

  /* =============================
     Data Load
     ============================= */
  fetch("assets/data/media.json", { cache: "no-store" })
    .then((res) => res.json())
    .then((data) => {
      items = Array.isArray(data) ? data : [];
      // Collect categories for dynamic filters if needed
      items.forEach((it) => Array.isArray(it.categories) && it.categories.forEach((c) => categorySet.add(c)));
      // Recompute perPage after data is available and grid likely laid out
      computePerPage();
      ensureFilters();
      render();
    })
    .catch((err) => {
      console.error("Error loading media.json", err);
      grid.innerHTML = '<p class="work-item-caption">Add items to assets/data/media.json to show your work.</p>';
    });

  /* =============================
     Filters (dynamic fallback)
     ============================= */
  function ensureFilters() {
    if (filterButtons.length > 0) return; // user provided static buttons
    const container = getFiltersContainer();
    if (!container) return;
    container.innerHTML = "";
    const allBtn = createFilterButton("All", "all", true);
    container.appendChild(allBtn);
    Array.from(categorySet).sort().forEach((cat) => {
      container.appendChild(createFilterButton(cat, cat));
    });
    filterButtons = Array.from(container.querySelectorAll(".filter-btn"));
  }
  function createFilterButton(label, value, active = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn" + (active ? " active" : "");
    btn.dataset.filter = value;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = value;
      currentPage = 0;
      render();
    });
    return btn;
  }

  /* =============================
     Rendering
     ============================= */
  function render() {
    grid.innerHTML = "";

    const term = searchTerm.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const cats = item.categories || [];
      const matchesFilter = activeFilter === "all" || cats.includes(activeFilter);
      const haystack = ((item.title || "") + " " + (item.caption || "") + " " + (item.alt || "")).toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      return matchesFilter && matchesSearch;
    });

    if (!filtered.length) {
      grid.innerHTML = '<p class="work-item-caption">No items yet. Add your tattoos and videos in media.json.</p>';
      if (nextBtn) nextBtn.style.display = "none";
      return;
    }
  // Pagination: ensure perPage reflects real layout
  if (!perPage || perPage < 1) computePerPage();
  const measuredCols = measureColumnsByLayout(filtered);
  if (measuredCols && measuredCols > 0) perPage = Math.max(1, measuredCols * 2);
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    if (currentPage >= totalPages) currentPage = 0;
    const start = currentPage * perPage;
    const pageItems = filtered.slice(start, start + perPage);

    pageItems.forEach((item) => grid.appendChild(renderCard(item)));

    // After cards are in DOM, ensure videos show a poster frame instead of black
    ensureVideoPosters(grid);

    // Add ghost placeholders to keep grid cell sizing consistent when last page not full
    const deficit = perPage - pageItems.length;
    for (let i = 0; i < deficit; i++) {
      const ghost = document.createElement(usingWorkDesign() ? "article" : "figure");
      ghost.className = usingWorkDesign() ? "work-item ghost" : "media-card ghost";
      grid.appendChild(ghost);
    }

    if (nextBtn) {
      nextBtn.style.display = totalPages > 1 ? "inline-block" : "none";
      nextBtn.textContent = `Next (${currentPage + 1}/${totalPages})`;
      nextBtn.onclick = () => {
        currentPage = (currentPage + 1) % totalPages;
        render();
      };
    }
  }

  function renderCard(item) {
    const card = document.createElement(usingWorkDesign() ? "article" : "figure");
    card.className = usingWorkDesign() ? "work-item" : "media-card";
    card.dataset.type = item.type || "image";
    card.dataset.src = item.src;
    card.dataset.caption = item.caption || item.title || "";
    card.dataset.alt = item.alt || "";

    const primaryLabel = (item.categories && item.categories[0]) || item.type || "work";
    let mediaHtml = "";
    if (item.type === "video") {
      const ext = (item.src.split('.').pop() || '').toLowerCase();
      const mime = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      mediaHtml = `<video class="${usingWorkDesign() ? "work-media" : "media-card__thumb"}" controls preload="metadata" playsinline>
          <source src="${item.src}" type="${mime}" />
          Your browser does not support the video tag.
        </video>`;
    } else {
      mediaHtml = `<img class="${usingWorkDesign() ? "work-media" : "media-card__thumb"}" src="${item.src}" alt="${item.alt || ""}" loading="lazy" />`;
    }

    if (usingWorkDesign()) {
      card.innerHTML = `
        ${mediaHtml}
        <div class="work-item-label">${primaryLabel.toUpperCase()}</div>
        ${item.title ? `<div class="work-item-title">${item.title}</div>` : ""}
        ${item.caption ? `<div class="work-item-caption">${item.caption}</div>` : ""}
      `;
    } else {
      // legacy figure structure
      card.innerHTML = `
        ${mediaHtml}
        ${item.caption ? `<figcaption class="media-card__caption">${item.caption}</figcaption>` : ""}
      `;
    }

    card.addEventListener("click", (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "video" || tag === "source" || tag === "button") return;
      openLightbox(item);
    });
    return card;
  }

  /* =============================
     Filters (static buttons already wired by createFilterButton)
     If user supplied buttons initially, wire them now.
     ============================= */
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter || "all";
      currentPage = 0;
      render();
    });
  });

  // If the user removed a filter button (e.g., 'reels'), ensure activeFilter isn't stale
  if (activeFilter === 'reels') activeFilter = 'all';

  /* =============================
     Search
     ============================= */
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      currentPage = 0;
      render();
    });
  }

  /* =============================
     Lightbox
     ============================= */
  function openLightbox(item) {
    if (!lightbox || !lightboxMedia) return;
    lightboxMedia.innerHTML = "";
    if (item.type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.autoplay = true;
      const src = document.createElement("source");
      src.src = item.src;
      const ext = (item.src.split('.').pop() || '').toLowerCase();
      src.type = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      video.appendChild(src);
      lightboxMedia.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || "";
      lightboxMedia.appendChild(img);
    }
    if (lightboxCaption) lightboxCaption.textContent = item.caption || item.title || "";
    lightbox.classList.add("active");
    lightbox.removeAttribute("hidden");
    lightbox.setAttribute("aria-hidden", "false");
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("active");
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.setAttribute("hidden", "");
    if (lightboxMedia) lightboxMedia.innerHTML = "";
    if (lightboxCaption) lightboxCaption.textContent = "";
  }
  if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox && (lightbox.classList.contains("active") || !lightbox.hasAttribute("hidden"))) {
      closeLightbox();
    }
  });
  // Generate poster images for videos at runtime to avoid black tiles
  function ensureVideoPosters(scope) {
    const container = scope || document;
    const videos = Array.from(container.querySelectorAll('video'));
    if (!videos.length) return;
    videos.forEach((video) => {
      if (video.getAttribute('poster')) return;
      let captured = false;
      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
      const setPlaceholder = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400; canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0d0d14';
          ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.strokeStyle = 'rgba(214,178,90,0.25)';
          ctx.lineWidth = 2;
          ctx.strokeRect(3,3,canvas.width-6,canvas.height-6);
          ctx.fillStyle = '#d4af37';
          const size = 90; const cx = canvas.width/2; const cy = canvas.height/2;
          ctx.beginPath();
          ctx.moveTo(cx - size/2, cy - size/1.5);
          ctx.lineTo(cx - size/2, cy + size/1.5);
          ctx.lineTo(cx + size/1.2, cy);
          ctx.closePath();
          ctx.fill();
          try { video.setAttribute('poster', canvas.toDataURL('image/png')); } catch(e) {}
        }
      };
      const captureFrame = () => {
        if (captured) return;
        captured = true;
        try {
          const canvas = document.createElement('canvas');
          const w = video.videoWidth || 400;
          const h = video.videoHeight || 500;
          canvas.width = 400; canvas.height = 500;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const targetRatio = 4/5;
            const srcRatio = w/h || targetRatio;
            let drawW = canvas.width;
            let drawH = Math.round(drawW / srcRatio);
            if (drawH > canvas.height) {
              drawH = canvas.height;
              drawW = Math.round(drawH * srcRatio);
            }
            const dx = Math.round((canvas.width - drawW)/2);
            const dy = Math.round((canvas.height - drawH)/2);
            ctx.fillStyle = '#0d0d14';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.drawImage(video, 0, 0, w, h, dx, dy, drawW, drawH);
            video.setAttribute('poster', canvas.toDataURL('image/jpeg', 0.8));
          }
        } catch (e) {
          setPlaceholder();
        }
      };
      const onLoaded = () => {
        try { video.currentTime = Math.min(0.25, (video.duration || 1) * 0.05); } catch(e) {}
      };
      const onSeeked = () => { captureFrame(); cleanup(); };
      const onError = () => { if (!captured) setPlaceholder(); cleanup(); };
      video.addEventListener('loadeddata', onLoaded, { once: true });
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      setTimeout(() => { if (!captured && !video.getAttribute('poster')) setPlaceholder(); }, 3000);
    });
  }
});
