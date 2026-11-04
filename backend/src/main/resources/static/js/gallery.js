/* ============ Templates gallery page ============ */
(function () {
  const grid = document.getElementById("galleryGrid");
  const filtersEl = document.getElementById("filters");
  const search = document.getElementById("search");
  const emptyMsg = document.getElementById("emptyMsg");
  const modal = document.getElementById("previewModal");

  let activeCat = "all";

  filtersEl.innerHTML = CATEGORIES.map(c =>
    `<button class="filter-btn${c.id === "all" ? " active" : ""}" data-cat="${c.id}">${c.label}</button>`).join("");

  filtersEl.addEventListener("click", e => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    activeCat = btn.dataset.cat;
    filtersEl.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b === btn));
    draw();
  });
  search.addEventListener("input", draw);

  function draw() {
    const q = search.value.trim().toLowerCase();
    const list = TEMPLATES.filter(t =>
      (activeCat === "all" || t.category === activeCat) &&
      (!q || (t.name + " " + t.desc + " " + t.category).toLowerCase().includes(q)));
    renderTemplateCards(grid, list, openPreview);
    emptyMsg.hidden = list.length > 0;
  }

  function openPreview(id) {
    const t = getTemplate(id);
    document.getElementById("modalTitle").textContent = t.name;
    document.getElementById("modalDesc").textContent = t.desc;
    document.getElementById("modalUse").href = `start.html?template=${t.id}`;
    const thumb = document.getElementById("modalThumb");
    thumb.innerHTML = renderResume(SAMPLE_RESUME, t.id);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => fitThumbs(modal));
  }

  function closePreview() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closePreview(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closePreview(); });

  // Support templates.html?category=modern
  const cat = new URLSearchParams(location.search).get("category");
  if (cat && CATEGORIES.some(c => c.id === cat)) {
    activeCat = cat;
    filtersEl.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
  }
  draw();
})();
