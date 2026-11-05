

/* ── Utility helpers ──────────────────────────────────────── */

const $ = (sel, ctx = document) => ctx.querySelector(sel);

const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];



/* ── SVG Icon Library ─────────────────────────────────────── */

const ICONS = {

  check: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,

  trash: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,

  bookmark: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,

  refresh: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,

  info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,

  building: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>`,

  rocket: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.62 4.5-2 4.5-2"/><path d="M12 15v5s3.03-.55 4.5-2c1.62-1.62 2-4.5 2-4.5"/></svg>`,

  lock: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,

  sparkle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>`,

  edit: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,

  phone: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,

  share: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0DAA98" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,

};



function showToast(title, msg, icon = ICONS.check, duration = 3500) {

  const container = $("#toast-container");

  const el = document.createElement("div");

  el.className = "toast";

  el.innerHTML = `<span class="toast-icon">${icon}</span>

    <div class="toast-body">

      <div class="toast-title">${title}</div>

      <div class="toast-msg">${msg}</div>

    </div>`;

  container.appendChild(el);

  requestAnimationFrame(() =>

    requestAnimationFrame(() => el.classList.add("show")),

  );

  setTimeout(() => {

    el.classList.remove("show");

    el.classList.add("hide");

    setTimeout(() => el.remove(), 400);

  }, duration);

}



function openModal(icon, title, body) {

  $("#modal-icon").innerHTML = icon;

  $("#modal-title").textContent = title;

  $("#modal-body").textContent = body;

  $("#modal-overlay").classList.add("open");

  document.body.style.overflow = "hidden";

}



function closeModal() {

  $("#modal-overlay").classList.remove("open");

  document.body.style.overflow = "";

}



/* ════════════════════════════════════════════════════════════

   JOB DATA

   ════════════════════════════════════════════════════════════ */

const JOBS = [

  {

    id: 1,

    title: "Senior React Developer",

    company: "TechNova",

    location: "Bengaluru, Karnataka",

    type: "fulltime",

    typeLabel: "Full-time",

    salary: "₹22–30 LPA",

    posted: "2 days ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.62 4.5-2 4.5-2"/><path d="M12 15v5s3.03-.55 4.5-2c1.62-1.62 2-4.5 2-4.5"/></svg>`,

    logoBg: "#EFF6FF",

    category: "engineering",

  },

  {

    id: 2,

    title: "HR Business Partner",

    company: "BrightLabs",

    location: "Mumbai, Maharashtra",

    type: "fulltime",

    typeLabel: "Full-time",

    salary: "₹12–18 LPA",

    posted: "1 day ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,

    logoBg: "#FFF1F2",

    category: "hr",

  },

  {

    id: 3,

    title: "Product Designer (UX)",

    company: "PixelWorks",

    location: "Remote",

    type: "remote",

    typeLabel: "Remote",

    salary: "₹18–24 LPA",

    posted: "3 days ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9333EA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,

    logoBg: "#FDF4FF",

    category: "design",

  },

  {

    id: 4,

    title: "Payroll Specialist",

    company: "DataBridge",

    location: "Hyderabad, Telangana",

    type: "fulltime",

    typeLabel: "Full-time",

    salary: "₹8–12 LPA",

    posted: "5 days ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M16 10h-5.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H8"/></svg>`,

    logoBg: "#ECFDF5",

    category: "finance",

  },

  {

    id: 5,

    title: "Talent Acquisition Lead",

    company: "CloudCore",

    location: "Pune, Maharashtra",

    type: "hybrid",

    typeLabel: "Hybrid",

    salary: "₹15–22 LPA",

    posted: "1 week ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,

    logoBg: "#FFF7ED",

    category: "hr",

  },

  {

    id: 6,

    title: "Data Analyst",

    company: "NexaSoft",

    location: "Chennai, Tamil Nadu",

    type: "fulltime",

    typeLabel: "Full-time",

    salary: "₹10–16 LPA",

    posted: "4 days ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,

    logoBg: "#F0FDF4",

    category: "data",

  },

  {

    id: 7,

    title: "Digital Marketing Manager",

    company: "PixelWorks",

    location: "Delhi NCR",

    type: "hybrid",

    typeLabel: "Hybrid",

    salary: "₹14–20 LPA",

    posted: "3 days ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,

    logoBg: "#FFF7ED",

    category: "marketing",

  },

  {

    id: 8,

    title: "Operations Manager",

    company: "TechNova",

    location: "Bengaluru, Karnataka",

    type: "fulltime",

    typeLabel: "Full-time",

    salary: "₹20–28 LPA",

    posted: "6 days ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,

    logoBg: "#EFF6FF",

    category: "operations",

  },

  {

    id: 9,

    title: "Customer Success Manager",

    company: "BrightLabs",

    location: "Remote",

    type: "remote",

    typeLabel: "Remote",

    salary: "₹12–17 LPA",

    posted: "2 days ago",

    logo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,

    logoBg: "#FFF1F2",

    category: "support",

  },

];



/* ════════════════════════════════════════════════════════════

   JOB BOARD

   ════════════════════════════════════════════════════════════ */

const JobBoard = (function () {

  let activeCategory = null;

  let activeSearch = { keyword: "", location: "", type: "" };

  let savedJobs = new Set();



  const BADGE_CLASS = {

    fulltime: "badge-fulltime",

    remote: "badge-remote",

    hybrid: "badge-hybrid",

    parttime: "badge-parttime",

    contract: "badge-contract",

    internship: "badge-internship",

  };



  const getBookmarkSvg = (isSaved) => `

    <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>

    </svg>`;



  function createJobCard(job, index) {

    const card = document.createElement("article");

    card.className = "job-card reveal";

    card.dataset.id = job.id;

    card.dataset.category = job.category;

    card.dataset.type = job.type;

    card.style.transitionDelay = `${index * 0.06}s`;

    card.setAttribute("role", "listitem");

    card.setAttribute("aria-label", `${job.title} at ${job.company}`);



    const badgeClass = BADGE_CLASS[job.type] || "badge-fulltime";

    const isSaved = savedJobs.has(job.id);



    card.innerHTML = `

      <div class="job-card-header">

        <div class="job-company-logo" style="background:${job.logoBg}" aria-hidden="true">${job.logo}</div>

        <button class="bookmark-btn ${isSaved ? "saved" : ""}" data-id="${job.id}"

          title="${isSaved ? "Unsave job" : "Save job"}" aria-label="${isSaved ? "Remove from saved" : "Save job"}">

          ${getBookmarkSvg(isSaved)}

        </button>

      </div>

      <div>

        <div class="job-title">${job.title}</div>

        <div class="job-company">

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>

          ${job.company}

        </div>

        <div class="job-location">

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>

          ${job.location}

        </div>

      </div>

      <div class="job-meta">

        <span class="job-type-badge ${badgeClass}">${job.typeLabel}</span>

        <span class="job-salary">${job.salary}</span>

      </div>

      <div class="job-card-footer">

        <span class="job-posted">

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

          ${job.posted}

        </span>

        <button class="btn-apply" data-title="${job.title}" data-company="${job.company}"

          aria-label="Apply for ${job.title}">Apply Now</button>

      </div>`;



    // Bookmark toggle

    card.querySelector(".bookmark-btn").addEventListener("click", () => {

      const btn = card.querySelector(".bookmark-btn");

      if (savedJobs.has(job.id)) {

        savedJobs.delete(job.id);

        btn.classList.remove("saved");

        btn.innerHTML = getBookmarkSvg(false);

        btn.title = "Save job";

        btn.setAttribute("aria-label", "Save job");

        showToast(

          "Job Removed",

          "Removed from your saved list.",

          ICONS.trash,

          2500,

        );

      } else {

        savedJobs.add(job.id);

        btn.classList.add("saved");

        btn.innerHTML = getBookmarkSvg(true);

        btn.title = "Unsave job";

        btn.setAttribute("aria-label", "Remove from saved");

        showToast(

          "Job Saved!",

          `${job.title} saved to your list.`,

          ICONS.bookmark,

          2500,

        );

      }

    });



    // Apply now

    card.querySelector(".btn-apply").addEventListener("click", () => {

      openModal(

        ICONS.rocket,

        `Apply: ${job.title}`,

        `You're applying for ${job.title} at ${job.company}. This is a demo portal — applications are not processed.`,

      );

    });



    return card;

  }



  function renderJobs(jobs) {

    const grid = $("#jobs-grid");

    const noResults = $("#no-results");



    // Remove existing cards (keep #no-results)

    $$(".job-card", grid).forEach((c) => c.remove());

    noResults.classList.remove("show");



    if (jobs.length === 0) {

      noResults.classList.add("show");

      return;

    }



    jobs.forEach((job, i) => {

      grid.insertBefore(createJobCard(job, i), noResults);

    });



    // Trigger reveal

    setTimeout(() => {

      $$(".job-card.reveal", grid).forEach((el) => el.classList.add("visible"));

    }, 60);

  }



  function filterJobs() {

    const kw = activeSearch.keyword.toLowerCase().trim();

    const loc = activeSearch.location.toLowerCase().trim();

    const tp = activeSearch.type.toLowerCase().trim();



    const filtered = JOBS.filter((job) => {

      const matchKw =

        !kw ||

        job.title.toLowerCase().includes(kw) ||

        job.company.toLowerCase().includes(kw);

      const matchLoc = !loc || job.location.toLowerCase().includes(loc);

      const matchTp = !tp || job.type === tp;

      const matchCat = !activeCategory || job.category === activeCategory;

      return matchKw && matchLoc && matchTp && matchCat;

    });



    renderJobs(filtered);

    updateFilterBar();

  }



  function updateFilterBar() {

    const bar = $("#active-filter-bar");

    bar.innerHTML = "";

    const filters = [];

    if (activeSearch.keyword)

      filters.push(`Keyword: "${activeSearch.keyword}"`);

    if (activeSearch.location)

      filters.push(`Location: "${activeSearch.location}"`);

    if (activeSearch.type) filters.push(`Type: ${activeSearch.type}`);

    if (activeCategory) filters.push(`Category: ${activeCategory}`);



    if (filters.length) {

      filters.forEach((f) => {

        const pill = document.createElement("span");

        pill.className = "filter-pill";

        pill.textContent = f;

        bar.appendChild(pill);

      });

      const clearBtn = document.createElement("button");

      clearBtn.className = "filter-clear";

      clearBtn.textContent = "Clear all filters";

      clearBtn.addEventListener("click", clearFilters);

      bar.appendChild(clearBtn);

    }

  }



  function clearFilters() {

    activeCategory = null;

    activeSearch = { keyword: "", location: "", type: "" };

    $("#search-keyword").value = "";

    $("#search-location").value = "";

    $("#search-type").value = "";

    $$(".category-card.active").forEach((c) => c.classList.remove("active"));

    filterJobs();

    showToast(

      "Filters Cleared",

      "Showing all featured jobs.",

      ICONS.refresh,

      2000,

    );

  }



  function search(keyword, location, type) {

    activeSearch = { keyword, location, type };

    filterJobs();

  }



  function filterByCategory(cat) {

    activeCategory = activeCategory === cat ? null : cat;

    if (!activeCategory) {

      $$(".category-card.active").forEach((c) => c.classList.remove("active"));

    }

    filterJobs();

  }



  function init() {

    renderJobs(JOBS);

    // View-all buttons

    $$(".btn-view-all-jobs").forEach((btn) =>

      btn.addEventListener("click", clearFilters),

    );

  }



  return { init, search, filterByCategory, clearFilters };

})();



