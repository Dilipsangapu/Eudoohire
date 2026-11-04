/* ==========================================================================
 * tech-icons.js - shared technology icon pill + tooltip module
 * --------------------------------------------------------------------------
 * Single source of truth for the technology/skill icon pills used by every
 * dashboard: React (paid & unpaid candidate) and Thymeleaf (recruiter, client
 * admin). Plain classic script so server-rendered pages can load it directly
 * and the Vite/React bundle can import it.
 *
 * - Icon artwork: `tech-stack-icons` npm package (MIT, tech-stack-icons.com),
 *   extracted into js/tech-icons-data.js by frontend/scripts/tech-icons.
 * - Central name mapping with normalization/aliases (SpringBoot, spring boot,
 *   "spring-boot" all resolve the same way). Unknown skills get a neutral
 *   code glyph plus their real name - never a wrong brand logo - and the
 *   tooltip always carries the original technology name.
 * - One delegated tooltip instance per document: mouse hover (short delay),
 *   keyboard focus (instant), Escape to dismiss, touch tap on mobile, kept
 *   inside the viewport and never covering the icon (pointer-events:none).
 *
 * - ICON POLICY: SVG technology icons render ONLY on the full job-description
 *   view (call pillHTML there). Everywhere else call plainHTML(name), which
 *   renders the technology name as a plain text chip - job cards/listings,
 *   dashboards, resumes, portfolios and skill lists must not show icons.
 * ========================================================================== */
