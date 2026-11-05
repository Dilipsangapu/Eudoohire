/* ============ Template catalogue + resume renderer (shared) ============ */

const TEMPLATES = [
  { id: "modern",    name: "Modern",    category: "modern",       layout: "sidebar", accent: "#2563eb", font: "sans",    desc: "Clean sidebar layout with a bold accent color." },
  { id: "classic",   name: "Classic",   category: "professional", layout: "single",  accent: "#1e293b", font: "serif",   desc: "Timeless centered serif layout recruiters trust." },
  { id: "executive", name: "Executive", category: "professional", layout: "header",  accent: "#0f3d3e", font: "serif",   desc: "Strong header band for senior and leadership roles." },
  { id: "creative",  name: "Creative",  category: "creative",     layout: "sidebar", accent: "#db2777", font: "rounded", desc: "Playful color for design, media and marketing roles." },
  { id: "minimal",   name: "Minimal",   category: "simple",       layout: "single",  accent: "#111827", font: "sans",    desc: "Whitespace-first and highly ATS-friendly." },
  { id: "tech",      name: "Developer", category: "modern",       layout: "sidebar", accent: "#10b981", font: "mono",    desc: "Skill-forward layout made for engineers." },
  { id: "elegant",   name: "Elegant",   category: "creative",     layout: "header",  accent: "#7c3aed", font: "serif",   desc: "Refined typography with a soft gradient header." },
  { id: "fresher",   name: "Fresher",   category: "simple",       layout: "single",  accent: "#0891b2", font: "sans",    desc: "Education-first layout for students and graduates.", eduFirst: true }
];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "professional", label: "Professional" },
  { id: "modern", label: "Modern" },
  { id: "creative", label: "Creative" },
  { id: "simple", label: "Simple" }
];

const SAMPLE_RESUME = {
  name: "Priya Sharma",
  title: "Senior Product Designer",
  email: "priya.sharma@email.com",
  phone: "+91 98765 43210",
  location: "Hyderabad, India",
  website: "linkedin.com/in/priyasharma",
  summary: "Product designer with 7+ years of experience crafting user-centred web and mobile experiences. Skilled at turning complex problems into simple, elegant interfaces and leading cross-functional teams from research to launch.",
  experience: [
    { role: "Senior Product Designer", company: "Nimbus Labs", start: "Mar 2022", end: "Present",
      details: "Led redesign of core dashboard, increasing weekly active users by 32%\nBuilt and maintained a design system used across 5 product teams\nMentored 4 junior designers through structured critique sessions" },
    { role: "UX Designer", company: "BrightPath Solutions", start: "Jun 2019", end: "Feb 2022",
      details: "Designed onboarding flow that cut drop-off by 18%\nRan 40+ usability tests and translated insights into roadmap items" },
    { role: "UI Designer", company: "PixelCraft Studio", start: "Jul 2017", end: "May 2019",
      details: "Delivered responsive websites for 20+ clients across retail and finance" }
  ],
  education: [
    { degree: "M.Des, Interaction Design", school: "National Institute of Design", year: "2015 – 2017", note: "" },
    { degree: "B.Tech, Computer Science", school: "JNTU Hyderabad", year: "2011 – 2015", note: "CGPA 8.6" }
  ],
  skills: "Figma, User Research, Prototyping, Design Systems, Wireframing, HTML & CSS, Usability Testing, Accessibility",
  languages: "English, Hindi, Telugu"
};

const EMPTY_RESUME = {
  name: "", title: "", email: "", phone: "", location: "", website: "", summary: "",
  experience: [{ role: "", company: "", start: "", end: "", details: "" }],
  education: [{ degree: "", school: "", year: "", note: "" }],
  skills: "", languages: ""
};

const STORE_KEY = "resumecraft:data";

/* ---------- helpers ---------- */
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function splitList(str) {
  return String(str || "").split(",").map(s => s.trim()).filter(Boolean);
}
function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}
function initials(name) {
  return (name || "").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";
}