/* ════════════════════════════════════════════════════════════

   VIEW SWITCHING (Candidate / Recruiter)

   ════════════════════════════════════════════════════════════ */

function setView(view) {

  /* ── 1. Nav view toggle buttons ── */

  $$(".nav-view-btn, .mobile-view-btn").forEach((btn) => {

    const isActive = btn.dataset.view === view;

    btn.classList.toggle("active", isActive);

    btn.setAttribute("aria-selected", String(isActive));

  });



  /* ── 2. Hero Profile Cards ── */

  const candidateCard = $("#hero-profile-candidate");

  const recruiterCard = $("#hero-profile-recruiter");

  if (candidateCard && recruiterCard) {

    if (view === "candidate") {

      candidateCard.style.display = "";

      recruiterCard.style.display = "none";

    } else {

      candidateCard.style.display = "none";

      recruiterCard.style.display = "";

    }

  }



  /* ── 3. Hero badge / desc / buttons text ── */

  const badgeText = $("#hero-badge-text");

  const heroDesc = $("#hero-desc");

  const btnPrimText = $("#hero-btn-primary-text");

  const btnSecText = $("#hero-btn-secondary-text");

  if (badgeText) {

    badgeText.textContent =

      view === "candidate"

        ? "Find your next opportunity"

        : "Hire India's top talent";

  }

  if (heroDesc) {

    heroDesc.textContent =

      view === "candidate"

        ? "Discover roles perfectly matched to your skills, or connect with India's top companies looking for talent like you. Your career journey starts right here."

        : "Post jobs, find matching candidates with AI-powered screening, and hire smarter. India's most trusted platform for recruiters.";

  }

  if (btnPrimText) {

    btnPrimText.textContent =

      view === "candidate" ? "Get Started as Candidate" : "Post a Job Today";

  }

  if (btnSecText) {

    btnSecText.textContent =

      view === "candidate" ? "I'm a recruiter" : "I'm a candidate";

  }



  // Process section is independent — not synced to navbar view

}



