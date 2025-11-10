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
    const visible = items.filter((item) => {
      const cats = item.categories || [];
      const matchesFilter = activeFilter === "all" || cats.includes(activeFilter);
      const haystack = ((item.title || "") + " " + (item.caption || "") + " " + (item.alt || "")).toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      return matchesFilter && matchesSearch;
    });

    if (!visible.length) {
      grid.innerHTML = '<p class="work-item-caption">No items yet. Add your tattoos and videos in media.json.</p>';
      return;
    }

    visible.forEach((item) => grid.appendChild(renderCard(item)));
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
      mediaHtml = `<video class="${usingWorkDesign() ? "work-media" : "media-card__thumb"}" controls preload="metadata" playsinline>
          <source src="${item.src}" type="video/mp4" />
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
      render();
    });
  });

  /* =============================
     Search
     ============================= */
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value;
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
      src.type = "video/mp4";
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
});
