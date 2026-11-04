/* ============ Resume builder page ============ */
(function () {
  const form = document.getElementById("resumeForm");
  const out = document.getElementById("resumeOut");
  const scaler = document.getElementById("scaler");
  const stage = document.getElementById("previewStage");
  const templateSelect = document.getElementById("templateSelect");
  const accentInput = document.getElementById("accentInput");
  const saveStatus = document.getElementById("saveStatus");

  const EMPTY = EMPTY_RESUME;
  const clone = o => JSON.parse(JSON.stringify(o));

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  /* ---------- state ---------- */
  let state = load() || { data: clone(SAMPLE_RESUME), template: TEMPLATES[0].id, accent: "" };
  const urlParams = new URLSearchParams(location.search);
  const urlTpl = urlParams.get("template");
  if (urlTpl && TEMPLATES.some(t => t.id === urlTpl)) {
    if (state.template !== urlTpl) state.accent = "";
    state.template = urlTpl;
  }
  // Edit intent: builder.html?resumeId=<id> continues updating that exact
  // resume. Without it (create intent) any previously persisted resumeId is
  // stripped so the next save starts a NEW logical resume.
  const editResumeId = urlParams.get("resumeId");
  if (editResumeId) {
    state.resumeId = editResumeId;
  } else {
    delete state.resumeId;
    if (editResumeId === "") urlParams.delete("resumeId");
  }

  function load() {
    try { const v = JSON.parse(localStorage.getItem(STORE_KEY)); if (v) return v; } catch { }
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch { return null; }
  }
  let saveTimer;
  let remoteSaveTimer;
  function save() {
    saveStatus.textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        saveStatus.textContent = "Saved locally";
      } catch {
        saveStatus.textContent = "Not saved (storage unavailable)";
      }
    }, 300);

    clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(async () => {
      try {
        const csrf = getCsrfToken();
        const headers = {
          "Content-Type": "application/json",
          "Accept": "application/json"
        };
        if (csrf) headers["X-XSRF-TOKEN"] = csrf;

        const body = {
          resumeId: state.resumeId || null,
          template: state.template,
          accent: state.accent,
          data: state.data,
          html: out.innerHTML
        };

        const res = await fetch("/api/candidate/resumes/builder-save", {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });

        if (res.ok) {
          const result = await res.json();
          if (result && result.resumeId) {
            const isNewResume = !state.resumeId;
            state.resumeId = result.resumeId;
            if (isNewResume) {
              // Bind this browsing session's URL to the new record: a refresh
              // then keeps editing the same resume instead of duplicating it.
              const urlp = new URLSearchParams(location.search);
              urlp.set("resumeId", state.resumeId);
              history.replaceState(null, "", `${location.pathname}?${urlp.toString()}`);
            }
          }
          saveStatus.textContent = "All changes saved ✓";
        } else {
          saveStatus.textContent = "Saved locally";
        }
      } catch (e) {
        saveStatus.textContent = "Saved locally";
      }
    }, 700);
  }

  async function loadServerData() {
    try {
      const qs = editResumeId ? `?resumeId=${encodeURIComponent(editResumeId)}` : "";
      const res = await fetch(`/api/candidate/resumes/builder-data${qs}`, {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) return;
      const serverPayload = await res.json();
      if (serverPayload && serverPayload.data) {
        if (serverPayload.hasSavedData) {
          state.data = serverPayload.data;
          if (serverPayload.template && TEMPLATES.some(t => t.id === serverPayload.template)) {
            state.template = serverPayload.template;
          }
          if (serverPayload.accent) state.accent = serverPayload.accent;
          // Only adopt the server's resumeId in edit mode. In create mode the
          // server deliberately returns a null resumeId so the next save
          // creates a new logical resume instead of binding to an old draft.
          if (editResumeId && serverPayload.resumeId) {
            state.resumeId = serverPayload.resumeId;
          }
          syncControls();
          fillFields();
          update(false);
          saveStatus.textContent = "Loaded from database ✓";
        } else {
          // Pre-fill from candidate profile if local data is sample or blank
          const isSample = JSON.stringify(state.data?.name) === JSON.stringify(SAMPLE_RESUME.name);
          const isBlank = !state.data?.name && !state.data?.title;
          if (isSample || isBlank) {
            state.data = Object.assign({}, clone(EMPTY), serverPayload.data);
            syncControls();
            fillFields();
            update(false);
          }
        }
      }
    } catch (err) {
      console.warn("Could not load candidate builder data from server:", err);
    }
  }

  /* ---------- template + accent controls ---------- */
  templateSelect.innerHTML = TEMPLATES.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  templateSelect.addEventListener("change", () => {
    state.template = templateSelect.value;
    state.accent = "";
    syncControls(); update();
    const urlp = new URLSearchParams(location.search);
    urlp.set("template", state.template);
    if (state.resumeId) urlp.set("resumeId", state.resumeId);
    history.replaceState(null, "", `${location.pathname}?${urlp.toString()}`);
  });
  accentInput.addEventListener("input", () => { state.accent = accentInput.value; update(); });

  function syncControls() {
    templateSelect.value = state.template;
    accentInput.value = state.accent || getTemplate(state.template).accent;
  }

  /* ---------- simple fields ---------- */
  function fillFields() {
    form.querySelectorAll("[data-field]").forEach(el => { el.value = state.data[el.dataset.field] || ""; });
    drawList("experience");
    drawList("education");
  }
  form.addEventListener("input", e => {
    const el = e.target;
    if (el.dataset.field) {
      state.data[el.dataset.field] = el.value;
    } else if (el.dataset.key) {
      const item = el.closest(".repeat-item");
      const listName = item.dataset.list;
      state.data[listName][+item.dataset.index][el.dataset.key] = el.value;
    }
    update();
  });

  /* ---------- repeatable lists ---------- */
  function drawList(name) {
    const holder = document.getElementById(name + "List");
    const tpl = document.getElementById(name + "Tpl");
    holder.innerHTML = "";
    (state.data[name] || []).forEach((item, i) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.list = name;
      node.dataset.index = i;
      node.querySelectorAll("[data-key]").forEach(inp => { inp.value = item[inp.dataset.key] || ""; });
      holder.appendChild(node);
    });
  }
  form.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    const rem = e.target.closest("[data-remove]");
    if (add) {
      const name = add.dataset.add;
      state.data[name] = state.data[name] || [];
      state.data[name].push(clone(EMPTY[name][0]));
      drawList(name); update();
      const items = document.querySelectorAll(`#${name}List .repeat-item`);
      items[items.length - 1]?.querySelector("input")?.focus();
    }
    if (rem) {
      const item = rem.closest(".repeat-item");
      state.data[item.dataset.list].splice(+item.dataset.index, 1);
      drawList(item.dataset.list); update();
    }
  });

  /* ---------- actions ---------- */
  document.getElementById("sampleBtn").addEventListener("click", () => {
    state.data = clone(SAMPLE_RESUME); fillFields(); update();
  });
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("Clear all fields? This cannot be undone.")) return;
    state.data = clone(EMPTY); fillFields(); update();
  });
  document.getElementById("downloadBtn").addEventListener("click", () => {
    const prev = document.title;
    document.title = (state.data.name || "Resume").replace(/\s+/g, "_") + "_Resume";
    window.print();
    document.title = prev;
  });

  /* ---------- preview ---------- */
  function update(shouldSave = true) {
    out.innerHTML = renderResume(state.data, state.template, state.accent);
    fitPreview();
    if (shouldSave) save();
  }
  function fitPreview() {
    const avail = stage.clientWidth - 2 * parseFloat(getComputedStyle(stage).paddingLeft);
    const s = Math.min(1, avail / 794);
    const page = out.firstElementChild;
    const h = page ? page.offsetHeight : 1123;
    scaler.style.transform = `scale(${s})`;
    scaler.style.width = "794px";
    scaler.style.height = h + "px";
    // keep layout height equal to the visible (scaled) size
    scaler.style.marginBottom = `${h * s - h}px`;
    scaler.style.marginLeft = scaler.style.marginRight = s < 1 ? "0" : "auto";
  }
  window.addEventListener("resize", fitPreview);
  document.fonts && document.fonts.ready.then(fitPreview);

  /* ---------- upload / import ---------- */
  document.getElementById("uploadBtn").addEventListener("click", () => {
    location.href = `start.html?template=${state.template}#upload`;
  });

  function showImportBanner() {
    let fileName = null;
    try { fileName = sessionStorage.getItem("resumecraft:imported"); sessionStorage.removeItem("resumecraft:imported"); } catch { }
    if (!fileName) return;
    const banner = document.createElement("div");
    banner.className = "import-banner";
    banner.innerHTML = `<span>✓</span><span>Imported from <strong>${esc(fileName)}</strong>. Please review each section. Automatic reading isn't perfect.</span><button aria-label="Dismiss">✕</button>`;
    banner.querySelector("button").onclick = () => banner.remove();
    form.before(banner);
    form.querySelectorAll("details.panel").forEach(d => { d.open = true; });
  }

  /* ---------- init ---------- */
  syncControls();
  fillFields();
  update();
  showImportBanner();
  loadServerData();
})();