/* ════════════════════════════════════════════════════════════

   NAVBAR

   ════════════════════════════════════════════════════════════ */

function initNavbar() {

  const navbar = $(".navbar");



  // Scroll shadow

  window.addEventListener(

    "scroll",

    () => {

      navbar.classList.toggle("scrolled", window.scrollY > 20);

    },

    { passive: true },

  );



  // Desktop & Mobile view switcher buttons

  $$(".nav-view-btn, .mobile-view-btn").forEach((btn) => {

    btn.addEventListener("click", () => {

      setView(btn.dataset.view);

    });

  });



  // Hero secondary button "I'm a recruiter" / "I'm a candidate"

  const heroBtnSecondary = $("#hero-btn-secondary");

  if (heroBtnSecondary) {

    heroBtnSecondary.addEventListener("click", () => {

      const currentView = $("#nav-btn-candidate").classList.contains("active")

        ? "candidate"

        : "recruiter";

      setView(currentView === "candidate" ? "recruiter" : "candidate");

    });

  }



  // Hero primary button

  const heroBtnPrimary = $("#hero-btn-primary");

  if (heroBtnPrimary) {

    heroBtnPrimary.addEventListener("click", () => {

      const isCandidate = $("#nav-btn-candidate").classList.contains("active");

      if (isCandidate) {

        openModal(

          ICONS.sparkle,

          "Create Your Profile",

          "Build your profile with Premium Career Pro (₹499) and get matched with top companies. Demo feature — registration is not available in this preview.",

        );

      } else {

        openModal(

          ICONS.edit,

          "Post a Job Today",

          "Reach thousands of verified candidates. Demo feature — job posting is not available in this preview.",

        );

      }

    });

  }



  // Scroll links in nav (anchor hrefs with data-scroll)

  $$(".nav-link[data-scroll]").forEach((link) => {

    link.addEventListener("click", (e) => {

      e.preventDefault();

      const target = link.dataset.scroll;

      document

        .getElementById(target)

        ?.scrollIntoView({ behavior: "smooth", block: "start" });

    });

  });



  // Mobile hamburger

  const hamburger = $(".nav-hamburger");

  const mobileNav = $(".mobile-nav");



  function closeMobileNav() {

    hamburger.classList.remove("open");

    hamburger.setAttribute("aria-expanded", "false");

    mobileNav.classList.remove("open");

    document.body.style.overflow = "";

  }



  hamburger.addEventListener("click", () => {

    const isOpen = mobileNav.classList.contains("open");

    if (isOpen) {

      closeMobileNav();

    } else {

      hamburger.classList.add("open");

      hamburger.setAttribute("aria-expanded", "true");

      mobileNav.classList.add("open");

      document.body.style.overflow = "hidden";

    }

  });



  $$(`.mobile-nav-link`).forEach((link) => {

    link.addEventListener("click", () => {

      closeMobileNav();

      const target = link.dataset.scroll;

      if (target) {

        document

          .getElementById(target)

          ?.scrollIntoView({ behavior: "smooth", block: "start" });

      } else if (!link.classList.contains("btn-post-job")) {

        showToast(

          "Navigation",

          link.textContent.trim() + " — Demo feature",

          ICONS.info,

        );

      }

    });

  });



  document.addEventListener("keydown", (e) => {

    if (e.key === "Escape") {

      closeMobileNav();

    }

  });



  // Auth buttons

 $$(".btn-nav-login, .btn-nav-login-m").forEach((button) => {
  button.addEventListener("click", () => {
    window.location.href = "/login";
  });
});

  $$(".btn-nav-register, .btn-nav-register-m").forEach((b) =>

    b.addEventListener("click", () =>

      openModal(

        ICONS.sparkle,

        "Create Account",

        "This is a demo homepage. Registration functionality is not available in this preview.",

      ),

    ),

  );

}