/* ---------- section builders ---------- */
function bulletsHTML(text) {
  const lines = String(text || "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  return lines.length ? `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : "";
}

function contactItems(d) {
  return [d.email, d.phone, d.location, d.website].filter(Boolean).map(v => `<span>${esc(v)}</span>`).join("");
}

function summaryHTML(d) {
  return d.summary ? `<div class="r-section"><h3 class="r-h">Profile</h3><p>${esc(d.summary)}</p></div>` : "";
}

function experienceHTML(d) {
  const items = (d.experience || []).filter(e => e.role || e.company);
  if (!items.length) return "";
  return `<div class="r-section"><h3 class="r-h">Experience</h3>${items.map(e => `
    <div class="r-item">
      <div class="r-item-head"><strong>${esc(e.role)}</strong><span class="r-date">${esc(e.start)}${e.end ? " – " + esc(e.end) : ""}</span></div>
      <div class="r-sub">${esc(e.company)}</div>
      ${bulletsHTML(e.details)}
    </div>`).join("")}</div>`;
}

function educationHTML(d) {
  const items = (d.education || []).filter(e => e.degree || e.school);
  if (!items.length) return "";
  return `<div class="r-section"><h3 class="r-h">Education</h3>${items.map(e => `
    <div class="r-item">
      <div class="r-item-head"><strong>${esc(e.degree)}</strong><span class="r-date">${esc(e.year)}</span></div>
      <div class="r-sub">${esc(e.school)}${e.note ? " · " + esc(e.note) : ""}</div>
    </div>`).join("")}</div>`;
}

function chipsHTML(title, str) {
  const list = splitList(str);
  return list.length ? `<div class="r-section"><h3 class="r-h">${title}</h3><div class="r-chips">${list.map(s => `<span class="r-chip">${esc(s)}</span>`).join("")}</div></div>` : "";
}

/* ---------- main renderer ---------- */
function renderResume(data, templateId, accentOverride) {
  const t = getTemplate(templateId);
  const d = data || SAMPLE_RESUME;
  const accent = accentOverride || t.accent;
  const cls = `resume tpl-${t.id} l-${t.layout} f-${t.font}`;
  const style = `style="--accent:${esc(accent)}"`;

  const headerBlock = `
    <div class="r-header-text">
      <h1 class="r-name">${esc(d.name) || "Your Name"}</h1>
      <div class="r-title">${esc(d.title)}</div>
    </div>`;

  if (t.layout === "sidebar") {
    const contacts = [["Email", d.email], ["Phone", d.phone], ["Location", d.location], ["Web", d.website]]
      .filter(([, v]) => v).map(([k, v]) => `<li><small>${k}</small>${esc(v)}</li>`).join("");
    return `<div class="${cls}" ${style}>
      <aside class="r-side">
        <div class="r-avatar">${esc(initials(d.name))}</div>
        ${contacts ? `<div class="r-section"><h3 class="r-h">Contact</h3><ul class="r-list-plain">${contacts}</ul></div>` : ""}
        ${chipsHTML("Skills", d.skills)}
        ${chipsHTML("Languages", d.languages)}
      </aside>
      <main class="r-main">
        ${headerBlock}
        ${summaryHTML(d)}
        ${experienceHTML(d)}
        ${educationHTML(d)}
      </main>
    </div>`;
  }

  if (t.layout === "header") {
    return `<div class="${cls}" ${style}>
      <header class="r-band">${headerBlock}<div class="r-contact">${contactItems(d)}</div></header>
      <div class="r-body">
        <div>${summaryHTML(d)}${experienceHTML(d)}</div>
        <div>${educationHTML(d)}${chipsHTML("Skills", d.skills)}${chipsHTML("Languages", d.languages)}</div>
      </div>
    </div>`;
  }

  // single column
  const body = t.eduFirst
    ? summaryHTML(d) + educationHTML(d) + chipsHTML("Skills", d.skills) + experienceHTML(d)
    : summaryHTML(d) + experienceHTML(d) + educationHTML(d) + chipsHTML("Skills", d.skills);
  return `<div class="${cls}" ${style}>
    <header class="r-header">${headerBlock}<div class="r-contact">${contactItems(d)}</div></header>
    ${body}
    ${chipsHTML("Languages", d.languages)}
  </div>`;
}