(function (global) {
  "use strict";

  var DATA = global.TechIconAssets || {};
  var STYLE_ID = "tech-icons-style";

  /* Neutral, non-brand fallback glyph (a code bracket) for technologies the
     package does not provide. The real skill name stays visible next to it.
     Sized inline so it stays metric-stable even without the stylesheet. */
  var FALLBACK_GLYPH =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;display:block" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 6 6 6-6 6"/><path d="m9 18-6-6 6-6"/></svg>';

  /* Display name -> package icon key. Keys are lowercase with spaces, dots,
     dashes, slashes, underscores, apostrophes and parenthetical notes
     removed: "JavaScript (ES6+)" -> "javascript", ".NET" -> "net",
     "C++" -> "c++". Add aliases here when the package key differs. */
  var ALIAS = {
    "javascript": "js",
    "ecmascript": "js",
    "reactjs": "react",
    "springboot": "spring",
    "vue": "vuejs",
    "next": "nextjs",
    "node": "nodejs",
    "express": "expressjs",
    "html": "html5",
    "css": "css3",
    "scss": "sass",
    "tailwind": "tailwindcss",
    "k8s": "kubernetes",
    "amazonwebservices": "aws",
    "mongo": "mongodb",
    "postgres": "postgresql",
    "golang": "go",
    "cpp": "c++",
    "csharp": "c#",
    "dotnet": "net"
  };

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function normalizeName(raw) {
    return String(raw == null ? "" : raw)
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")        /* drop annotative "(ES6+)" notes */
      .replace(/[\s./_'",\-]+/g, "")    /* unify Node.js / node-js / node js */
      .trim();
  }

  /* Resolves a display name to the package icon id, or null when the
     technology has no icon. Never guesses: a missing entry means the caller
     gets the neutral fallback pill. */
  function iconFor(name) {
    var key = normalizeName(name);
    if (!key) return null;
    return (DATA[key] && key) || ALIAS[key] || null;
  }

  function iconSVG(techName, iconKey) {
    var entry = DATA[iconKey];
    if (!entry) return null;
    var label = String(techName || entry.label || iconKey).trim();
    var svg = entry.svg;
    var open = /<svg[^>]*?>/.exec(svg);
    if (open && open[0].indexOf("style=") === -1) {
      /* The package's own StackIcon adds this sizing; mirror it so the mark
         scales to its wrapper box regardless of host-page stylesheets. */
      svg = svg.replace(/<svg([^>]*?)>/, '<svg$1 style="width: 100%; height: 100%; display: block;">');
    }
    return svg.replace(/<svg([^>]*?)>/, '<svg$1 role="img" aria-hidden="true" focusable="false" data-tech-icon="' + escapeAttr(iconKey) + '" title="' + escapeAttr(label) + '">');
  }

  /* Shared style sheet. `.tech-icon-pill` blends with the host dashboard's
     existing tag/chip classes, which keep providing the background, padding
     and typography; this module adds icon geometry and the tooltip look. */
  var STYLE_TEXT =
    ".tech-icon-pill{display:inline-flex;align-items:center;gap:.34em;cursor:default;vertical-align:middle;}" +
    ".tech-icon-pill:focus-visible{outline:2px solid currentColor;outline-offset:1px;}" +
    ".tech-ico-box{width:13px;height:13px;flex:none;line-height:0;overflow:hidden;}" +
    ".tech-ico-box>svg{width:100%;height:100%;display:block;}" +
    ".tech-ico-box.techtico-fallback{opacity:.8;}" +
    ".tech-icon-pill-label{white-space:nowrap;}" +
    ".tech-ico-tip{position:fixed;left:0;top:0;z-index:2147483000;background:#0f172a;color:#f8fafc;" +
      "font-size:12px;line-height:1;font-weight:600;letter-spacing:.01em;padding:6px 9px;border-radius:6px;" +
      "box-shadow:0 6px 18px rgba(15,23,42,.28);pointer-events:none;white-space:nowrap;opacity:0;" +
      "transform:translateY(4px);transition:opacity .12s ease,transform .12s ease;}" +
    ".tech-ico-tip.tech-ico-tip-show{opacity:1;transform:translateY(0);}" +
    "@media (prefers-reduced-motion: reduce){.tech-ico-tip{transition:none;}}";

  /* ---- Pill renderer used by React dashboards AND Thymeleaf dashboards ----
     Known icon -> logo only (name lives in the tooltip + accessible label;
     like the package's own a11y guidance). Unknown skill -> neutral glyph
     plus the real name, so the pill always stays unambiguous. */
  function pillHTML(name, extraClass, inlineStyle) {
    var label = String(name == null ? "" : name).trim();
    if (!label) return "";
    var icon = iconFor(label);
    var cls = "tech-icon-pill" + (extraClass ? " " + extraClass : "") + (icon ? "" : " tech-pill-unknown");
    var inner;
    if (icon) {
      inner = '<span class="tech-ico-box">' + iconSVG(label, icon) + "</span>";
    } else {
      inner = '<span class="tech-ico-box techtico-fallback" aria-hidden="true">' + FALLBACK_GLYPH + "</span>" +
              '<span class="tech-icon-pill-label">' + escapeHtml(label) + "</span>";
    }
    return '<span class="' + cls + '"' + (inlineStyle ? ' style="' + inlineStyle + '"' : "") +
           ' tabindex="0" role="img" aria-label="' + escapeAttr(label) + '" data-tech-tip="' + escapeAttr(label) + '">' +
           inner + "</span>";
  }

  /* Renders any asset key directly (used for previews / special cases). */
  function pillHTMLKey(iconKey, label, extraClass, inlineStyle) {
    if (!DATA[iconKey]) return pillHTML(label, extraClass, inlineStyle);
    var cls = "tech-icon-pill" + (extraClass ? " " + extraClass : "");
    return '<span class="' + cls + '"' + (inlineStyle ? ' style="' + inlineStyle + '"' : "") +
           ' tabindex="0" role="img" aria-label="' + escapeAttr(label) + '" data-tech-tip="' + escapeAttr(label) + '">' +
           '<span class="tech-ico-box">' + iconSVG(label, iconKey) + "</span></span>";
  }

  /* ---- Plain-text renderer (default for technology names) --------------------
     Requirement: SVG tech icons appear ONLY on the full job-description view.
     Every other surface (job cards/listings, dashboards, resumes, portfolios,
     skill lists) renders the technology name as a plain text chip - no SVG,
     no fallback glyph, no tooltip. Host chip classes keep providing their own
     look; this returns exactly the same markup the icon path produces for
     unknown skills minus the glyph, so renaming is never needed. */
  function plainHTML(name, extraClass, inlineStyle) {
    var label = String(name == null ? "" : name).trim();
    if (!label) return "";
    var cls = "tech-icon-pill-label" + (extraClass ? " " + extraClass : "");
    return '<span class="' + cls + '"' + (inlineStyle ? ' style="' + inlineStyle + '"' : "") + ">" +
           escapeHtml(label) + "</span>";
  }

  /* ---- One-shot stylesheet injection -------------------------------------- */
  function ensureStyles() {
    if (!global.document || document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
  }

  /* ---- Tooltip: hover, keyboard focus, touch -------------------------------- */
  var TIP_DELAY_MS = 110;
  var TIP_TOUCH_MS = 2200;

  function mountTooltips() {
    if (!global.document || global.__techIconsTipMounted) return;
    global.__techIconsTipMounted = true;
    ensureStyles();

    var tip = document.createElement("div");
    tip.className = "tech-ico-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.appendChild(tip);

    var showTimer = 0;
    var touchTimer = 0;
    var current = null;

    function clearShowTimer() {
      if (showTimer) { clearTimeout(showTimer); showTimer = 0; }
    }
    function positionFor(el) {
      var rect = el.getBoundingClientRect();
      var width = tip.offsetWidth || 0;
      var height = tip.offsetHeight || 0;
      var x = rect.left + rect.width / 2 - width / 2;
      var maxX = global.innerWidth - width - 8;
      if (x < 8) x = 8;
      if (x > maxX) x = maxX;
      var y = rect.top - height - 6;              /* above the icon by default */
      if (y < 8) y = rect.bottom + 6;             /* otherwise below it */
      tip.style.left = Math.round(x) + "px";
      tip.style.top = Math.round(y) + "px";
    }
    function show(el) {
      current = el;
      tip.textContent = el.getAttribute("data-tech-tip") || el.getAttribute("aria-label") || "";
      tip.hidden = false;
      positionFor(el);
      requestAnimationFrame(function () {
        if (current) { positionFor(el); tip.classList.add("tech-ico-tip-show"); }
      });
    }
    function hide() {
      current = null;
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = 0; }
      tip.classList.remove("tech-ico-tip-show");
      tip.hidden = true;
    }
    function closestPill(node) {
      if (!node || !node.closest) return null;
      return node.closest("[data-tech-tip]");
    }

    document.addEventListener("pointerover", function (event) {
      var pill = closestPill(event.target);
      if (!pill || pill === current) return;
      clearShowTimer();
      if (event.pointerType === "touch") {
        show(pill);                                  /* tap identifies the icon */
        if (touchTimer) clearTimeout(touchTimer);
        touchTimer = setTimeout(hide, TIP_TOUCH_MS);
        return;
      }
      showTimer = setTimeout(function () { show(pill); }, TIP_DELAY_MS);
    });
    document.addEventListener("pointerout", function (event) {
      var pill = closestPill(event.target);
      if (!pill) return;
      if (pill === current) { clearShowTimer(); hide(); }
      else { clearShowTimer(); }
    });
    document.addEventListener("focusin", function (event) {
      var pill = closestPill(event.target);
      if (!pill) return;
      clearShowTimer();
      show(pill);                                    /* keyboard users: instant */
    });
    document.addEventListener("focusout", function (event) {
      if (!closestPill(event.target)) return;
      hide();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && current) hide();
    });
    document.addEventListener("scroll", function () { if (current) hide(); }, { capture: true, passive: true });
    global.addEventListener("resize", function () { if (current) hide(); });
    document.addEventListener("pointerdown", function (event) {
      if (!closestPill(event.target) && current) hide();
    });
  }

  /* Explicit activation for the React bundle (TechnologyIcon mounts). */
  function activate() {
    if (!global.document) return;
    mountTooltips();
  }

  /* ---- Server-rendered dashboards self-activate ---------------------------- *
   * The React SPA hosts a <div id="root"> and activates the shared tooltip
   * itself when it first renders a pill, so the module stays inert here. */
  if (typeof document !== "undefined") {
    var reactHost = document.getElementById && document.getElementById("root");
    if (!reactHost) {
      if (document.body) mountTooltips();
      else document.addEventListener("DOMContentLoaded", mountTooltips);
    }
  }

  global.TechIcons = {
    version: "2.0",
    iconFor: iconFor,
    iconSVG: iconSVG,
    pillHTML: pillHTML,
    pillHTMLKey: pillHTMLKey,
    plainHTML: plainHTML,
    ensureStyles: ensureStyles,
    activate: activate,
    normalizeName: normalizeName
  };
})(typeof window !== "undefined" ? window : globalThis);
