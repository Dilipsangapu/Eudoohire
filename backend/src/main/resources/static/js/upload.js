/* ============ Resume upload: read PDF / DOCX / TXT and map it to builder fields ============
   Everything runs in the browser. The file is never sent to a server.
   PDF reading uses pdf.js, DOCX reading uses mammoth.js (both loaded on demand from cdnjs). */

const PDFJS_URL  = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const MAMMOTH_URL = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_ACCEPT = [".pdf", ".docx", ".txt"];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load the file reader. Check your internet connection and try again."));
    document.head.appendChild(s);
  });
}

/* ---------------- Text extraction ---------------- */

async function extractResumeText(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (file.size > UPLOAD_MAX_BYTES) throw new Error("That file is larger than 5 MB. Please upload a smaller file.");
  if (ext === "pdf") return pdfToText(file);
  if (ext === "docx") return docxToText(file);
  if (ext === "txt") return file.text();
  if (ext === "doc") throw new Error("Old .doc files aren't supported. Save it as .docx or PDF and try again.");
  throw new Error("Unsupported file type. Please upload a PDF, DOCX or TXT file.");
}

async function pdfToText(file) {
  await loadScript(PDFJS_URL);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 10 }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    // Group text pieces that sit on the same baseline into one line
    const lines = [];
    for (const it of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) < Math.max(2, it.h * 0.45)) last.items.push(it);
      else lines.push({ y: it.y, items: [it] });
    }
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      let text = "", prevEnd = null;
      for (const it of line.items) {
        if (prevEnd !== null) {
          const gap = it.x - prevEnd;
          if (gap > it.h * 1.6) text += "  |  ";                       // big gap = separate column/field
          else if (gap > it.h * 0.12 && !text.endsWith(" ") && !it.s.startsWith(" ")) text += " ";
        }
        text += it.s;
        prevEnd = it.x + it.w;
      }
      out.push(text);
    }
  }
  return out.join("\n");
}

async function docxToText(file) {
  await loadScript(MAMMOTH_URL);
  const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return res.value.replace(/\t+/g, "  |  ");
}

/* ---------------- Parsing ---------------- */

const SECTION_KEYS = {
  summary: ["summary", "professional summary", "profile", "professional profile", "career objective", "objective",
    "about me", "about", "career summary", "personal statement", "profile summary", "executive summary"],
  experience: ["experience", "work experience", "professional experience", "employment history", "work history",
    "employment", "internships", "internship", "internship experience", "career history", "relevant experience",
    "experience summary", "professional background"],
  education: ["education", "academic background", "academic details", "educational qualifications",
    "educational qualification", "academics", "qualifications", "education and training", "academic qualifications",
    "academic profile", "education details"],
  skills: ["skills", "technical skills", "key skills", "core skills", "core competencies", "competencies", "skill set",
    "skills and abilities", "skills & abilities", "areas of expertise", "expertise", "technologies",
    "tools and technologies", "tools & technologies", "tech stack", "it skills", "software skills", "soft skills"],
  languages: ["languages", "languages known", "language proficiency", "language skills"],
  other: ["projects", "academic projects", "personal projects", "key projects", "certifications", "certificates",
    "certification", "courses", "training", "trainings", "achievements", "awards", "honors", "honours",
    "accomplishments", "extracurricular activities", "extra curricular activities", "hobbies", "interests",
    "declaration", "personal details", "personal information", "personal profile", "references", "strengths",
    "activities", "publications", "volunteer experience", "volunteering", "awards and achievements"]
};

