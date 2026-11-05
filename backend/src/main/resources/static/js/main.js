/* ============ Shared site behaviour ============ */

// Mobile nav + active link + footer year
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) toggle.addEventListener("click", () => links.classList.toggle("open"));

  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a:not(.btn)").forEach(a => {
    if (a.getAttribute("href") === page) a.classList.add("active");
  });

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Any element with data-template gets a rendered sample thumbnail
  document.querySelectorAll(".thumb[data-template]").forEach(el => {
    el.innerHTML = renderResume(SAMPLE_RESUME, el.dataset.template);
  });
  fitThumbs();
});

/* Scale each .thumb's 794px resume to fit its container width */
function fitThumbs(root = document) {
  root.querySelectorAll(".thumb").forEach(el => {
    const w = el.clientWidth;
    if (w) el.style.setProperty("--s", (w / 794).toFixed(4));
  });
}
let _fitTimer;
window.addEventListener("resize", () => {
  clearTimeout(_fitTimer);
  _fitTimer = setTimeout(() => fitThumbs(), 100);
});
document.fonts && document.fonts.ready.then(() => fitThumbs());

/* Build template cards into a container */
function renderTemplateCards(container, list, onPreview) {
  if (!container) return;
  container.innerHTML = list.map(t => `
    <article class="t-card" data-id="${t.id}">
      <div class="t-thumb-wrap">
        <div class="thumb">${renderResume(SAMPLE_RESUME, t.id)}</div>
        <div class="t-overlay">
          <a href="start.html?template=${t.id}" class="btn btn-primary">Use This Template</a>
          ${onPreview ? `<button class="btn btn-light btn-sm" data-preview="${t.id}">Preview</button>` : ""}
        </div>
      </div>
      <div class="t-info">
        <h3>${esc(t.name)} <span class="tag">${esc(t.category)}</span></h3>
        <p>${esc(t.desc)}</p>
      </div>
    </article>`).join("");

  if (onPreview) {
    container.querySelectorAll("[data-preview]").forEach(btn =>
      btn.addEventListener("click", () => onPreview(btn.dataset.preview)));
  }
  requestAnimationFrame(() => fitThumbs(container));
}