/* ════════════════════════════════════════════════════════════

   PROCESS SECTION (How It Works)

   ════════════════════════════════════════════════════════════ */

function initProcessSection() {

  // Process role toggle (Candidates / Recruiters)

  $$(".process-toggle-btn").forEach((btn) => {

    btn.addEventListener("click", () => {

      const target = btn.dataset.target;

      $$(".process-toggle-btn").forEach((b) => {

        b.classList.toggle("active", b.dataset.target === target);

        b.setAttribute("aria-selected", String(b.dataset.target === target));

      });



      // Toggle only the process section cards — navbar is independent

      const candidateCards = $("#process-cards-candidates");

      const recruiterCards = $("#process-cards-recruiters");

      if (candidateCards && recruiterCards) {

        if (target === "candidates") {

          candidateCards.style.display = "";

          recruiterCards.style.display = "none";

        } else {

          candidateCards.style.display = "none";

          recruiterCards.style.display = "";

        }

      }

    });

  });



  // Process step detail buttons

  const stepDetails = {

    "candidate-1": {

      title: "Register & Pay",

      body: "Create your Euodoo Hire account and choose the plan that fits your needs. Unlock Premium Career Pro for just ₹499 to get started on your career journey.",

    },

    "candidate-2": {

      title: "Personal Details",

      body: "Fill in your personal information including contact details, skills, and career objectives to help employers find the right match.",

    },

    "candidate-3": {

      title: "Education",

      body: "Add your educational qualifications, certifications, and courses to showcase your academic background to potential employers.",

    },

    "candidate-4": {

      title: "Experience",

      body: "List your work history, projects, and achievements. A complete experience profile increases your match rate significantly.",

    },

    "candidate-final": {

      title: "Euodoo Releases You",

      body: "Once your profile is verified and complete, Euodoo's AI engine actively matches and surfaces your profile to relevant recruiters. You just sit back — Euodoo does the heavy lifting!",

    },

    "recruiter-1": {

      title: "Company Profile",

      body: "Create a verified company profile with your brand details, culture, and benefits to attract the best candidates.",

    },

    "recruiter-2": {

      title: "Post Job Opening",

      body: "Create detailed job listings with role requirements, salary range, and preferences. Our AI optimizes your listing for maximum visibility.",

    },

    "recruiter-3": {

      title: "AI Applicant Match",

      body: "Euodoo's AI engine automatically screens and ranks applicants based on your requirements, saving you 80% of shortlisting time.",

    },

    "recruiter-4": {

      title: "Interview & Shortlist",

      body: "Schedule interviews, evaluate candidates on structured criteria, and collaborate with your team to select the best fit for your role.",

    },

    "recruiter-final": {

      title: "Hire Top Talent",

      body: "Make your offer and onboard the best talent with Euodoo's guided process. Track successful hires and build your talent pipeline.",

    },

  };



  $$(".process-card-details").forEach((btn) => {

    btn.addEventListener("click", () => {

      const key = btn.dataset.processStep;

      const step = stepDetails[key];

      if (step) {

        openModal(ICONS.info, step.title, step.body);

      }

    });

  });

}



