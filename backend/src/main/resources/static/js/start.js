/* ============ Start page: upload an existing resume or start from scratch ============ */
(function () {
  const params = new URLSearchParams(location.search);
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } })();
  const templateId = TEMPLATES.some(t => t.id === params.get("template"))
    ? params.get("template")
    : (saved && saved.template) || TEMPLATES[0].id;

  document.getElementById("tplName").textContent = getTemplate(templateId).name;

  const views = document.querySelectorAll(".start-view");
  function show(name) {
    views.forEach(v => { v.hidden = v.dataset.view !== name; });
    window.scrollTo(0, 0);
  }

  function saveState(data) {
    const state = { data, template: templateId, accent: "" };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
    // Fallback hand-off if localStorage is blocked
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { }
  }
  const builderUrl = () => `builder.html?template=${templateId}`;

  document.addEventListener("click", e => {
    const go = e.target.closest("[data-go]");
    if (!go) return;
    const target = go.dataset.go;
    if (target === "scratch") {
      if (saved && saved.data && saved.data.name && !confirm("Start from scratch? This replaces the resume currently saved in the editor.")) return;
      saveState(JSON.parse(JSON.stringify(EMPTY_RESUME)));
      location.href = builderUrl();
    } else {
      show(target);
    }
  });

  /* ---------- file picking ---------- */
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");

  fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("over"); }));
  dropzone.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
  // stop the browser from opening a file dropped outside the zone
  window.addEventListener("dragover", e => e.preventDefault());
  window.addEventListener("drop", e => e.preventDefault());

  /* ---------- processing ---------- */
  const steps = [...document.querySelectorAll("#procSteps li")];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function setStep(i) {
    steps.forEach((li, idx) => { li.className = idx < i ? "done" : idx === i ? "active" : ""; });
  }

  async function handleFile(file) {
    show("processing");
    setStep(0);
    try {
      const [text] = await Promise.all([extractResumeText(file), wait(700)]);
      if (!text || text.replace(/\s/g, "").length < 40) {
        throw new Error("We couldn't find any text in this file. It may be a scanned image. Try a PDF exported from Word or Google Docs, or a DOCX file.");
      }
      setStep(1); await wait(500);
      const data = parseResumeText(text);
      setStep(2); await wait(500);
      setStep(3); await wait(450);
      saveState(data);
      try { sessionStorage.setItem("resumecraft:imported", file.name); } catch { }
      setStep(4);
      renderDone(file.name, data);
    } catch (err) {
      console.error(err);
      document.getElementById("errorMsg").textContent = err.message || "Something went wrong while reading the file.";
      show("error");
    }
  }

  function renderDone(fileName, data) {
    document.getElementById("doneFile").textContent = `We read “${fileName}” and filled in what we found:`;
    document.getElementById("foundList").innerHTML = summarizeParsed(data).map(r => `
      <li class="${r.ok ? "ok" : "miss"}">
        <span class="fl-icon">${r.ok ? "✓" : "–"}</span>
        <span class="fl-label">${esc(r.label)}</span>
        <span class="fl-value">${esc(r.value)}</span>
      </li>`).join("");
    document.getElementById("continueBtn").href = builderUrl();
    show("done");
  }

  // Deep links: start.html#upload opens the upload step directly
  if (location.hash === "#upload") show("upload");
  window.addEventListener("hashchange", () => { if (location.hash === "#upload") show("upload"); });
})();