const SPOKEN_RE = /\b(english|hindi|telugu|tamil|kannada|malayalam|marathi|bengali|bangla|gujarati|punjabi|urdu|odia|oriya|assamese|konkani|sanskrit|french|german|spanish|italian|portuguese|japanese|korean|arabic|chinese|mandarin|russian|dutch|turkish|nepali|sinhala|persian|swahili)\b/i;
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE = `(?:${MONTH}\\.?\\s*'?,?\\s*\\d{2,4}|\\d{1,2}\\s*[\\/.-]\\s*\\d{2,4}|(?:19|20)\\d{2})`;
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|till|until)\\s*(${DATE}|present|current|now|ongoing|till date|today)`, "i");
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const BULLET_RE = /^[\s•●▪◦‣∙·\-*–►➢➤✓✔■□○\uf0b7\uf0a7\uf076\uf0d8]+\s*/;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s|,]+|github\.com\/[^\s|,]+|[a-z0-9-]+\.(?:com|in|io|dev|me|net|org|co|site|app)(?:\/[^\s|,]*)?)/i;
const LOCATION_RE = /^[A-Za-z][A-Za-z .'-]{1,30},\s*[A-Za-z][A-Za-z .'-]{1,30}(?:,\s*[A-Za-z .'-]{2,30})?(?:\s*[-–]?\s*\d{6})?$/;

const ROLE_WORDS = /\b(engineer|developer|manager|intern|analyst|designer|consultant|lead|architect|executive|associate|specialist|administrator|officer|head|director|trainee|scientist|coordinator|tester|admin|programmer|accountant|teacher|lecturer|professor|assistant|representative|supervisor|technician|owner|founder|freelancer|officer|qa|sde|member|researcher|writer|editor|marketer|recruiter|operator|nurse|doctor)\b/i;
const COMPANY_WORDS = /\b(pvt|private|ltd|limited|inc|llc|llp|technologies|technology|solutions|corp|corporation|company|co\.|labs|systems|services|bank|group|software|consulting|consultancy|infotech|infosys|tcs|wipro|accenture|cognizant|hcl|capgemini|deloitte|amazon|google|microsoft|ibm|oracle|enterprises|industries|studio|agency|foundation|hospital|university|college|school)\b/i;

const DEGREE_RE = /\b(b\.?\s?tech|m\.?\s?tech|b\.?\s?e\.?(?=\s|$|,)|m\.?\s?e\.?(?=\s|$|,)|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|m\.?\s?com|bca|mca|mba|bba|b\.?\s?a\.?(?=\s|$|,)|m\.?\s?a\.?(?=\s|$|,)|ph\.?\s?d|bachelor|master|diploma|intermediate|ssc|hsc|cbse|icse|secondary|higher secondary|high school|10th|12th|class\s?x|class\s?xii|matriculation|pgdm|pgdca|doctorate|b\.?\s?arch|b\.?\s?pharm|m\.?\s?pharm|mbbs|b\.?\s?ed|degree|graduation|post graduation|inter\b|puc|pre-university)/i;
const SCHOOL_RE = /\b(university|college|institute|institution|school|academy|iit|nit|iiit|bits|vidyalaya|polytechnic|campus|board)\b/i;
const SCORE_RE = /(?:c?gpa|sgpa|cpi|percentage|marks|grade|score)\s*[:\-]?\s*[\d.]+\s*(?:\/\s*\d+(?:\.\d+)?)?\s*%?|\b\d{2}(?:\.\d+)?\s*%/i;

function normalizeLine(l) {
  let s = l.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  // "E X P E R I E N C E" -> "EXPERIENCE"
  if (/^(?:[A-Z&]\s){3,}[A-Z&]$/.test(s)) s = s.replace(/\s/g, "");
  return s;
}
function cleanEdges(s) {
  return String(s || "").replace(/^[\s|,;:•·\-–—()]+|[\s|,;:•·\-–—(]+$/g, "").replace(/\s*\|\s*\|\s*/g, " | ").trim();
}
function headingKey(text) {
  return text.toLowerCase().replace(/[^a-z& ]/g, " ").replace(/\s+/g, " ").trim();
}
function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}
function isAllCaps(s) { return /[A-Z]/.test(s) && s === s.toUpperCase(); }

/* Detect "EXPERIENCE", "Skills:", "Technical Skills: Java, SQL" */
function detectHeading(line) {
  if (line.length > 60) return null;
  const all = Object.entries(SECTION_KEYS).flatMap(([sec, keys]) => keys.map(k => [sec, k]))
    .sort((a, b) => b[1].length - a[1].length);
  const key = headingKey(line);
  for (const [sec, k] of all) {
    if (key === k) return { section: sec, rest: "" };
  }
  for (const [sec, k] of all) {
    const m = line.match(new RegExp(`^${k.replace(/[&]/g, "\\&").replace(/ /g, "\\s+")}\\s*[:\\-–|]\\s*(.+)$`, "i"));
    if (m) return { section: sec, rest: m[1].trim() };
  }
  return null;
}

function parseResumeText(rawText) {
  const lines = String(rawText || "").split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const sections = { header: [], summary: [], experience: [], education: [], skills: [], languages: [], other: [] };
  let current = "header";
  for (const line of lines) {
    let h = detectHeading(line);
    // "Languages: JavaScript, SQL" inside a skills list means programming languages
    if (h && h.section === "languages" && h.rest && !SPOKEN_RE.test(h.rest)) {
      h = current === "skills" || !SPOKEN_RE.test(h.rest) ? { section: "skills", rest: h.rest } : h;
    }
    if (h) {
      current = h.section;
      if (h.rest) sections[current].push(h.rest);
    } else {
      sections[current].push(line);
    }
  }

  const data = JSON.parse(JSON.stringify(EMPTY_RESUME));
  Object.assign(data, parseHeader(sections.header, lines));

  data.summary = sections.summary.map(l => l.replace(BULLET_RE, "")).join(" ").trim() || data._headerSummary || "";
  delete data._headerSummary;

  const exp = parseExperience(sections.experience);
  if (exp.length) data.experience = exp;
  const edu = parseEducation(sections.education);
  if (edu.length) data.education = edu;

  data.skills = splitItems(sections.skills).join(", ");
  data.languages = splitItems(sections.languages).join(", ");

  if (!data.title && exp[0] && exp[0].role) data.title = exp[0].role;

  return data;
}

/* ---------- header: name, title, contact ---------- */
function parseHeader(headerLines, allLines) {
  const out = { name: "", title: "", email: "", phone: "", location: "", website: "" };
  const leftovers = [];
  const top = headerLines.length ? headerLines : allLines.slice(0, 8);

  for (const line of top) {
    const parts = line.split(/\s*[|•·●▪]\s*|\s{3,}/).map(p => p.trim()).filter(Boolean);
    for (let part of parts) {
      part = part.replace(/^(email|e-mail|mail|phone|mobile|mob|tel|contact|ph|location|address|linkedin|github|website|portfolio)\s*(?:no\.?)?\s*[:\-]\s*/i, "");
      const email = part.match(EMAIL_RE);
      if (email) { out.email = out.email || email[0]; part = part.replace(email[0], ""); }
      const phone = findPhone(part);
      if (phone) { out.phone = out.phone || phone; part = part.replace(phone, ""); }
      const url = !email && part.match(URL_RE);
      if (url) { if (!out.website || /linkedin/i.test(url[0])) out.website = url[0].replace(/^https?:\/\/(www\.)?/, ""); part = part.replace(url[0], ""); }
      part = cleanEdges(part);
      if (!part) continue;
      if (!out.location && LOCATION_RE.test(part) && part.split(/\s+/).length <= 6) { out.location = part; continue; }
      leftovers.push(part);
    }
  }

  // Fall back to scanning the whole document for contact details
  const whole = allLines.join("\n");
  if (!out.email) { const m = whole.match(EMAIL_RE); if (m) out.email = m[0]; }
  if (!out.phone) { for (const l of allLines) { const p = findPhone(l); if (p) { out.phone = p; break; } } }
  if (!out.website) { const m = whole.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,]+/i); if (m) out.website = m[0].replace(/^https?:\/\/(www\.)?/, ""); }

  const isNameLike = s => /^[A-Za-z][A-Za-z.' -]+$/.test(s) && s.split(/\s+/).length >= 1 && s.split(/\s+/).length <= 5 && s.length <= 40;
  const nameIdx = leftovers.findIndex(isNameLike);
  if (nameIdx > -1) {
    const n = leftovers[nameIdx];
    out.name = isAllCaps(n) ? titleCase(n) : n;
    const next = leftovers.slice(nameIdx + 1).find(s => s.split(/\s+/).length <= 8 && !/\d{4}/.test(s) && !/^(resume|curriculum vitae|cv)$/i.test(s));
    if (next && next.split(/\s+/).length <= 8) out.title = isAllCaps(next) ? titleCase(next) : next;
  }
  // A long paragraph in the header is usually the summary
  const para = leftovers.find(s => s.split(/\s+/).length > 18);
  if (para) out._headerSummary = para;
  return out;
}

function findPhone(text) {
  const candidates = String(text).match(/[+(]?\d[\d\s().-]{8,}\d/g) || [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13 && !RANGE_RE.test(c)) return c.trim();
  }
  return "";
}

/* ---------- experience ---------- */
function splitRoleCompany(parts) {
  parts = parts.map(cleanEdges).filter(Boolean);
  if (parts.length === 1) {
    const pieces = parts[0].split(/\s+(?:at|@)\s+|\s+\|\s+|\s+[-–—]\s+/i).map(cleanEdges).filter(Boolean);
    if (pieces.length > 1) parts = pieces;
    else {
      const comma = parts[0].split(/\s*,\s*/);
      if (comma.length > 1 && (ROLE_WORDS.test(comma[0]) || COMPANY_WORDS.test(comma.slice(1).join(",")))) parts = [comma[0], comma.slice(1).join(", ")];
    }
  }
  let role = "", company = "";
  if (parts.length === 1) {
    if (COMPANY_WORDS.test(parts[0]) && !ROLE_WORDS.test(parts[0])) company = parts[0]; else role = parts[0];
  } else if (parts.length >= 2) {
    const [a, b] = parts.slice(-2);
    const aIsCompany = COMPANY_WORDS.test(a) && !ROLE_WORDS.test(a);
    const bIsRole = ROLE_WORDS.test(b) && !COMPANY_WORDS.test(b);
    if (aIsCompany || bIsRole) { company = a; role = b; } else { role = a; company = b; }
  }
  return { role, company };
}

function parseExperience(lines) {
  const entries = [];
  let cur = null;
  let pending = [];
  const lastDetail = () => cur && cur.details.length ? cur.details.length - 1 : -1;

  for (const raw of lines) {
    const isBullet = BULLET_RE.test(raw) && /^[\s•●▪◦‣∙·\-*–►➢➤✓✔■□○\uf0b7\uf0a7\uf076\uf0d8]/.test(raw);
    const line = raw.replace(BULLET_RE, "").trim();
    if (!line) continue;
    const range = !isBullet && line.match(RANGE_RE);

    if (range) {
      if (cur) entries.push(cur);
      const rest = cleanEdges(line.replace(range[0], "").replace(/\(\s*\)/g, ""));
      const parts = [...pending];
      if (rest) parts.push(rest);
      const rc = splitRoleCompany(parts);
      cur = { ...rc, start: titleCase(range[1]).replace(/\s+/g, " "), end: /present|current|now|ongoing|till date|today/i.test(range[2]) ? "Present" : titleCase(range[2]), details: [] };
      pending = [];
      continue;
    }

    const words = line.split(/\s+/).length;
    if (isBullet) {
      if (pending.length && cur) { cur.details.push(...pending); pending = []; }
      if (cur) cur.details.push(line); else pending.push(line);
    } else if (/^[a-z(&,]/.test(line) && lastDetail() > -1 && !pending.length) {
      cur.details[lastDetail()] += " " + line;                 // wrapped bullet text
    } else if (words <= 9 && !/[.;]$/.test(line)) {
      if (cur && !cur.details.length && !pending.length && (!cur.company || !cur.role)) {
        if (cur.company && LOCATION_RE.test(line) && !COMPANY_WORDS.test(line)) continue;
        const rc = splitRoleCompany([line]);
        if (!cur.company) cur.company = rc.company || rc.role; else cur.role = rc.role || rc.company;
      } else {
        pending.push(line);
      }
    } else {
      if (pending.length && cur) { cur.details.push(...pending); pending = []; }
      if (cur) cur.details.push(line); else pending.push(line);
    }
  }
  if (cur) { if (pending.length) cur.details.push(...pending); entries.push(cur); }
  else if (pending.length) {
    const rc = splitRoleCompany(pending.slice(0, 1));
    entries.push({ role: rc.role || pending[0], company: rc.company || (pending[1] && pending[1].split(/\s+/).length <= 8 ? pending[1] : ""), start: "", end: "", details: pending.slice(rc.company ? 1 : 2) });
  }
  return entries.map(e => ({ role: e.role, company: e.company, start: e.start, end: e.end, details: e.details.join("\n") }));
}

/* ---------- education ---------- */
function parseEducation(lines) {
  const entries = [];
  let cur = null;
  const push = () => { if (cur && (cur.degree || cur.school)) entries.push(cur); };

  for (const raw of lines) {
    let line = raw.replace(BULLET_RE, "").trim();
    if (!line) continue;

    let year = "";
    const range = line.match(RANGE_RE);
    if (range) { year = range[0].replace(/\s*(?:-|–|—|to)\s*/i, " – "); line = line.replace(range[0], ""); }
    else {
      const yrs = line.match(YEAR_RE);
      if (yrs) { year = yrs.join(" – "); line = line.replace(YEAR_RE, ""); }
    }
    let note = "";
    const score = line.match(SCORE_RE);
    if (score) { note = score[0].trim(); line = line.replace(score[0], ""); }
    line = cleanEdges(line.replace(/\(\s*\)/g, "").replace(/\b(passed out|passing year|year of passing|graduated|expected)\b\s*:?/gi, ""));

    let degree = "", school = "";
    if (line) {
      let parts = line.split(/\s+[-–—|]\s+|\s+at\s+|\s+from\s+|\s{2,}/i).map(cleanEdges).filter(Boolean);
      if (parts.length === 1 && DEGREE_RE.test(line) && SCHOOL_RE.test(line)) {
        const idx = line.search(/,\s*(?=[^,]*\b(university|college|institute|school|academy|iit|nit|iiit|vidyalaya|polytechnic)\b)/i);
        if (idx > 0) parts = [line.slice(0, idx), line.slice(idx + 1)].map(cleanEdges);
      }
      for (const p of parts) {
        if (!degree && DEGREE_RE.test(p) && !(SCHOOL_RE.test(p) && !/^(b|m|bachelor|master|diploma)/i.test(p))) degree = p;
        else if (!school && SCHOOL_RE.test(p)) school = p;
        else if (!degree && !SCHOOL_RE.test(p) && DEGREE_RE.test(p)) degree = p;
        else if (!school && cur && cur.degree && !cur.school) school = p;
      }
      if (!degree && !school) {
        if (cur && !cur.school && line.split(/\s+/).length <= 12) school = line;
        else if (!cur || cur.school) degree = line.split(/\s+/).length <= 12 ? line : "";
      }
    }

    const startsNew = degree && (!cur || cur.degree);
    const schoolOnlyNew = !degree && school && (!cur || cur.school);
    if (startsNew || schoolOnlyNew) { push(); cur = { degree: "", school: "", year: "", note: "" }; }
    if (!cur) cur = { degree: "", school: "", year: "", note: "" };
    if (degree) cur.degree = degree;
    if (school) cur.school = cur.school || school;
    if (year && !cur.year) cur.year = year;
    if (note && !cur.note) cur.note = note;
  }
  push();
  return entries;
}

/* ---------- skills / languages ---------- */
function splitItems(lines) {
  const seen = new Set();
  const items = [];
  for (const raw of lines) {
    let line = raw.replace(BULLET_RE, "").trim();
    const colon = line.indexOf(":");
    if (colon > 0 && colon < 35) line = line.slice(colon + 1);
    for (let item of line.split(/\s*[,;|•·●▪]\s*|\s{2,}|\t|\s+\/\s+/)) {
      item = cleanEdges(item).replace(/\.$/, "");
      if (!item || item.split(/\s+/).length > 6 || item.length > 45) continue;
      const k = item.toLowerCase();
      if (!seen.has(k)) { seen.add(k); items.push(item); }
    }
  }
  return items.slice(0, 40);
}

/* Small summary used on the "we found" screen */
function summarizeParsed(d) {
  const exp = (d.experience || []).filter(e => e.role || e.company).length;
  const edu = (d.education || []).filter(e => e.degree || e.school).length;
  const skills = splitList(d.skills).length;
  return [
    { label: "Name", ok: !!d.name, value: d.name || "Not found" },
    { label: "Contact details", ok: !!(d.email || d.phone), value: [d.email, d.phone].filter(Boolean).join(" · ") || "Not found" },
    { label: "Summary", ok: !!d.summary, value: d.summary ? "Found" : "Not found" },
    { label: "Experience", ok: exp > 0, value: exp ? `${exp} ${exp === 1 ? "entry" : "entries"}` : "Not found" },
    { label: "Education", ok: edu > 0, value: edu ? `${edu} ${edu === 1 ? "entry" : "entries"}` : "Not found" },
    { label: "Skills", ok: skills > 0, value: skills ? `${skills} skills` : "Not found" }
  ];
}