/* ════════════════════════════════════════════════════════════

   MODAL

   ════════════════════════════════════════════════════════════ */

function initModal() {

  const overlay = $("#modal-overlay");

  $("#modal-close-btn").addEventListener("click", closeModal);

  $("#modal-cancel-btn").addEventListener("click", closeModal);

  overlay.addEventListener("click", (e) => {

    if (e.target === overlay) closeModal();

  });

  $("#modal-ok-btn").addEventListener("click", () => {

    closeModal();

    showToast(

      "Got it!",

      "Feature noted — stay tuned for updates.",

      ICONS.check,

    );

  });

}



/* ════════════════════════════════════════════════════════════

   HERO SEARCH

   ════════════════════════════════════════════════════════════ */

function initSearch() {

  const form = $("#search-form");



  const doSearch = () => {

    const keyword = $("#search-keyword").value;

    const location = $("#search-location").value;

    const type = $("#search-type").value;

    JobBoard.search(keyword, location, type);

    document

      .getElementById("featured-jobs")

      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  };



  form.addEventListener("submit", (e) => {

    e.preventDefault();

    doSearch();

  });



  $$(".tag").forEach((tag) => {

    tag.addEventListener("click", () => {

      const val = tag.dataset.value || tag.textContent.trim();

      const kw = $("#search-keyword");

      const tp = $("#search-type");

      const valLower = val.toLowerCase();



      if (valLower === "remote") {

        tp.value = "remote";

      } else if (valLower === "full-time") {

        tp.value = "fulltime";

      } else {

        kw.value = val;

      }

      doSearch();

    });

  });

}



/* ════════════════════════════════════════════════════════════

   CATEGORIES

   ════════════════════════════════════════════════════════════ */

function initCategories() {

  $$(".category-card").forEach((card) => {

    const handleActivate = () => {

      const cat = card.dataset.category;

      const isActive = card.classList.contains("active");

      $$(".category-card.active").forEach((c) => c.classList.remove("active"));

      if (!isActive) card.classList.add("active");

      JobBoard.filterByCategory(cat);

      document

        .getElementById("featured-jobs")

        ?.scrollIntoView({ behavior: "smooth", block: "start" });

    };



    card.addEventListener("click", handleActivate);

    card.addEventListener("keydown", (e) => {

      if (e.key === "Enter" || e.key === " ") {

        e.preventDefault();

        handleActivate();

      }

    });

  });

}



/* ════════════════════════════════════════════════════════════

   COMPANY CARDS

   ════════════════════════════════════════════════════════════ */

function initCompanies() {

  $$(".btn-view-jobs").forEach((btn) => {

    btn.addEventListener("click", (e) => {

      e.stopPropagation();

      const company = btn.dataset.company;

      $("#search-keyword").value = company;

      JobBoard.search(company, "", "");

      document

        .getElementById("featured-jobs")

        ?.scrollIntoView({ behavior: "smooth", block: "start" });

    });

  });



  $$(".company-card").forEach((card) => {

    card.addEventListener("click", (e) => {

      if (e.target.closest(".btn-view-jobs")) return;

      const name = card.dataset.company;

      openModal(

        ICONS.building,

        name,

        `Explore open positions at ${name}. This is a demo portal — company detail pages are not available in this preview.`,

      );

    });

  });



  // View all companies link

  $$(".view-all-link").forEach((btn) => {

    const label = btn.getAttribute("aria-label") || "";

    if (label.includes("compan")) {

      btn.addEventListener("click", () =>

        showToast(

          "All Companies",

          "Showing all verified companies — Demo feature.",

          ICONS.building,

          2500,

        ),

      );

    }

  });

}



/* ════════════════════════════════════════════════════════════

   CTA & MISC BUTTONS

   ════════════════════════════════════════════════════════════ */

function initCTA() {

  $$(".btn-post-job").forEach((btn) =>

    btn.addEventListener("click", () =>

      openModal(

        ICONS.edit,

        "Post a Job",

        "Reach thousands of qualified candidates instantly. This is a demo — actual job posting requires an employer account.",

      ),

    ),

  );



  $$(".btn-talk-sales").forEach((btn) =>

    btn.addEventListener("click", () =>

      openModal(

        ICONS.phone,

        "Talk to Sales",

        "Our team is here to help you find the best hiring solution. This is a demo — contact us at hello@hrm.demo for real enquiries.",

      ),

    ),

  );







  $$(".social-btn").forEach((btn) =>

    btn.addEventListener("click", () =>

      showToast("Social Media", "Follow us — Demo feature.", ICONS.share, 2000),

    ),

  );

}



/* ════════════════════════════════════════════════════════════

   FOOTER LINKS

   ════════════════════════════════════════════════════════════ */

function initFooter() {

  $$(".footer-link, .footer-bottom-link").forEach((link) => {

    link.addEventListener("click", () => {

      const target = link.dataset.scroll;

      if (target) {

        document

          .getElementById(target)

          ?.scrollIntoView({ behavior: "smooth", block: "start" });

      } else if (!link.classList.contains("btn-post-job")) {

        showToast(

          "Navigation",

          link.textContent.trim() + " — Demo feature",

          ICONS.info,

          2500,

        );

      }

    });

  });

}



/* ════════════════════════════════════════════════════════════

   ANIMATED STATISTICS

   ════════════════════════════════════════════════════════════ */

function initCounters() {

  const counters = [

    {

      el: $("#stat-jobs"),

      target: 12480,

      format: (v) => Math.floor(v).toLocaleString("en-IN") + "+",

    },

    {

      el: $("#stat-companies"),

      target: 3200,

      format: (v) => Math.floor(v).toLocaleString("en-IN") + "+",

    },

    {

      el: $("#stat-candidates"),

      target: 1.2,

      format: (v) => v.toFixed(1) + "M",

    },

    { el: $("#stat-rate"), target: 98, format: (v) => Math.floor(v) + "%" },

  ];



  let animated = false;



  function easeOutExpo(t) {

    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

  }



  function animateCounter({ el, target, format }) {

    if (!el) return;

    const duration = 2300;

    const start = performance.now();



    (function tick(now) {

      const progress = Math.min((now - start) / duration, 1);

      el.textContent = format(easeOutExpo(progress) * target);

      if (progress < 1) requestAnimationFrame(tick);

    })(start);

  }



  const observer = new IntersectionObserver(

    (entries) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting && !animated) {

          animated = true;

          counters.forEach(animateCounter);

          observer.disconnect();

        }

      });

    },

    { threshold: 0.4 },

  );



  const section = $(".stats-section");

  if (section) observer.observe(section);

}



/* ════════════════════════════════════════════════════════════

   SCROLL-TRIGGERED REVEAL

   ════════════════════════════════════════════════════════════ */

function initReveal() {

  const observer = new IntersectionObserver(

    (entries) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting) {

          entry.target.classList.add("visible");

          observer.unobserve(entry.target);

        }

      });

    },

    { threshold: 0.1 },

  );



  $$(".reveal").forEach((el) => observer.observe(el));



  // Watch job grid for new cards

  const grid = $("#jobs-grid");

  if (grid) {

    new MutationObserver(() => {

      $$(".reveal:not(.visible)").forEach((el) => observer.observe(el));

    }).observe(grid, { childList: true });

  }

}



/* ════════════════════════════════════════════════════════════

   BACK TO TOP BUTTON

   ════════════════════════════════════════════════════════════ */

function initBackToTop() {

  const btn = document.createElement("button");

  btn.id = "back-to-top";

  btn.title = "Back to top";

  btn.setAttribute("aria-label", "Back to top");

  btn.textContent = "↑";

  Object.assign(btn.style, {

    position: "fixed",

    bottom: "88px",

    right: "28px",

    zIndex: "999",

    width: "42px",

    height: "42px",

    borderRadius: "50%",

    background: "var(--primary)",

    color: "#fff",

    border: "none",

    fontSize: "1.1rem",

    fontWeight: "700",

    cursor: "pointer",

    boxShadow: "0 4px 16px rgba(13,170,152,.4)",

    opacity: "0",

    transform: "scale(0.8)",

    transition: "opacity 0.3s, transform 0.3s",

    fontFamily: "inherit",

  });

  document.body.appendChild(btn);



  window.addEventListener(

    "scroll",

    () => {

      const show = window.scrollY > 400;

      btn.style.opacity = show ? "1" : "0";

      btn.style.transform = show ? "scale(1)" : "scale(0.8)";

      btn.style.pointerEvents = show ? "all" : "none";

    },

    { passive: true },

  );



  btn.addEventListener("click", () =>

    window.scrollTo({ top: 0, behavior: "smooth" }),

  );

}



/* ════════════════════════════════════════════════════════════

   PROFILE CARD PROGRESS

   ════════════════════════════════════════════════════════════ */

function initProfileCard() {

  const fill = $(".progress-fill");

  if (fill) {

    fill.style.width = "0";

    setTimeout(() => {

      fill.style.width = "68%";

    }, 800);

  }

}



/* ════════════════════════════════════════════════════════════

   HERO CONNECTED TECH GRID ANIMATION

   ════════════════════════════════════════════════════════════ */

function initHeroAnimation() {

  const canvas = document.getElementById("hero-canvas");

  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const hero = document.getElementById("hero");

  if (!ctx || !hero) return;



  let width = 0;

  let height = 0;

  let dpr = 1;

  let animationId = null;

  let isVisible = true;



  // Mouse interaction

  const mouse = { x: -1000, y: -1000, active: false, radius: 160 };



  hero.addEventListener("mousemove", (e) => {

    const rect = canvas.getBoundingClientRect();

    mouse.x = e.clientX - rect.left;

    mouse.y = e.clientY - rect.top;

    mouse.active = true;

  });



  hero.addEventListener("mouseleave", () => {

    mouse.active = false;

    mouse.x = -1000;

    mouse.y = -1000;

  });



  const particles = [];

  const getParticleCount = () => {

    if (width < 640) return 28;

    if (width < 1024) return 42;

    return 60;

  };



  function resize() {

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = canvas.parentElement.offsetWidth;

    height = canvas.parentElement.offsetHeight;

    canvas.width = Math.floor(width * dpr);

    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createParticles();

  }



  function createParticles() {

    particles.length = 0;

    const count = getParticleCount();

    for (let i = 0; i < count; i++) {

      // Every 6th node is an accented "Hub" node with concentric rings (like reference img)

      const isHub = i % 6 === 0;

      particles.push({

        x: Math.random() * width,

        y: Math.random() * height,

        vx: (Math.random() - 0.5) * 0.42,

        vy: (Math.random() - 0.5) * 0.42,

        radius: isHub ? Math.random() * 1.5 + 3.5 : Math.random() * 1.2 + 1.8,

        isHub,

        pulsePhase: Math.random() * Math.PI * 2,

        pulseSpeed: 0.025 + Math.random() * 0.02,

        baseAlpha: isHub ? 0.95 : 0.45 + Math.random() * 0.4,

        color: isHub ? "#5DFFDA" : Math.random() > 0.4 ? "#7EFFD9" : "#E6F7F5",

      });

    }

  }



  // Draw subtle cybernetic grid matrix with intersection markers

  function drawGrid(time) {

    const gridSize = 68;

    const offsetX = (time * 0.006) % gridSize;

    const offsetY = (time * 0.003) % gridSize;



    ctx.save();

    ctx.strokeStyle = "rgba(93, 255, 217, 0.09)";

    ctx.lineWidth = 1;



    // Vertical lines

    for (let x = offsetX; x < width; x += gridSize) {

      ctx.beginPath();

      ctx.moveTo(x, 0);

      ctx.lineTo(x, height);

      ctx.stroke();

    }

    // Horizontal lines

    for (let y = offsetY; y < height; y += gridSize) {

      ctx.beginPath();

      ctx.moveTo(0, y);

      ctx.lineTo(width, y);

      ctx.stroke();

    }



    // Micro '+' crosshairs at every other intersection

    ctx.strokeStyle = "rgba(126, 255, 217, 0.12)";

    ctx.lineWidth = 1;

    const step = gridSize * 2;

    for (let x = offsetX + gridSize; x < width; x += step) {

      for (let y = offsetY + gridSize; y < height; y += step) {

        const s = 3.5;

        ctx.beginPath();

        ctx.moveTo(x - s, y);

        ctx.lineTo(x + s, y);

        ctx.moveTo(x, y - s);

        ctx.lineTo(x, y + s);

        ctx.stroke();

      }

    }

    ctx.restore();

  }



  function animate(time) {

    if (!isVisible) return;



    ctx.clearRect(0, 0, width, height);



    // Only draw the square grid — no particles, no lines, no circles

    drawGrid(time || performance.now());



    animationId = requestAnimationFrame(animate);

  }



  // Optimize performance: pause loop when hero is off-screen

  const observer = new IntersectionObserver(

    (entries) => {

      entries.forEach((entry) => {

        isVisible = entry.isIntersecting;

        if (isVisible && !animationId) {

          animationId = requestAnimationFrame(animate);

        } else if (!isVisible && animationId) {

          cancelAnimationFrame(animationId);

          animationId = null;

        }

      });

    },

    { threshold: 0.05 },

  );

  observer.observe(hero);



  window.addEventListener("resize", () => {

    resize();

  });



  resize();

  animationId = requestAnimationFrame(animate);

}



/* ════════════════════════════════════════════════════════════

   INITIALISE ALL

   ════════════════════════════════════════════════════════════ */

// export function initPortal() {

//   JobBoard.init(); // must run first so renderJobs exists

//   initHeroAnimation();

//   initNavbar(); // sets up view-switcher click handlers

//   initModal();

//   initProcessSection();

//   initSearch();

//   initCategories();

//   initCompanies();

//   initCTA();

//   initFooter();

//   initCounters();

//   initReveal();

//   initBackToTop();

//   initProfileCard();

//   // Set default view after all listeners are attached

//   setView("candidate");

// }

export function initPortal() {
  // The old JobBoard is disabled because FeaturedJobs.jsx
  // now renders the jobs section.
  // JobBoard.init();

  initHeroAnimation();
  initNavbar();
  initModal();
  initProcessSection();
  initSearch();
  initCategories();
  initCompanies();
  initCTA();
  initFooter();
  initCounters();
  initReveal();
  initBackToTop();
  initProfileCard();

  setView("candidate");
}
