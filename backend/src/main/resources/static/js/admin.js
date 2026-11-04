/* Renders the shared sidebar + top bar and loads all data from the real backend API. */
(function () {
    const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
    const SC = {Pending: 'warn', Approved: 'ok', Rejected: 'bad', Active: 'ok', Inactive: 'bad'};
    const bc = t => t === 'Verified' || t === 'Active' ? 'ok' : t === 'Inactive' ? 'bad' : 'warn';
    const pc = t => t === 'Paid' ? 'ok' : 'bad';
    const badge = (t, c) => `<span class="st st-${c}">${esc(t)}</span>`;
    /* Technology/skill name rendered as a PLAIN TEXT chip. POLICY: SVG
       technology icons appear only on the candidate full job-description
       view; admin dashboards (job lists, job details, portfolio approvals)
       keep plain names, so the tech-icons module is no longer consulted. */
    const techPill = t => esc(t);
    const setBadge = (el, t, c) => {
        el.textContent = t;
        el.className = 'st st-' + c;
    };
    const nm = r => r.cells[0].childNodes[0].textContent.trim();

    /* ---- CSRF helper (reads XSRF-TOKEN cookie set by Spring Security) ---- */
    const getCsrf = () => {
        const cookie = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
        return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
    };

    /* ---- API helpers ---- */
    const api = (url, opts = {}) => fetch(url, {credentials: 'include', ...opts}).then(r => {
        if (!r.ok) throw new Error('API error ' + r.status);
        return r.json();
    });
    const post = (url, params = {}) => {
        const search = new URLSearchParams(params).toString();
        return api(url + (search ? '?' + search : ''), {
            method: 'POST',
            headers: {'X-XSRF-TOKEN': getCsrf()}
        });
    };
    const put = (url, body = {}) => {
        return api(url, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrf()},
            body: JSON.stringify(body)
        });
    };

    /* =====================================================================
       MODULE-LEVEL DATA STATE — populated from API on load
       ===================================================================== */
    let SUMMARY = {regs: 0, regPend: 0, rec: 0, co: 0, hm: 0, port: 0, res: 0};
    let REGS = [];      // registrations list from API
    let RECS = [];      // recruiters list from API
    let CANDS = [];     // candidates list from API
    let COS = [];       // companies list from API
    let HM = [];        // hire matches from API
    let REQ = [];       // portfolio requests from API
    let RESUMES = [];   // resume requests from API
    let JOBS = [];      // jobs from API
    let SUBS = [];      // subscriptions from API
    let AGENCIES = [];  // agencies from API
    let SUBMISSIONS = []; // agency submissions from API

    /* ---- Sidebar + top bar ---- */
    const NAV = [
        ['/client-admin/dashboard', 'Overview', 'bi-grid-1x2'],
        ['/client-admin/registrations', 'Registrations', 'bi-person-plus', 'regPend'],
        ['/client-admin/recruiters', 'Recruiters', 'bi-person-badge'],
        ['/client-admin/candidates', 'Candidates', 'bi-person-lines-fill'],
        ['/client-admin/companies', 'Companies', 'bi-buildings'],
        ['/client-admin/hire-matches', 'Hire Matches', 'bi-people', 'hm'],
        ['/client-admin/portfolio-approvals', 'Portfolio Approvals', 'bi-folder-check', 'port'],
        ['/client-admin/resume-approvals', 'Resume Approvals', 'bi-file-earmark-person', 'res'],
        ['/client-admin/job-descriptions', 'Job Descriptions', 'bi-briefcase'],
        ['/client-admin/subscriptions', 'Subscriptions', 'bi-credit-card'],
        ['/client-admin/agencies', 'Agencies', 'bi-building-gear'],
        ['/client-admin/agency-submissions', 'Agency Submissions', 'bi-send-check'],
        ['/client-admin/account-settings', 'Account Settings', 'bi-gear']
    ];
    const navCount = k => `<span class="count" data-nav="${k}"${SUMMARY[k] ? '' : ' hidden'}>${SUMMARY[k] || 0}</span>`;
    const page = location.pathname;
    const title = document.body.dataset.title || 'Client Admin Dashboard';
    const links = NAV.map(n => {
        const active = page === n[0] || (n[0] !== '/client-admin/dashboard' && page.startsWith(n[0]));
        return `<a class="nav-link ${active ? 'active' : ''}" href="${n[0]}" ${active ? 'aria-current="page"' : ''}><i class="bi ${n[2]}"></i>${n[1]}${n[3] ? navCount(n[3]) : ''}</a>`;
    }).join('');

    document.body.insertAdjacentHTML('afterbegin', `
  <div class="offcanvas-lg offcanvas-start sidebar" tabindex="-1" id="sidebar" aria-label="Main navigation">
    <div class="brand"><span class="logo" aria-hidden="true">E</span>Euodoo</div><nav class="nav flex-column py-2">${links}</nav></div>`);
    const main = document.querySelector('main');
    const wrap = document.createElement('div');
    wrap.className = 'app-main';
    wrap.innerHTML = `<header class="topbar d-flex align-items-center gap-2">
    <button class="icon-btn d-lg-none" data-bs-toggle="offcanvas" data-bs-target="#sidebar" aria-label="Open navigation"><i class="bi bi-list fs-4"></i></button>
    <h1>${title}</h1>
    <div class="ms-auto d-flex align-items-center gap-1">
      <button class="btn btn-line d-none d-md-inline-flex align-items-center gap-2"><i class="bi bi-download"></i>Export</button>
      <div class="dropdown"><button class="icon-btn" id="bell" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-label="Notifications"><i class="bi bi-bell fs-5"></i><span class="dot" hidden></span></button><div class="dropdown-menu dropdown-menu-end p-0" id="notif"></div></div>
      <div class="dropdown"><button class="btn d-flex align-items-center gap-2" data-bs-toggle="dropdown" aria-label="Profile menu">
        <span class="rounded-circle d-inline-flex align-items-center justify-content-center" style="width:32px;height:32px;background:var(--brand-soft);color:var(--brand-ink);font-size:.75rem;font-weight:700">CA</span>
        <span class="d-none d-md-inline fw-semibold">Client Admin</span><i class="bi bi-chevron-down small"></i></button>
        <ul class="dropdown-menu dropdown-menu-end"><li><a class="dropdown-item" href="/client-admin/account-settings">Account Settings</a></li><li><a class="dropdown-item" href="#">Sign out</a></li></ul></div>
    </div></header>`;
    main.before(wrap);
    wrap.append(main);

    /* ---- Page loading effect ---- */
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, IN_MS = 1200;

    function showLoader(label, ms) {
        document.body.insertAdjacentHTML('beforeend', `<div id="loader-bar"></div><div id="loader" role="status" aria-live="polite"><div class="ld"><div class="ld-ring"><span>E</span></div><div><div class="ld-text">Loading ${label}&hellip;</div><div class="ld-sub">Please wait a moment</div></div></div></div>`);
        const bar = document.getElementById('loader-bar');
        void bar.offsetWidth;
        bar.style.transition = `width ${ms}ms ease-out, opacity 200ms`;
        bar.style.width = '100%';
        return () => {
            const l = document.getElementById('loader');
            if (!l) return;
            l.classList.add('out');
            bar.style.opacity = '0';
            setTimeout(() => {
                l.remove();
                bar.remove();
            }, 250);
        };
    }

    if (calm) document.documentElement.classList.remove('loading');
    else {
        const done = showLoader(title, IN_MS);
        document.documentElement.classList.remove('loading');
        setTimeout(done, IN_MS);
    }
    addEventListener('pageshow', e => {
        if (e.persisted) {
            document.getElementById('loader')?.remove();
            document.getElementById('loader-bar')?.remove();
        }
    });

    /* ---- Toast + Dialog ---- */
    document.body.insertAdjacentHTML('beforeend', `
   <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index:2000" id="toasts" aria-live="polite"></div>
   <div class="modal fade" id="dlg" tabindex="-1" aria-labelledby="dlg-title" aria-hidden="true">
     <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
       <div class="modal-content shadow border-0" style="border-radius:12px;overflow:hidden">
         <div class="modal-header bg-light border-bottom px-4 py-3">
           <h2 class="modal-title fs-5 fw-bold" id="dlg-title"></h2>
           <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
         </div>
         <div class="modal-body px-4 py-3" id="dlg-body" style="max-height: calc(85vh - 130px); overflow-y: auto;"></div>
         <div class="modal-footer bg-light border-top px-4 py-2">
           <button type="button" class="btn btn-outline-secondary px-3" data-bs-dismiss="modal">Cancel</button>
           <button type="button" class="btn btn-brand px-4 fw-semibold" id="dlg-ok"></button>
         </div>
       </div>
     </div>
   </div>`);
    const dlg = new bootstrap.Modal('#dlg');
    let onOk = null;

    function openDlg({title, body, ok, danger, run}) {
        $('#dlg-title').textContent = title;
        $('#dlg-body').innerHTML = body;
        const b = $('#dlg-ok');
        b.hidden = !ok;
        b.textContent = ok || '';
        b.className = 'btn ' + (danger ? 'btn-danger-line' : 'btn-brand');
        onOk = run;
        dlg.show();
    }

    $('#dlg-ok').addEventListener('click', () => {
        if (!onOk || onOk() !== false) dlg.hide();
    });

    function toast(msg, type = 'ok') {
        const el = document.createElement('div');
        el.className = 'custom-toast shadow-lg toast-' + type;
        el.setAttribute('role', 'status');

        const isBad = type === 'bad';
        const isWarn = type === 'warn';
        const icon = isBad ? 'bi-exclamation-circle-fill' : isWarn ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
        const iconColor = isBad ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981';
        const headerTitle = isBad ? 'Error' : isWarn ? 'Notice' : 'Action Notification';

        el.innerHTML = `
          <div class="custom-toast-header">
            <i class="bi ${icon}" style="color:${iconColor};font-size:1.05rem"></i>
            <strong class="me-auto" style="font-size:0.875rem;letter-spacing:-0.01em">${esc(headerTitle)}</strong>
            <small class="text-muted" style="font-size:0.75rem">just now</small>
            <button type="button" class="btn-close ms-2" style="font-size:0.65rem" aria-label="Close"></button>
          </div>
          <div class="custom-toast-body">
            ${esc(msg)}
          </div>
        `;
        $('#toasts').append(el);
        const closeBtn = el.querySelector('.btn-close');
        if (closeBtn) closeBtn.onclick = () => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 250);
        };
        setTimeout(() => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 250);
        }, 4000);
    }

    /* =====================================================================
       TABLE RENDERING — builds rows from API data
       ===================================================================== */
    const cell = (h, c) => `<td${c ? ` class="${c}"` : ''}>${h}</td>`;
    const tr = (...cs) => `<tr>${cs.map(c => Array.isArray(c) ? cell(c[0], c[1]) : cell(c)).join('')}</tr>`;
    const sub = (a, b) => `${esc(a)}<span class="sub">${esc(b)}</span>`;
    const view = '<button class="btn btn-sm btn-line">View</button>';
    const viewD = '<button class="btn btn-sm btn-line">View details</button>';
    const verifyBtn = ' <button class="btn btn-sm btn-brand">Verify</button>';

    function buildRows() {
        const rows = {};

        // Registrations — all new registrations
        rows['t-new'] = () => REGS.map(r => tr(
            sub(r.name, r.id),
            r.type, r.registered,
            r.plan || '—',
            badge(r.status, SC[r.status] || 'warn'),
            [view, 'text-end']
        ));

        // Pending registrations
        rows['t-pend'] = () => REGS.filter(r => (r.status || '').toLowerCase().includes('pending')).map(r => tr(
            sub(r.name, r.id),
            r.type, r.registered,
            badge(r.payment || '—', pc(r.payment)),
            badge('Pending', 'warn'),
            [`<button class="btn btn-sm btn-brand" data-action="approve-reg" data-id="${esc(r.id)}">Approve</button> <button class="btn btn-sm btn-danger-line" data-action="reject-reg" data-id="${esc(r.id)}">Reject</button>`, 'text-end text-nowrap']
        ));

        // Recruiters
        rows['t-rec'] = () => RECS.map(r => tr(
            sub(r.name, `${r.id || '—'} · ${r.email}`),
            r.company || '—', r.registered,
            badge(r.payment || 'Unpaid', pc(r.payment || 'Unpaid')),
            badge(r.companyVerification || 'Verification required', bc(r.companyVerification || 'Verification required')),
            badge(r.status, SC[r.status] || 'warn'),
            [view + (r.companyVerification === 'Verification required' && r.status !== 'Rejected' ? verifyBtn : ''), 'text-end text-nowrap']
        ));

        // Candidates
        rows['t-cand'] = () => CANDS.map(c => tr(
            sub(c.name, `${c.id || '—'} · ${c.email}`),
            c.registered, c.plan || 'Free',
            badge(c.payment || 'Unpaid', pc(c.payment || 'Unpaid')),
            badge(c.status, SC[c.status] || 'warn'),
            [view + (c.status === 'Pending Approval' || c.status === 'Pending'
                ? ` <button class="btn btn-sm btn-brand" data-action="approve-cand" data-id="${esc(c.id)}">Approve</button> <button class="btn btn-sm btn-danger-line" data-action="reject-cand" data-id="${esc(c.id)}">Reject</button>`
                : ''), 'text-end text-nowrap']
        ));

        // Companies
        rows['t-co'] = () => COS.map(c => tr(
            sub(c.name, c.id),
            [c.recruiterCount || 0, 'text-end'],
            [c.jobCount || 0, 'text-end'],
            badge(c.verification || 'Verification required', bc(c.verification || 'Verification required')),
            badge(c.status || 'Pending', bc(c.status || 'Pending')),
            [viewD + (c.verification === 'Verification required'
                ? ` <button class="btn btn-sm btn-brand" data-action="verify-co" data-id="${esc(c.id)}" data-name="${esc(c.name)}">Verify</button>`
                : ''), 'text-end text-nowrap']
        ));

        // Hire Matches
        rows['t-hm'] = () => HM.map(h => tr(
            h.id || '—',
            h.candidateName || '—',
            sub(h.recruiterName || '—', h.company || '—'),
            h.requested || '—',
            badge(h.fee || '—', h.fee && h.fee !== '—' ? 'ok' : 'warn'),
            badge(h.payment || '—', pc(h.payment || 'Unpaid')),
            badge(h.approval, SC[h.approval] || 'warn'),
            [h.approval === 'Approved'
                ? `<button class="btn btn-sm btn-brand" data-action="release-hm" data-id="${esc(h.id)}" ${h.candidateReleased ? 'disabled' : ''}>${h.candidateReleased ? 'Released' : 'Release Candidate'}</button>`
                : `<button class="btn btn-sm btn-brand" data-action="approve-hm" data-id="${esc(h.id)}">Approve</button>`,
                'text-end']
        ));

        // Agencies
        rows['t-agency'] = () => AGENCIES.map(a => {
            const name = a.agencyName || a.name || 'Agency';
            const code = a.businessRegistrationNumber || a.code || '-';
            const type = a.agencyType || a.type || 'RECRUITMENT';
            const contact = a.representative?.fullName
                ? `${a.representative.fullName} (${a.representative.officialEmail || a.officialEmail || ''})`
                : (a.officialEmail || a.contactNumber || a.contactPersonName || '-');
            const st = (a.registrationStatus || a.status || 'PENDING').toUpperCase();
            const isApproved = st === 'APPROVED';
            const isRejected = st === 'REJECTED';
            const stBadge = badge(st, isApproved ? 'ok' : (isRejected ? 'bad' : 'warn'));
            const actionCol = (!isApproved && !isRejected)
                ? `<button class="btn btn-sm btn-brand" data-action="approve-agency" data-id="${esc(a.id)}" data-name="${esc(name)}">Approve</button> <button class="btn btn-sm btn-line text-danger" data-action="reject-agency" data-id="${esc(a.id)}" data-name="${esc(name)}">Reject</button>`
                : `<span class="badge ${isApproved ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}">${isApproved ? 'Approved' : 'Rejected'}</span>`;

            return tr(
                sub(name, a.id),
                code,
                type,
                contact,
                stBadge,
                [actionCol, 'text-end text-nowrap']
            );
        });

        // Agency Submissions
        rows['t-agency-sub'] = () => SUBMISSIONS.map(s => tr(
            sub(s.candidateName || 'Candidate', s.candidateEmail || ''),
            s.jobTitle || 'Job Role',
            s.agencyName || 'Agency Partner',
            badge(s.status || 'SUBMITTED', s.status === 'APPROVED' || s.status === 'SENT_TO_RECRUITER' ? 'ok' : (s.status === 'REJECTED' ? 'bad' : 'warn')),
            s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-IN') : 'Recent',
            [s.status === 'SUBMITTED'
                ? `<button class="btn btn-sm btn-brand" data-action="approve-sub" data-id="${esc(s.id)}">Approve & Forward</button> <button class="btn btn-sm btn-line text-danger" data-action="reject-sub" data-id="${esc(s.id)}">Reject</button>`
                : (s.status === 'APPROVED' ? `<button class="btn btn-sm btn-line" data-action="release-sub-cand" data-id="${esc(s.id)}">Release</button>` : `<span class="small text-muted">Processed</span>`), 'text-end text-nowrap']
        ));

        // Subscriptions
        rows['t-sub'] = () => SUBS.map(s => {
            const isAct = s.status === 'ACTIVE' && s.active;
            const stClass = isAct ? 'ok' : (s.status === 'PENDING' ? 'warn' : 'bad');
            const stLabel = isAct ? 'Active' : (s.status === 'ACTIVE' ? 'Expired' : s.status);
            const actDate = s.activatedAt ? new Date(s.activatedAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : '—';
            const expDate = s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : '—';
            return tr(
                sub(s.userName || 'User', `${s.userId || '—'} · ${s.userEmail || ''}`),
                s.userRole || '—',
                s.planName || '—',
                `₹${s.amountInr || 0}`,
                badge(stLabel, stClass),
                actDate,
                expDate,
                [`<button class="btn btn-sm btn-line" data-action="view-sub" data-id="${esc(s.id || '')}">Details</button>`, 'text-end text-nowrap']
            );
        });

        return rows;
    }

    /* ---- Fill tables from API data ---- */
    function fillTables() {
        const ROWS = buildRows();
        Object.keys(ROWS).forEach(id => {
            const body = $(`#${id} tbody`);
            if (body) body.innerHTML = ROWS[id]().join('');
        });
    }

    /* ---- Tables: search, status filter, pagination (5 rows per page) ---- */
    const SIZE = 5, state = {};

    function render(id) {
        const t = document.getElementById(id), st = state[id];
        if (!t || !st) return;
        const q = ($(`[data-search="${id}"]`)?.value || '').toLowerCase().trim();
        let s = ($(`[data-status="${id}"]`)?.value || '').toLowerCase();
        if (s.startsWith('all')) s = '';
        const rows = $$('tbody tr', t);
        const hit = rows.filter(r => r.textContent.toLowerCase().includes(q) && (!s || [...r.cells].some(c => c.textContent.trim().toLowerCase() === s)));
        rows.forEach(r => r.dataset.hit = hit.includes(r) ? '1' : '0');
        const pages = Math.max(1, Math.ceil(hit.length / SIZE));
        st.page = Math.min(st.page, pages);
        const from = (st.page - 1) * SIZE;
        rows.forEach(r => r.hidden = true);
        hit.slice(from, from + SIZE).forEach(r => r.hidden = false);
        const emptyEl = $('#' + id + '-empty');
        if (emptyEl) emptyEl.style.display = hit.length ? 'none' : 'block';
        const pagerEl = $('#' + id + '-pager');
        if (pagerEl) pagerEl.innerHTML = `<span>${hit.length ? `Showing ${from + 1}&ndash;${Math.min(from + SIZE, hit.length)} of ${hit.length}` : 'No results'}</span>
      <span class="d-flex gap-1"><button class="btn btn-sm btn-line" data-pg="-1" ${st.page < 2 ? 'disabled' : ''}>Previous</button><button class="btn btn-sm btn-line" data-pg="1" ${st.page >= pages ? 'disabled' : ''}>Next</button></span>`;
    }

    function initTables() {
        $$('.tbl[id]').forEach(t => {
            const w = t.closest('.tbl-wrap');
            if (w.nextElementSibling?.classList.contains('pager')) w.nextElementSibling.remove();
            w.insertAdjacentHTML('afterend', `<div class="pager" id="${t.id}-pager"></div>`);
            state[t.id] = {page: 1};
            render(t.id);
        });
        $$('[data-search],[data-status]').forEach(el => el.addEventListener('input', () => {
            const id = el.dataset.search || el.dataset.status;
            state[id].page = 1;
            render(id);
        }));
        /* Tabs */
        $$('.tab').forEach(tb => tb.addEventListener('click', () => {
            $$('.tab', tb.closest('.tabs')).forEach(x => {
                x.classList.toggle('active', x === tb);
                x.setAttribute('aria-selected', x === tb);
            });
            const sel = $('[data-status="' + (tb.dataset.for || 't-rec') + '"]');
            if (sel) {
                sel.value = tb.dataset.tab;
                sel.dispatchEvent(new Event('input'));
            }
        }));
        /* Sortable headers */
        $$('.tbl[id]').forEach(t => $$('thead th', t).forEach((th, i) => {
            if (/^Actions?$/.test(th.textContent.trim())) return;
            th.innerHTML = `<button class="th-sort" type="button">${th.textContent}</button>`;
            th.setAttribute('aria-sort', 'none');
            th.firstChild.addEventListener('click', () => {
                const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
                $$('thead th[aria-sort]', t).forEach(x => x.setAttribute('aria-sort', 'none'));
                th.setAttribute('aria-sort', dir);
                const key = r => {
                    const x = r.cells[i].textContent.trim();
                    return /^\d{1,2} \w{3} \d{4}$/.test(x) ? Date.parse(x) : isNaN(x) ? x.toLowerCase() : +x;
                };
                const rows = $$('tbody tr', t).sort((a, b) => {
                    const p = key(a), q = key(b);
                    return (p > q ? 1 : p < q ? -1 : 0) * (dir === 'ascending' ? 1 : -1);
                });
                t.tBodies[0].append(...rows);
                state[t.id].page = 1;
                render(t.id);
            });
        }));
    }

    /* ---- Update sidebar badge counts ---- */
    function drawBadges() {
        $$('[data-nav]').forEach(e => {
            e.textContent = SUMMARY[e.dataset.nav] || 0;
            e.hidden = !SUMMARY[e.dataset.nav];
        });
    }

    /* ---- Row detail view ---- */
    const detail = r => {
        const th = $$('thead th', r.closest('table')).map(x => x.textContent.trim());
        openDlg({
            title: nm(r),
            body: '<dl class="row mb-0">' + [...r.cells].map((c, i) => /^Actions?$/.test(th[i]) ? '' :
                `<dt class="col-5 muted fw-medium">${esc(th[i])}</dt><dd class="col-7">${c.innerHTML.replace(/<button[\s\S]*?<\/button>/g, '')}</dd>`).join('') + '</dl>'
        });
    };

    /* =====================================================================
       API-BACKED ACTIONS
       ===================================================================== */
    function approveReg(id, name, type) {
        const endpoint = type === 'Recruiter' ? 'recruiters' : 'candidates';
        openDlg({
            title: 'Approve registration?',
            body: `${esc(name)} will be approved and set to Active.`,
            ok: 'Approve',
            run() {
                post(`/api/admin/data/${endpoint}/${encodeURIComponent(id)}/approve`)
                    .then(() => {
                        toast(name + ' approved', 'ok');
                        reload();
                    })
                    .catch(() => toast('Action failed', 'bad'));
            }
        });
    }

    function rejectReg(id, name, type) {
        const endpoint = type === 'Recruiter' ? 'recruiters' : 'candidates';
        openDlg({
            title: 'Reject registration?',
            body: `${esc(name)} will be rejected.<br><label class="form-label fw-medium mt-2" for="rej-note">Reason (optional)</label><input id="rej-note" class="form-control" value="Rejected by admin">`,
            ok: 'Reject', danger: true,
            run() {
                const reason = $('#rej-note')?.value || 'Rejected by admin';
                post(`/api/admin/data/${endpoint}/${encodeURIComponent(id)}/reject`, {reason})
                    .then(() => {
                        toast(name + ' rejected', 'bad');
                        reload();
                    })
                    .catch(() => toast('Action failed', 'bad'));
            }
        });
    }

    function approveCandidate(id, name) {
        openDlg({
            title: 'Approve candidate?',
            body: `${esc(name)} will be approved and set to Active.`,
            ok: 'Approve',
            run() {
                post(`/api/admin/data/candidates/${encodeURIComponent(id)}/approve`)
                    .then(() => {
                        toast(name + ' approved', 'ok');
                        reload();
                    })
                    .catch(() => toast('Action failed', 'bad'));
            }
        });
    }

    function rejectCandidate(id, name) {
        openDlg({
            title: 'Reject candidate?',
            body: `${esc(name)} will be rejected.<br><label class="form-label fw-medium mt-2" for="rej-note">Reason (optional)</label><input id="rej-note" class="form-control" value="Rejected by admin">`,
            ok: 'Reject', danger: true,
            run() {
                const reason = $('#rej-note')?.value || 'Rejected by admin';
                post(`/api/admin/data/candidates/${encodeURIComponent(id)}/reject`, {reason})
                    .then(() => {
                        toast(name + ' rejected', 'bad');
                        reload();
                    })
                    .catch(() => toast('Action failed', 'bad'));
            }
        });
    }

    function verifyCompany(id, name) {
        openDlg({
            title: 'Verify company?',
            body: `${esc(name)} will be marked as verified.`,
            ok: 'Verify',
            run() {
                post(`/api/admin/data/companies/${encodeURIComponent(id)}/approve`)
                    .then(() => {
                        toast(name + ' verified', 'ok');
                        reload();
                    })
                    .catch(() => toast('Action failed', 'bad'));
            }
        });
    }

    function approveHireMatch(id) {
        openDlg({
            title: 'Approve hire request?',
            body: `Hire match ${esc(id)} will be approved.`,
            ok: 'Approve',
            run() {
                post(`/api/admin/data/hire-matches/${encodeURIComponent(id)}/approve`)
                    .then(() => {
                        toast('Hire match approved', 'ok');
                        reload();
                    })
                    .catch(() => toast('Action failed', 'bad'));
            }
        });
    }

    function releaseCandidate(id) {
        openDlg({
            title: 'Release candidate?',
            body: `Candidate in hire match ${esc(id)} will be released.`,
            ok: 'Release',
            run() {
                post(`/api/admin/data/hire-matches/${encodeURIComponent(id)}/release`)
                    .then(() => {
                        toast('Candidate released', 'ok');
                        reload();
                    })
                    .catch(() => toast('Action failed', 'bad'));
            }
        });
    }

    /* ---- Delegate click events to API actions ---- */
    document.addEventListener('click', e => {
        /* Sign out */
        const a = e.target.closest('a[href="#"]');
        if (a) {
            e.preventDefault();
            if (a.textContent.trim() === 'Sign out') {
                fetch('/api/auth/logout', {method: 'POST', credentials: 'include'})
                    .finally(() => {
                        window.location.href = '/login?logout=true';
                    });
            } else if (a.classList.contains('link')) {
                const li = a.closest('li');
                if (li) openDlg({
                    title: li.querySelector('strong')?.textContent || '',
                    body: li.innerHTML.replace(a.outerHTML, '')
                });
            }
            return;
        }

        const b = e.target.closest('button');
        if (!b || b.disabled) return;

        /* Pager */
        if (b.dataset.pg) {
            const id = b.closest('.pager').id.replace('-pager', '');
            state[id].page += +b.dataset.pg;
            return render(id);
        }

        const label = b.textContent.trim();
        if (label === 'Export') return exportCsv();

        /* Data-action buttons (rendered by buildRows) */
        const action = b.dataset.action;
        if (action) {
            const id = b.dataset.id,
                name = b.dataset.name || b.closest('tr')?.cells[0]?.childNodes[0]?.textContent?.trim() || id;
            if (action === 'approve-reg') {
                const row = b.closest('tr');
                const type = row?.cells[1]?.textContent?.trim();
                return approveReg(id, name, type);
            }
            if (action === 'reject-reg') {
                const row = b.closest('tr');
                const type = row?.cells[1]?.textContent?.trim();
                return rejectReg(id, name, type);
            }
            if (action === 'approve-cand') return approveCandidate(id, name);
            if (action === 'reject-cand') return rejectCandidate(id, name);
            if (action === 'verify-co') return verifyCompany(id, b.dataset.name);
            if (action === 'approve-hm') return approveHireMatch(id);
            if (action === 'release-hm') return releaseCandidate(id);
            if (action === 'approve-agency') {
                openDlg({
                    title: 'Approve Recruitment Agency',
                    body: `
                        <div class="p-2">
                            <p class="mb-2">Are you sure you want to approve <strong>${esc(name)}</strong>?</p>
                            <p class="text-muted small mb-3">Approving will activate the agency administrator's account and grant immediate access to the Agency Dashboard.</p>
                            <div>
                                <label class="form-label fw-semibold small">Approval remarks (optional):</label>
                                <input type="text" id="dlg-agency-remarks" class="form-control" value="Approved by administrator" placeholder="e.g. Verified business license">
                            </div>
                        </div>
                    `,
                    ok: 'Approve Agency',
                    run: () => {
                        const remarks = document.getElementById('dlg-agency-remarks')?.value?.trim() || "Approved by administrator";
                        put(`/api/admin/agencies/${encodeURIComponent(id)}/approve`, { remarks }).then(() => {
                            toast(`Agency "${name}" approved successfully`, 'ok');
                            loadAll().then(() => {
                                fillTables();
                                initTables();
                            });
                        }).catch((err) => {
                            console.error('Approve agency error:', err);
                            toast('Failed to approve agency', 'bad');
                        });
                    }
                });
                return;
            }
            if (action === 'reject-agency') {
                openDlg({
                    title: 'Reject Recruitment Agency',
                    danger: true,
                    body: `
                        <div class="p-2">
                            <p class="mb-2">Are you sure you want to reject <strong>${esc(name)}</strong>?</p>
                            <div>
                                <label class="form-label fw-semibold small">Rejection reason <span class="text-danger">*</span>:</label>
                                <input type="text" id="dlg-agency-reason" class="form-control" value="Registration rejected by administrator" placeholder="Enter rejection reason">
                            </div>
                        </div>
                    `,
                    ok: 'Reject Agency',
                    run: () => {
                        const reason = document.getElementById('dlg-agency-reason')?.value?.trim() || "Registration rejected by administrator";
                        put(`/api/admin/agencies/${encodeURIComponent(id)}/reject`, { reason }).then(() => {
                            toast(`Agency "${name}" rejected`, 'warn');
                            loadAll().then(() => {
                                fillTables();
                                initTables();
                            });
                        }).catch((err) => {
                            console.error('Reject agency error:', err);
                            toast('Failed to reject agency', 'bad');
                        });
                    }
                });
                return;
            }
            if (action === 'approve-sub') {
                const comments = prompt("Review comments (optional):", "Approved by administrator") || "Approved by administrator";
                put(`/api/admin/submissions/${encodeURIComponent(id)}/approve`, { comments }).then(() => {
                    toast('Submission approved and forwarded to recruiter', 'ok');
                    location.reload();
                }).catch(() => toast('Failed to approve submission', 'bad'));
                return;
            }
            if (action === 'reject-sub') {
                const comments = prompt("Rejection comments:", "Candidate rejected by administrator");
                if (comments === null) return;
                put(`/api/admin/submissions/${encodeURIComponent(id)}/reject`, { comments }).then(() => {
                    toast('Submission rejected', 'ok');
                    location.reload();
                }).catch(() => toast('Failed to reject submission', 'bad'));
                return;
            }
            if (action === 'release-sub-cand') {
                put(`/api/admin/submissions/${encodeURIComponent(id)}/release`, {}).then(() => {
                    toast('Candidate released to agency', 'ok');
                    location.reload();
                }).catch(() => toast('Failed to release candidate', 'bad'));
                return;
            }
            if (action === 'view-sub') {
                const sub = SUBS.find(s => s.id === id);
                if (sub) {
                    const isAct = sub.status === 'ACTIVE' && sub.active;
                    const body = `
                        <div class="row g-2">
                            <div class="col-6"><strong>User:</strong> ${esc(sub.userName || '—')}</div>
                            <div class="col-6"><strong>Email:</strong> ${esc(sub.userEmail || '—')}</div>
                            <div class="col-6"><strong>Role:</strong> ${esc(sub.userRole || '—')}</div>
                            <div class="col-6"><strong>Plan:</strong> ${esc(sub.planName || '—')}</div>
                            <div class="col-6"><strong>Amount:</strong> ₹${sub.amountInr || 0}</div>
                            <div class="col-6"><strong>Status:</strong> ${badge(isAct ? 'Active' : sub.status, isAct ? 'ok' : 'warn')}</div>
                            <div class="col-6"><strong>Activated:</strong> ${sub.activatedAt ? new Date(sub.activatedAt).toLocaleString('en-IN') : '—'}</div>
                            <div class="col-6"><strong>Expires:</strong> ${sub.expiresAt ? new Date(sub.expiresAt).toLocaleString('en-IN') : '—'}</div>
                            <div class="col-12 mt-2"><small class="text-muted">Subscription ID: ${esc(sub.id || '—')}</small></div>
                        </div>
                    `;
                    openDlg({ title: 'Subscription Details', body });
                }
                return;
            }
            return;
        }

        /* Fallback: View / View details */
        const r = b.closest('tbody tr');
        if (r && (label === 'View' || label === 'View details')) return detail(r);
    });

    /* =====================================================================
       PORTFOLIO REVIEW QUEUE
       ===================================================================== */
    function portfolio() {
        let cur = 0;
        const list = $('.split .list'), det = $('.split .detail');
        if (!list || !det) return;

        const draw = () => {
            if (!REQ.length) {
                list.innerHTML = '<div class="empty" style="display:block">No portfolio change requests.</div>';
                det.innerHTML = '';
                return;
            }
            list.innerHTML = REQ.map((r, i) => `<button class="item ${i === cur ? 'active' : ''}" data-i="${i}"><strong>${esc(r.candidateName)}</strong> ${badge(r.status, SC[r.status] || 'warn')}<br><span class="muted">${esc(r.title || 'Portfolio change')} · ${esc(r.date)}</span></button>`).join('');
            const r = REQ[cur];

            // The proposed portfolio and the previously approved one are real
            // submissions from MongoDB — never fabricated placeholders.
            const renderProjects = (json, emptyText) => {
                let parsed;
                try {
                    parsed = JSON.parse(json || '[]');
                } catch {
                    return esc(String(json || '—'));
                }
                if (!Array.isArray(parsed)) {
                    if (parsed && typeof parsed === 'object') {
                        return Object.entries(parsed).map(([k, v]) => `<div class="mb-1"><strong>${esc(k)}:</strong> ${esc(String(v))}</div>`).join('');
                    }
                    return esc(String(json || '—'));
                }
                if (!parsed.length) return `<span class="muted">${emptyText}</span>`;
                return parsed.map(p => `<div class="mb-2"><strong>${esc(p.title || 'Untitled')}</strong>${(p.techStack && p.techStack.length) ? ` <span class="tech-icon-row">${p.techStack.map(techPill).join(' ')}</span>` : ''}${p.description ? `<div class="muted">${esc(p.description)}</div>` : ''}${p.projectUrl ? `<div class="muted small">${esc(p.projectUrl)}</div>` : ''}</div>`).join('');
            };

            det.innerHTML = `<h3 class="h-sec">${esc(r.title || 'Portfolio change request')}</h3>
        <p class="muted">Submitted ${esc(r.date)} by ${esc(r.candidateName)} (${esc(r.candidateEmail || '')})${r.reviewedAt ? ` · Reviewed ${esc(String(r.reviewedAt).slice(0, 10))}` : ''}</p>
        <div class="diff mb-3"><div><div class="label-sm">Proposed portfolio</div>${renderProjects(r.proposedChanges, 'No projects in this submission.')}</div>
        <div><div class="label-sm">Currently approved</div>${renderProjects(r.previousChanges, 'No approved portfolio yet.')}</div></div>` +
                (r.status === 'Pending' ? `<label class="form-label fw-medium" for="note">Review note</label><textarea id="note" class="form-control" rows="3" placeholder="Required when rejecting"></textarea><div class="invalid-feedback">Add a note explaining the rejection.</div>
          <div class="mt-3"><button class="btn btn-brand" data-d="Approved">Approve</button> <button class="btn btn-danger-line" data-d="Rejected">Reject</button></div>`
                    : `<div class="label-sm">Review note</div><p>${esc(r.reviewNote || 'No note added.')}</p>`);
        };

        list.onclick = e => {
            const b = e.target.closest('.item');
            if (b) {
                cur = +b.dataset.i;
                draw();
            }
        };
        det.oninput = e => e.target.classList.remove('is-invalid');
        det.onclick = e => {
            const b = e.target.closest('[data-d]');
            if (!b) return;
            const r = REQ[cur], n = $('#note'), d = b.dataset.d;
            if (d === 'Rejected' && n && !n.value.trim()) {
                n.classList.add('is-invalid');
                n.focus();
                return;
            }
            openDlg({
                title: (d === 'Approved' ? 'Approve' : 'Reject') + ' this change?',
                body: `Change request for ${esc(r.candidateName)} will be marked as ${d.toLowerCase()}.`,
                ok: d === 'Approved' ? 'Approve' : 'Reject',
                danger: d === 'Rejected',
                run() {
                    const note = n?.value.trim() || '';
                    const url = `/api/admin/data/portfolio-requests/${encodeURIComponent(r.id)}/${d === 'Approved' ? 'approve' : 'reject'}`;
                    post(url, d === 'Rejected' ? {note} : {})
                        .then(() => {
                            toast(`Change ${d.toLowerCase()}`, d === 'Approved' ? 'ok' : 'bad');
                            reload();
                        })
                        .catch(() => toast('Action failed', 'bad'));
                }
            });
        };
        draw();
    }

    /* =====================================================================
       RESUME REVIEW QUEUE
       ===================================================================== */
    function resumes() {
        let cur = 0;
        const list = $('.split .list'), det = $('.split .detail');
        if (!list || !det) return;

        const draw = () => {
            if (!RESUMES.length) {
                list.innerHTML = '<div class="empty" style="display:block">No resume approval requests.</div>';
                det.innerHTML = '';
                return;
            }
            list.innerHTML = RESUMES.map((r, i) => `<button class="item ${i === cur ? 'active' : ''}" data-i="${i}"><strong>${esc(r.candidateName)}</strong> ${badge(r.status, SC[r.status] || 'warn')}<br><span class="muted">${esc(r.changeType || '')} · ${esc(r.filename)} · ${esc(r.date)}</span></button>`).join('');
            const r = RESUMES[cur];
            const replaces = r.previousVersion && r.previousVersion !== '—'
                ? `<span class="muted"> · replaces ${esc(r.previousVersion)}${r.previousFilename ? ` (${esc(r.previousFilename)})` : ''}</span>`
                : '';
            det.innerHTML = `<div class="d-flex justify-content-between flex-wrap gap-2"><div><h3 class="h-sec">${esc(r.filename)}</h3><p class="muted">Submitted ${esc(r.date)} by ${esc(r.candidateName)} (${esc(r.candidateEmail || '')})${r.reviewedAt ? ` · Reviewed ${esc(String(r.reviewedAt).slice(0, 10))}` : ''}</p></div>
        <div><span class="muted">${esc(r.fileSize)}</span></div></div>
        <div class="diff mb-3"><div><div class="label-sm">Change</div>${esc(r.changeType || '—')} · ${esc(r.resumeVersion || '—')}${replaces}</div>
        <div><div class="label-sm">Submitted file</div>${esc(r.filename)} · ${esc(r.fileSize)}
        <div class="mt-2"><button class="btn btn-sm btn-line" data-preview="${esc(r.id)}"${r.hasFile ? '' : ' disabled'}${r.hasFile ? '' : ' title="The submitted file is no longer available"'}>View resume</button></div></div></div>` +
                (r.status === 'Pending' ? `<label class="form-label fw-medium" for="note">Review note</label><textarea id="note" class="form-control" rows="3" placeholder="Required when rejecting"></textarea><div class="invalid-feedback">Add a note explaining the rejection.</div>
          <div class="mt-3"><button class="btn btn-brand" data-d="Approved">Approve</button> <button class="btn btn-danger-line" data-d="Rejected">Reject</button></div>`
                    : `<div class="label-sm">Review note</div><p>${esc(r.reviewNote || 'No note added.')}</p>`);
        };

        list.onclick = e => {
            const b = e.target.closest('.item');
            if (b) {
                cur = +b.dataset.i;
                draw();
            }
        };
        det.oninput = e => e.target.classList.remove('is-invalid');
        det.onclick = e => {
            const pv = e.target.closest('[data-preview]');
            if (pv) {
                // Streams the exact submitted file through the authenticated admin
                // endpoint; no storage id is exposed to the browser.
                window.open(`/api/admin/data/resume-requests/${encodeURIComponent(pv.dataset.preview)}/file`, '_blank', 'noopener');
                return;
            }
            const b = e.target.closest('[data-d]');
            if (!b) return;
            const r = RESUMES[cur], n = $('#note'), d = b.dataset.d;
            if (d === 'Rejected' && n && !n.value.trim()) {
                n.classList.add('is-invalid');
                n.focus();
                return;
            }
            openDlg({
                title: (d === 'Approved' ? 'Approve' : 'Reject') + ' this resume?',
                body: `${esc(r.filename)} from ${esc(r.candidateName)} will be marked as ${d.toLowerCase()}.`,
                ok: d === 'Approved' ? 'Approve' : 'Reject',
                danger: d === 'Rejected',
                run() {
                    const note = n?.value.trim() || '';
                    const url = `/api/admin/data/resume-requests/${encodeURIComponent(r.id)}/${d === 'Approved' ? 'approve' : 'reject'}`;
                    post(url, d === 'Rejected' ? {note} : {})
                        .then(() => {
                            toast(`Resume ${d.toLowerCase()}`, d === 'Approved' ? 'ok' : 'bad');
                            reload();
                        })
                        .catch(() => toast('Action failed', 'bad'));
                }
            });
        };
        draw();
    }

    /* =====================================================================
       JOB DESCRIPTIONS — Full CRUD for Admin
       ===================================================================== */
    function jobs() {
        let cur = 0, searchQ = '', filterStatus = '', filterCreator = '';
        const list = $('.split .list'), det = $('.split .detail');
        if (!list || !det) return;

        const JOB_STATUS_COLOR = {
            DRAFT: 'warn',
            ACTIVE: 'ok',
            INACTIVE: 'bad',
            PAUSED: 'bad',
            CLOSED: 'bad',
            EXPIRED: 'bad'
        };
        const statusBadge = st => badge(st || '—', JOB_STATUS_COLOR[st] || 'warn');
        const capitalize = str => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

        const fmtSalary = (mn, mx, country) => {
            if (!mn && !mx) return '—';
            const cur = currencyOf(country), s = cur.sym;
            const fmt = v => cur.code === 'INR' && v >= 100000 ? (v / 100000).toFixed(1) + ' L' : v.toLocaleString();
            return mn && mx ? s + fmt(mn) + ' \u2013 ' + s + fmt(mx) : mn ? s + fmt(mn) + '+' : 'Up to ' + s + fmt(mx);
        };
        const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) : '—';

        const filtered = () => JOBS.filter(j => {
            const hay = (j.title + ' ' + (j.companyName || '') + ' ' + (j.creatorName || '') + ' ' + (j.location || '') + ' ' + (j.techStack || []).join(' ')).toLowerCase();
            if (searchQ && !hay.includes(searchQ)) return false;
            if (filterStatus && j.status !== filterStatus) return false;
            if (filterCreator && j.creatorRole !== filterCreator) return false;
            return true;
        });

        const draw = () => {
            const vis = filtered();
            list.innerHTML = vis.length
                ? vis.map(j => {
                    const idx = JOBS.indexOf(j);
                    return `<button class="item ${idx === cur ? 'active' : ''}" data-i="${idx}"><strong>${esc(j.title)}</strong> ${statusBadge(j.status)}<br><span class="muted">${esc(j.companyName || '—')}</span><span class="muted ms-2" style="font-size:.75rem">${esc(j.creatorRole === 'CLIENT_ADMIN' ? '\u00b7 Admin' : '\u00b7 Recruiter')}</span></button>`;
                }).join('')
                : '<div class="empty" style="display:block">No jobs found.</div>';

            const j = JOBS[cur] || (vis.length ? vis[0] : null);
            if (!j) {
                det.innerHTML = '<p class="muted">No jobs to display.</p>';
                return;
            }

            const canActivate = j.status !== 'ACTIVE' && j.status !== 'CLOSED';
            const canDeactivate = j.status === 'ACTIVE';
            const canClose = j.status !== 'CLOSED';

            det.innerHTML = `<div class="d-flex justify-content-between flex-wrap gap-2 mb-3"><div><h3 class="h-sec mb-1">${esc(j.title)}</h3><div class="muted">${esc(j.companyName || '—')} \u00b7 ${esc(j.location || 'Location not specified')}</div><div class="mt-1">${statusBadge(j.status)} ${j.creatorRole === 'CLIENT_ADMIN' ? badge('Admin', 'info') : badge('Recruiter: ' + esc(j.recruiterName || '—'), 'info')}</div></div><div class="d-flex flex-wrap gap-1 align-items-start"><button class="btn btn-sm btn-line" id="jb-edit" data-id="${esc(j.id)}"><i class="bi bi-pencil"></i> Edit</button>${canActivate ? `<button class="btn btn-sm btn-brand" id="jb-activate" data-id="${esc(j.id)}"><i class="bi bi-play-circle"></i> Activate</button>` : ''}${canDeactivate ? `<button class="btn btn-sm" id="jb-deactivate" data-id="${esc(j.id)}" style="background:#f5b73b;color:#fff;border:none"><i class="bi bi-pause-circle"></i> Deactivate</button>` : ''}${canClose ? `<button class="btn btn-sm btn-danger-line" id="jb-close" data-id="${esc(j.id)}"><i class="bi bi-x-circle"></i> Close</button>` : ''}</div></div><div class="row g-2 mb-3"><div class="col-auto"><span class="label-sm">Employment</span><br>${esc(j.employmentType || '—')}</div><div class="col-auto"><span class="label-sm">Work Mode</span><br>${esc(j.workMode || '—')}</div><div class="col-auto"><span class="label-sm">Experience</span><br>${j.minExperienceYears || 0}\u2013${j.maxExperienceYears || 0} yrs</div><div class="col-auto"><span class="label-sm">Salary</span><br>${fmtSalary(j.minSalaryInr, j.maxSalaryInr, j.country || (j.location || '').split(',').pop().trim())}</div><div class="col-auto"><span class="label-sm">Vacancies</span><br>${j.numberOfVacancies || '—'}</div><div class="col-auto"><span class="label-sm">Applications</span><br><strong>${j.applicationCount || 0}</strong></div><div class="col-auto"><span class="label-sm">Deadline</span><br>${fmtDate(j.applicationDeadline)}</div></div><div class="label-sm mb-1">Description</div><p style="white-space:pre-wrap">${esc(j.description || '—')}</p>${j.responsibilities ? '<div class="label-sm mb-1">Responsibilities</div><p style="white-space:pre-wrap">' + esc(j.responsibilities) + '</p>' : ''}${j.techStack && j.techStack.length ? '<div class="label-sm mb-1">Required Skills</div><div class="mb-2 tech-icon-row">' + j.techStack.map(techPill).join(' ') + '</div>' : ''}${j.preferredSkills && j.preferredSkills.length ? '<div class="label-sm mb-1">Preferred Skills</div><div class="mb-2 tech-icon-row">' + j.preferredSkills.map(techPill).join(' ') + '</div>' : ''}${j.educationRequirements ? '<div class="label-sm mb-1">Education</div><p>' + esc(j.educationRequirements) + '</p>' : ''}${j.additionalRequirements ? '<div class="label-sm mb-1">Additional Requirements</div><p>' + esc(j.additionalRequirements) + '</p>' : ''}<hr class="my-3"><div style="font-size:.8rem;color:var(--muted)"><div><i class="bi bi-person-circle"></i> Created by <strong>${esc(j.creatorName || '—')}</strong> (${esc(j.creatorRole || '—')}) on ${fmtDate(j.createdAt)}</div>${j.lastModifiedByName && j.lastModifiedByName !== j.creatorName ? '<div><i class="bi bi-pencil-square"></i> Last modified by <strong>' + esc(j.lastModifiedByName) + '</strong> (' + esc(j.lastModifiedByRole || '—') + ') on ' + fmtDate(j.updatedAt) + '</div>' : ''}</div>`;

            const elEdit = document.getElementById('jb-edit');
            const elAct = document.getElementById('jb-activate');
            const elDeact = document.getElementById('jb-deactivate');
            const elClose = document.getElementById('jb-close');

            if (elEdit) elEdit.onclick = () => openJobModal(j);
            if (elAct) elAct.onclick = () => jobAction(`/api/admin/data/jobs/${j.id}/activate`, 'activate', j.title);
            if (elDeact) elDeact.onclick = () => jobAction(`/api/admin/data/jobs/${j.id}/deactivate`, 'deactivate', j.title);
            if (elClose) elClose.onclick = () => jobAction(`/api/admin/data/jobs/${j.id}/close`, 'permanently close', j.title);
        };

        const jobAction = (url, verb, title) => {
            const isDanger = verb === 'permanently close' || verb === 'deactivate';
            openDlg({
                title: `Confirm Action: ${capitalize(verb)} Job`,
                body: `<p class="mb-0 text-secondary" style="font-size:0.95rem">Are you sure you want to <strong>${esc(verb)}</strong> the job posting <strong>"${esc(title)}"</strong>?</p>`,
                ok: `${capitalize(verb)} Job`,
                danger: isDanger,
                run: () => {
                    post(url)
                        .then(() => {
                            toast(`Job ${verb === 'activate' ? 'activated' : verb === 'deactivate' ? 'deactivated' : 'closed'} successfully!`, 'ok');
                            reload();
                        })
                        .catch(() => toast('Action could not be completed.', 'bad'));
                    return true;
                }
            });
        };

        list.addEventListener('click', e => {
            const b = e.target.closest('.item');
            if (b) {
                cur = +b.dataset.i;
                draw();
            }
        });
        const searchInput = $('.toolbar input[type=search]');
        if (searchInput) searchInput.addEventListener('input', e => {
            searchQ = e.target.value.toLowerCase().trim();
            draw();
        });

        const statusFilter = document.getElementById('jb-filter-status');
        if (statusFilter) statusFilter.addEventListener('change', e => {
            filterStatus = e.target.value;
            draw();
        });

        const creatorFilter = document.getElementById('jb-filter-creator');
        if (creatorFilter) creatorFilter.addEventListener('change', e => {
            filterCreator = e.target.value;
            draw();
        });

        const postBtn = document.getElementById('jb-post-btn');
        if (postBtn) postBtn.onclick = () => openJobModal(null);

        draw();
    }

    /* ---- Country -> City data for the Post/Edit Job form ---- */
    const COUNTRY_CITIES = {
        "India": ["Bengaluru", "Hyderabad", "Chennai", "Mumbai", "Pune", "Delhi", "Gurugram", "Noida", "Kolkata", "Ahmedabad", "Kochi", "Coimbatore", "Visakhapatnam", "Anantapur", "Tirupati", "Vijayawada", "Jaipur", "Indore", "Chandigarh", "Thiruvananthapuram"],
        "United States": ["New York", "San Francisco", "Seattle", "Austin", "Boston", "Chicago", "Los Angeles", "Dallas", "Atlanta", "Denver"],
        "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds"],
        "Canada": ["Toronto", "Vancouver", "Montreal", "Ottawa", "Calgary"],
        "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Canberra"],
        "Germany": ["Berlin", "Munich", "Frankfurt", "Hamburg", "Stuttgart"],
        "France": ["Paris", "Lyon", "Toulouse", "Nice"],
        "Netherlands": ["Amsterdam", "Rotterdam", "Utrecht", "Eindhoven"],
        "Ireland": ["Dublin", "Cork", "Galway"],
        "Singapore": ["Singapore"],
        "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
        "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
        "Qatar": ["Doha"],
        "Japan": ["Tokyo", "Osaka", "Yokohama"],
        "China": ["Shanghai", "Beijing", "Shenzhen", "Guangzhou"],
        "Malaysia": ["Kuala Lumpur", "Penang", "Johor Bahru"],
        "Sri Lanka": ["Colombo", "Kandy"],
        "Bangladesh": ["Dhaka", "Chittagong"],
        "Nepal": ["Kathmandu", "Pokhara"],
        "South Africa": ["Johannesburg", "Cape Town", "Durban"],
        "Brazil": ["Sao Paulo", "Rio de Janeiro"],
        "Spain": ["Madrid", "Barcelona", "Valencia"],
        "Sweden": ["Stockholm", "Gothenburg"],
        "Switzerland": ["Zurich", "Geneva"],
        "New Zealand": ["Auckland", "Wellington"]
    };

    /* ---- Currency per country (drives salary labels, display and saved currency) ---- */
    const CURRENCY = {
        "India": {code: 'INR', sym: '₹'},
        "United States": {code: 'USD', sym: '$'},
        "United Kingdom": {code: 'GBP', sym: '£'},
        "Canada": {code: 'CAD', sym: 'C$'},
        "Australia": {code: 'AUD', sym: 'A$'},
        "Germany": {code: 'EUR', sym: '€'},
        "France": {code: 'EUR', sym: '€'},
        "Netherlands": {code: 'EUR', sym: '€'},
        "Ireland": {code: 'EUR', sym: '€'},
        "Spain": {code: 'EUR', sym: '€'},
        "Singapore": {code: 'SGD', sym: 'S$'},
        "United Arab Emirates": {code: 'AED', sym: 'AED '},
        "Saudi Arabia": {code: 'SAR', sym: 'SAR '},
        "Qatar": {code: 'QAR', sym: 'QAR '},
        "Japan": {code: 'JPY', sym: '¥'},
        "China": {code: 'CNY', sym: 'CN¥'},
        "Malaysia": {code: 'MYR', sym: 'RM'},
        "Sri Lanka": {code: 'LKR', sym: 'Rs '},
        "Bangladesh": {code: 'BDT', sym: '৳'},
        "Nepal": {code: 'NPR', sym: 'Rs '},
        "South Africa": {code: 'ZAR', sym: 'R'},
        "Brazil": {code: 'BRL', sym: 'R$'},
        "Sweden": {code: 'SEK', sym: 'kr '},
        "Switzerland": {code: 'CHF', sym: 'CHF '},
        "New Zealand": {code: 'NZD', sym: 'NZ$'}
    };
    const currencyOf = country => CURRENCY[country] || {code: 'INR', sym: '₹'};

    function updateSalaryCurrency() {
        const cur = currencyOf(document.getElementById('jm-country')?.value);
        const a = document.getElementById('jm-minsal-label'), b = document.getElementById('jm-maxsal-label');
        if (a) a.textContent = `Min Annual Salary (${cur.sym.trim()} ${cur.code})`;
        if (b) b.textContent = `Max Annual Salary (${cur.sym.trim()} ${cur.code})`;
    }

    function fillCountryCity(existing) {
        const cSel = document.getElementById('jm-country'), tSel = document.getElementById('jm-city');
        if (!cSel || !tSel) return;
        const loc = existing ? (existing.location || '').split(',').map(x => x.trim()) : [];
        const country = existing ? (existing.country || loc[1] || '') : '';
        const city = existing ? (existing.city || loc[0] || '') : '';
        const countries = Object.keys(COUNTRY_CITIES);
        if (country && !countries.includes(country)) countries.push(country);
        countries.sort();
        cSel.innerHTML = '<option value="">Select country</option>' + countries.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
        cSel.value = country;
        const loadCities = selCity => {
            const cities = (COUNTRY_CITIES[cSel.value] || []).slice();
            if (selCity && !cities.includes(selCity)) cities.push(selCity);
            tSel.innerHTML = cSel.value
                ? '<option value="">Select city</option>' + cities.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
                : '<option value="">Select country first</option>';
            tSel.value = selCity || '';
        };
        loadCities(city);
        updateSalaryCurrency();
        cSel.onchange = () => {
            loadCities('');
            updateSalaryCurrency();
        };
    }

    function openJobModal(job) {
        const isEdit = !!job;
        const splitCsv = v => (v || []).join(', ');

        const html = `<div class="p-1">
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Job Title *</label><input id="jm-title" class="form-control" placeholder="e.g. Senior Java Architect" value="${job ? esc(job.title || '') : ''}"></div>
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Company Name *</label>
            <input id="jm-company" class="form-control" list="jm-company-list" placeholder="e.g. Cloud Software Solutions" value="${job ? esc(job.companyName || '') : ''}">
            <datalist id="jm-company-list">${COS.map(c => `<option value="${esc(c.name)}"></option>`).join('')}</datalist>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-md-6"><label class="form-label label-sm fw-semibold">Country *</label><select id="jm-country" class="form-select"></select></div>
            <div class="col-md-6"><label class="form-label label-sm fw-semibold">City *</label><select id="jm-city" class="form-select"></select></div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-md-6"><label class="form-label label-sm fw-semibold">Employment Type</label><select id="jm-emptype" class="form-select">${['Full-Time', 'Part-Time', 'Contract', 'Freelance', 'Internship'].map(t => `<option ${job && job.employmentType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="col-md-6"><label class="form-label label-sm fw-semibold">Work Mode</label><select id="jm-workmode" class="form-select">${['WFO', 'WFH', 'HYBRID'].map(t => `<option value="${t}" ${job && job.workMode === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-md-4"><label class="form-label label-sm fw-semibold">Min Exp (yrs)</label><input id="jm-minexp" type="number" min="0" class="form-control" value="${job ? (job.minExperienceYears || 0) : 0}"></div>
            <div class="col-md-4"><label class="form-label label-sm fw-semibold">Max Exp (yrs)</label><input id="jm-maxexp" type="number" min="0" class="form-control" value="${job ? (job.maxExperienceYears || 0) : 0}"></div>
            <div class="col-md-4"><label class="form-label label-sm fw-semibold">Vacancies</label><input id="jm-vac" type="number" min="1" class="form-control" placeholder="Openings" value="${job ? (job.numberOfVacancies || '') : ''}"></div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-md-6"><label id="jm-minsal-label" class="form-label label-sm fw-semibold">Min Annual Salary (₹ INR)</label><input id="jm-minsal" type="number" class="form-control" placeholder="e.g. 1500000" value="${job ? (job.minSalaryInr || '') : ''}"></div>
            <div class="col-md-6"><label id="jm-maxsal-label" class="form-label label-sm fw-semibold">Max Annual Salary (₹ INR)</label><input id="jm-maxsal" type="number" class="form-control" placeholder="e.g. 2500000" value="${job ? (job.maxSalaryInr || '') : ''}"></div>
          </div>
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Required Skills (comma-separated)</label><input id="jm-tech" class="form-control" placeholder="e.g. Java, Spring Boot, MongoDB" value="${job ? esc(splitCsv(job.techStack)) : ''}"></div>
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Preferred Skills (comma-separated)</label><input id="jm-pref" class="form-control" placeholder="e.g. Docker, AWS, Kafka" value="${job ? esc(splitCsv(job.preferredSkills)) : ''}"></div>
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Description *</label><textarea id="jm-desc" class="form-control" rows="4" placeholder="Comprehensive job overview...">${job ? esc(job.description || '') : ''}</textarea></div>
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Responsibilities</label><textarea id="jm-resp" class="form-control" rows="3" placeholder="Key responsibilities and day-to-day duties...">${job ? esc(job.responsibilities || '') : ''}</textarea></div>
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Education Requirements</label><input id="jm-edu" class="form-control" placeholder="e.g. B.Tech / M.Tech in CS or related field" value="${job ? esc(job.educationRequirements || '') : ''}"></div>
          <div class="mb-3"><label class="form-label label-sm fw-semibold">Additional Requirements</label><textarea id="jm-addreq" class="form-control" rows="2" placeholder="Certifications, shift timing, etc.">${job ? esc(job.additionalRequirements || '') : ''}</textarea></div>
          <div class="mb-2"><label class="form-label label-sm fw-semibold">Status</label><select id="jm-status" class="form-select">${['DRAFT', 'ACTIVE'].map(s => `<option value="${s}" ${job && job.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        </div>`;

        openDlg({
            title: isEdit ? 'Edit Job Posting' : 'Post New Job',
            body: html,
            ok: isEdit ? 'Update Job' : 'Publish / Save',
            run: () => {
                const tv = document.getElementById('jm-title')?.value.trim();
                const dv = document.getElementById('jm-desc')?.value.trim();
                const companyName = document.getElementById('jm-company')?.value.trim();
                const country = document.getElementById('jm-country')?.value.trim();
                const city = document.getElementById('jm-city')?.value.trim();
                if (!tv || !dv || !companyName || !country || !city) {
                    toast('Job title, company, country, city and description are required.', 'bad');
                    return false;
                }
                const csvSplit = id => (document.getElementById(id)?.value || '').split(',').map(s => s.trim()).filter(Boolean);
                const numVal = (id, fb = null) => {
                    const v = +(document.getElementById(id)?.value);
                    return isNaN(v) || (v === 0 && fb !== 0) ? fb : v;
                };

                const body = {
                    title: tv,
                    description: dv,
                    responsibilities: document.getElementById('jm-resp')?.value.trim() || null,
                    companyName,
                    country,
                    city,
                    location: `${city}, ${country}`,
                    salaryCurrency: currencyOf(country).code,
                    workMode: document.getElementById('jm-workmode')?.value || 'WFO',
                    employmentType: document.getElementById('jm-emptype')?.value || 'Full-Time',
                    minExperienceYears: numVal('jm-minexp', 0),
                    maxExperienceYears: numVal('jm-maxexp', 0),
                    minSalaryInr: numVal('jm-minsal'),
                    maxSalaryInr: numVal('jm-maxsal'),
                    numberOfVacancies: numVal('jm-vac'),
                    techStack: csvSplit('jm-tech'),
                    preferredSkills: csvSplit('jm-pref'),
                    educationRequirements: document.getElementById('jm-edu')?.value.trim() || null,
                    additionalRequirements: document.getElementById('jm-addreq')?.value.trim() || null,
                    status: document.getElementById('jm-status')?.value || 'DRAFT'
                };

                const url = isEdit ? `/api/admin/data/jobs/${job.id}` : '/api/admin/data/jobs';
                const method = isEdit ? 'PATCH' : 'POST';
                api(url, {
                    method,
                    headers: {'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrf()},
                    body: JSON.stringify(body)
                }).then(() => {
                    toast(isEdit ? 'Job updated successfully!' : 'Job posted successfully!', 'ok');
                    reload();
                }).catch(() => toast('Failed to save job.', 'bad'));
                return true;
            }
        });

        fillCountryCity(job);
    }

    /* ---- Account settings validation ---- */
    function settings() {
        const btn = $('main .btn-brand');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const n = $('#n'), m = $('#e');
            if (!n || !m) return;
            const chk = [[n, !n.value.trim(), 'Name is required.'], [m, !/^\S+@\S+\.\S+$/.test(m.value), 'Enter a valid email address.']];
            chk.forEach(([el, bad, msg]) => {
                el.classList.toggle('is-invalid', bad);
                let f = el.nextElementSibling;
                if (!f || !f.classList.contains('invalid-feedback')) {
                    f = document.createElement('div');
                    f.className = 'invalid-feedback';
                    el.after(f);
                }
                f.textContent = msg;
            });
            if (!chk.some(x => x[1])) toast('Profile saved');
        });
    }

    /* =====================================================================
       OVERVIEW: donut charts + summary counts from API
       ===================================================================== */
    const CC = {green: '#2CE46D', amber: '#F5B73B', red: '#E5594B', grey: '#C4CAD4'};

    function donut(heading, parts) {
        const R = 15.91549430918954, total = parts.reduce((t, p) => t + p[1], 0);
        let acc = 0;
        const at = (p, i) => `data-i="${i}" data-l="${esc(p[0])}" data-n="${p[1]}" data-p="${total ? Math.round(p[1] / total * 100) : 0}"`;
        const segs = parts.map((p, i) => [p, i]).filter(([p]) => p[1]).map(([p, i]) => {
            const pct = p[1] / total * 100;
            const seg = `<circle class="seg" tabindex="0" role="img" aria-label="${esc(p[0])}: ${p[1]} (${Math.round(pct)}%)" ${at(p, i)} cx="21" cy="21" r="${R}" fill="none" stroke="${p[2]}" stroke-width="6" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${25 - acc}"></circle>`;
            acc += pct;
            return seg;
        }).join('');
        return `<div class="chart"><h3 class="h-sec mb-3">${esc(heading)}</h3><div class="d-flex align-items-center gap-3 flex-wrap">
      <svg viewBox="0 0 42 42" class="donut" data-total="${total}" role="group" aria-label="${esc(heading)}: ${parts.map(p => `${p[0]} ${p[1]}`).join(', ')}"><circle cx="21" cy="21" r="${R}" fill="none" stroke="#EDF0F3" stroke-width="6"/>${segs}<text x="21" y="22.5" text-anchor="middle" class="donut-n">${total}</text><text x="21" y="27" text-anchor="middle" class="donut-l">total</text></svg>
      <ul class="legend">${parts.map((p, i) => `<li class="lg" ${at(p, i)}><span class="sw" style="background:${p[2]}"></span>${esc(p[0])}<b>${p[1]}</b><span class="muted">${total ? Math.round(p[1] / total * 100) : 0}%</span></li>`).join('')}</ul></div></div>`;
    }

    function chartHover(box) {
        const tip = document.createElement('div');
        tip.className = 'chart-tip';
        tip.hidden = true;
        document.body.append(tip);
        const reset = () => {
            tip.hidden = true;
            $$('.chart', box).forEach(c => {
                c.classList.remove('hov');
                $$('.on', c).forEach(x => x.classList.remove('on'));
                const sv = $('.donut', c);
                if (sv) {
                    $('.donut-n', sv).textContent = sv.dataset.total;
                    $('.donut-l', sv).textContent = 'total';
                }
            });
        };
        const place = (x, y) => {
            const w = tip.offsetWidth, h = tip.offsetHeight;
            tip.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
            tip.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
        };
        const show = (el, e) => {
            reset();
            const c = el.closest('.chart'), sv = $('.donut', c), i = el.dataset.i;
            if ($(`.seg[data-i="${i}"]`, c)) c.classList.add('hov');
            $$(`[data-i="${i}"]`, c).forEach(x => x.classList.add('on'));
            if (sv) {
                $('.donut-n', sv).textContent = el.dataset.n;
                $('.donut-l', sv).textContent = el.dataset.p + '%';
            }
            tip.innerHTML = `<b>${esc(el.dataset.l)}</b><br>${el.dataset.n} of ${sv?.dataset.total} · ${el.dataset.p}%`;
            tip.hidden = false;
            if (e) place(e.clientX + 14, e.clientY + 16);
            else {
                const r = el.getBoundingClientRect();
                place(r.left + r.width / 2, r.top - tip.offsetHeight - 6);
            }
        };
        box.addEventListener('mouseover', e => {
            const el = e.target.closest('.seg, .lg');
            if (el) show(el, e);
        });
        box.addEventListener('mousemove', e => {
            if (!tip.hidden && e.target.closest('.seg, .lg')) place(e.clientX + 14, e.clientY + 16);
        });
        box.addEventListener('mouseout', e => {
            if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.seg, .lg')) reset();
        });
        box.addEventListener('focusin', e => {
            const el = e.target.closest('.seg');
            if (el) show(el, null);
        });
        box.addEventListener('focusout', reset);
    }

    function drawCharts() {
        let box = $('#ov-charts');
        if (!box) {
            ($('.strip') || $('main')).insertAdjacentHTML('afterend', '<section class="section"><h2 class="h-sec mb-3">At a glance</h2><div id="ov-charts"></div></section>');
            box = $('#ov-charts');
        }
        box.className = 'charts';

        // Build chart data from the API summary + list data
        const recStatuses = RECS.map(r => r.status || 'Pending');
        const coStatuses = COS.map(c => c.verification === 'Verified' ? 'Verified' : 'Awaiting verification');
        const hmStatuses = HM.map(h => h.approval || 'Pending');
        const regStatuses = REGS.map(r => r.status || 'Pending');
        const cnt = (arr, k) => arr.filter(x => x === k).length;

        box.innerHTML = [
            donut('Registrations', [['Active', cnt(regStatuses, 'Active'), CC.green], ['Pending', cnt(regStatuses, 'Pending Approval') + cnt(regStatuses, 'Pending'), CC.amber], ['Rejected', cnt(regStatuses, 'Rejected'), CC.red]]),
            donut('Recruiters', [['Active', cnt(recStatuses, 'Active'), CC.green], ['Pending', cnt(recStatuses, 'Pending Approval') + cnt(recStatuses, 'Pending'), CC.amber], ['Rejected', cnt(recStatuses, 'Rejected'), CC.red]]),
            donut('Companies', [['Verified', cnt(coStatuses, 'Verified'), CC.green], ['Awaiting verification', cnt(coStatuses, 'Awaiting verification'), CC.amber]]),
            donut('Hire matches', [['Approved', cnt(hmStatuses, 'Approved'), CC.green], ['Pending', cnt(hmStatuses, 'Pending'), CC.amber], ['Rejected', cnt(hmStatuses, 'Rejected'), CC.red]])
        ].join('');
        if (!box.dataset.hover) {
            box.dataset.hover = '1';
            chartHover(box);
        }
    }

    function drawOverview() {
        if (!$('[data-ov]')) return;
        drawCharts();
        $$('[data-ov]').forEach(e => e.textContent = SUMMARY[e.dataset.ov] ?? 0);

        // Pending registrations table on overview
        const body = $('#ov-pend');
        if (body) {
            const pend = REGS.filter(r => (r.status || '').toLowerCase().includes('pending')).slice(0, 5);
            body.innerHTML = pend.map(r => tr(sub(r.name, r.id), r.type, r.registered, badge(r.payment || '—', pc(r.payment || 'Unpaid')), badge('Pending', 'warn'))).join('') ||
                '<tr><td colspan="5" class="muted">No registrations are waiting for approval.</td></tr>';
        }
    }

    /* ---- Recruiters page live counts ---- */
    function recUi() {
        const rows = $$('#t-rec tbody tr');
        if (!rows.length) return;
        const n = t => rows.filter(r => [...r.cells].some(c => c.textContent.trim() === t)).length;
        const v = {all: rows.length, vr: n('Verification required'), v: n('Verified'), i: n('Inactive')},
            m = {total: v.all, vr: v.vr, active: n('Active'), inactive: v.i};
        $$('[data-count]').forEach(e => e.textContent = v[e.dataset.count] ?? '');
        $$('[data-m]').forEach(e => e.textContent = m[e.dataset.m] ?? '');
    }

    /* ---- Candidates page live counts ---- */
    function candUi() {
        const rows = $$('#t-cand tbody tr');
        if (!rows.length) return;
        const n = t => rows.filter(r => [...r.cells].some(c => c.textContent.trim() === t)).length;
        const m = {
            cTotal: rows.length,
            cPending: n('Pending') + n('Pending Approval'),
            cActive: n('Active'),
            cInactive: n('Inactive')
        };
        $$('[data-m]').forEach(e => {
            if (e.dataset.m in m) e.textContent = m[e.dataset.m];
        });
        const tabs = {cAll: rows.length, cPend: m.cPending, cAct: m.cActive, cInact: m.cInactive};
        $$('[data-count]').forEach(e => {
            if (e.dataset.count in tabs) e.textContent = tabs[e.dataset.count];
        });
    }

    /* =====================================================================
       NOTIFICATIONS — live from /api/notifications (MongoDB-backed)
       ===================================================================== */
    let _notifData = [];
    let _notifPollTimer = null;

    function fmtTimeAgo(isoStr) {
        if (!isoStr) return '';
        const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function getNotifIcon(type) {
        if (!type) return '&#x1F514;';
        const t = type.toUpperCase();
        if (t.includes('APPROV') || t.includes('ACCEPT')) return '&#x2705;';
        if (t.includes('REJECT')) return '&#x274C;';
        if (t.includes('HIRE') || t.includes('MATCH')) return '&#x1F91D;';
        if (t.includes('PORTFOLIO')) return '&#x1F4C1;';
        if (t.includes('RESUME')) return '&#x1F4C4;';
        if (t.includes('INTERVIEW')) return '&#x1F4C5;';
        if (t.includes('PAYMENT')) return '&#x1F4B3;';
        return '&#x1F514;';
    }

    function drawNotifs() {
        const bell = $('#bell'), dot = bell && $('#bell .dot'), notifBox = $('#notif');
        if (!bell || !notifBox) return;
        const unread = _notifData.filter(n => !n.read).length;
        if (dot) dot.hidden = !unread;
        bell.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications, none unread');

        const header = `<div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
            <strong>Notifications</strong>
            <button class="btn btn-sm btn-line" id="adminMarkAllRead" ${unread ? '' : 'disabled'}>Mark all as read</button>
        </div>`;

        const items = _notifData.length
            ? _notifData.map(n => `<a class="notif-item ${n.read ? '' : 'unread'}" href="${n.actionUrl || '#'}"
                 onclick="markNotifRead('${esc(n.id)}','${esc(n.actionUrl || '')}');event.preventDefault();return false;"
                 style="display:flex;gap:10px;align-items:flex-start;padding:10px 16px;">
                <span style="font-size:18px;flex-shrink:0">${getNotifIcon(n.type)}</span>
                <span style="flex:1;min-width:0">
                    <span style="display:block;font-weight:${n.read ? '400' : '600'};white-space:normal">${esc(n.title || n.message)}</span>
                    ${n.title ? `<span style="display:block;font-size:12px;color:#64748b;white-space:normal">${esc(n.message)}</span>` : ''}
                    <span class="muted small d-block">${fmtTimeAgo(n.createdAt)}</span>
                </span>
                ${!n.read ? `<span style="width:8px;height:8px;border-radius:50%;background:#0d9488;flex-shrink:0;margin-top:4px"></span>` : ''}
              </a>`).join('')
            : `<div class="px-3 py-4 text-center muted" style="font-size:13px">No notifications yet</div>`;

        notifBox.innerHTML = header + `<div style="max-height:340px;overflow-y:auto">${items}</div>`;

        const markAllBtn = document.getElementById('adminMarkAllRead');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => {
                fetch('/api/notifications/read-all', {
                    method: 'POST', credentials: 'include',
                    headers: {'X-XSRF-TOKEN': getCsrf()}
                }).then(() => {
                    _notifData.forEach(n => n.read = true);
                    drawNotifs();
                })
                    .catch(err => console.error('Mark all read failed:', err));
            });
        }
    }

    window.markNotifRead = function (id, actionUrl) {
        if (!id) return;
        fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
            method: 'PATCH', credentials: 'include',
            headers: {'X-XSRF-TOKEN': getCsrf()}
        }).then(() => {
            const n = _notifData.find(x => x.id === id);
            if (n) n.read = true;
            drawNotifs();
            if (actionUrl && actionUrl !== 'null' && actionUrl !== '') window.location.href = actionUrl;
        }).catch(err => console.error('Mark read failed:', err));
    };

    function fetchNotifs() {
        Promise.all([
            fetch('/api/notifications?unreadOnly=false&page=0&size=20', {credentials: 'include'}).then(r => r.ok ? r.json() : []),
            fetch('/api/notifications/unread-count', {credentials: 'include'}).then(r => r.ok ? r.json() : {unreadCount: 0})
        ]).then(([list, countObj]) => {
            _notifData = Array.isArray(list) ? list : (list.content || []);
            drawNotifs();
        }).catch(err => console.error('Notification fetch failed:', err));
    }

    function initNotifications() {
        fetchNotifs();
        if (_notifPollTimer) clearInterval(_notifPollTimer);
        _notifPollTimer = setInterval(fetchNotifs, 25000);
    }

    /* =====================================================================
       CSV EXPORT
       ===================================================================== */
    function exportCsv() {
        const q = v => '"' + String(v).replace(/"/g, '""') + '"', out = [];
        const cellText = c => {
            const k = c.cloneNode(true);
            $$('.sub', k).forEach(x => x.replaceWith(' (' + x.textContent + ')'));
            $$('button', k).forEach(x => x.remove());
            return k.textContent.replace(/\s+/g, ' ').trim();
        };
        $$('.tbl').forEach(t => {
            const th = $$('thead th', t).map(x => x.textContent.trim()),
                keep = th.map((h, i) => /^Actions?$/.test(h) ? -1 : i).filter(i => i >= 0);
            const rows = $$('tbody tr', t).filter(r => r.dataset.hit !== '0' && r.cells.length === th.length);
            out.push(q($('h2', t.closest('section'))?.textContent.trim() || 'Table'), keep.map(i => q(th[i])).join(','), ...rows.map(r => keep.map(i => q(cellText(r.cells[i]))).join(',')), '');
        });
        if (title === 'Portfolio Approvals') out.push(q('Portfolio Change Requests'), ['Candidate', 'Email', 'Date', 'Status', 'Review note'].map(q).join(','), ...REQ.map(r => [r.candidateName, r.candidateEmail, r.date, r.status, r.reviewNote || ''].map(q).join(',')));
        if (title === 'Resume Approvals') out.push(q('Resume Approvals'), ['Candidate', 'Email', 'File', 'Change', 'Version', 'Previous version', 'Size', 'Date', 'Status', 'Review note'].map(q).join(','), ...RESUMES.map(r => [r.candidateName, r.candidateEmail, r.filename, r.changeType || '', r.resumeVersion || '', r.previousVersion || '', r.fileSize, r.date, r.status, r.reviewNote || ''].map(q).join(',')));
        if (title === 'Job Descriptions') out.push(q('Job Descriptions'), ['Title', 'Company', 'Location', 'Status', 'Skills', 'Updated', 'Description'].map(q).join(','), ...JOBS.map(j => [j.title, j.companyName, j.location, j.status, (j.techStack || []).join('; '), j.updatedAt ? new Date(j.updatedAt).toLocaleDateString('en-IN') : '', j.description].map(q).join(',')));
        if (title === 'Subscriptions') out.push(q('Subscriptions'), ['User', 'Email', 'Role', 'Plan', 'Amount (INR)', 'Status', 'Activated At', 'Expires At'].map(q).join(','), ...SUBS.map(s => [s.userName || '', s.userEmail || '', s.userRole || '', s.planName || '', s.amountInr || 0, s.status || '', s.activatedAt || '', s.expiresAt || ''].map(q).join(',')));
        if (!out.length) return toast('There is no data to export on this page.', 'warn');
        const url = URL.createObjectURL(new Blob(['\ufeff' + out.join('\r\n')], {type: 'text/csv;charset=utf-8'}));
        const a = document.createElement('a');
        a.href = url;
        a.download = `euodoo-${title.toLowerCase().replace(/\s+/g, '-')}-export.csv`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('CSV downloaded for ' + title);
    }

    /* ---- Subscriptions page live counts ---- */
    function subUi() {
        if (title !== 'Subscriptions') return;
        const total = SUBS.length;
        const active = SUBS.filter(s => s.status === 'ACTIVE' && s.active).length;
        const rec = SUBS.filter(s => s.userRole === 'RECRUITER').length;
        const cand = SUBS.filter(s => s.userRole === 'CANDIDATE').length;
        const setNum = (k, v) => { const el = $(`[data-sub="${k}"]`); if (el) el.textContent = v; };
        setNum('total', total);
        setNum('active', active);
        setNum('rec', rec);
        setNum('cand', cand);
    }

    /* =====================================================================
       DATA RELOAD — re-fetches all API data and re-renders
       ===================================================================== */
    function reload() {
        dlg.hide();
        loadAll().then(() => {
            fillTables();
            initTables();
            drawBadges();
            drawOverview();
            recUi();
            candUi();
            subUi();
            if (title === 'Portfolio Approvals') portfolio();
            if (title === 'Resume Approvals') resumes();
            if (title === 'Job Descriptions') jobs();
        });
    }

    /* =====================================================================
       MAIN BOOT — fetch all data then render
       ===================================================================== */
    async function loadAll() {
        try {
            const [summary, regs, recs, cands, cos, hm, port, res, jobList, subs, agenciesRes, subsRes] = await Promise.all([
                api('/api/admin/data/summary'),
                api('/api/admin/data/registrations'),
                api('/api/admin/data/recruiters'),
                api('/api/admin/data/candidates'),
                api('/api/admin/data/companies'),
                api('/api/admin/data/hire-matches'),
                api('/api/admin/data/portfolio-requests'),
                api('/api/admin/data/resume-requests'),
                api('/api/admin/data/jobs'),
                api('/api/admin/data/subscriptions').catch(() => []),
                api('/api/admin/agencies?size=100').catch(() => ({content:[]})),
                api('/api/admin/submissions?size=100').catch(() => ({content:[]}))
            ]);
            SUMMARY = summary;
            REGS = regs;
            RECS = recs;
            CANDS = cands;
            COS = cos;
            HM = hm;
            REQ = port;
            RESUMES = res;
            JOBS = jobList;
            SUBS = Array.isArray(subs) ? subs : [];
            AGENCIES = agenciesRes?.content || (Array.isArray(agenciesRes) ? agenciesRes : []);
            SUBMISSIONS = subsRes?.content || (Array.isArray(subsRes) ? subsRes : []);
        } catch (err) {
            console.error('Admin API load failed:', err);
            toast('Could not load dashboard data. Please refresh.', 'bad');
        }
    }

    /* Boot sequence */
    loadAll().then(() => {
        fillTables();
        initTables();
        drawBadges();
        drawOverview();
        recUi();
        candUi();
        subUi();
        initNotifications();
        if (title === 'Portfolio Approvals') portfolio();
        if (title === 'Resume Approvals') resumes();
        if (title === 'Job Descriptions') jobs();
        if (title === 'Account Settings') settings();
    });

})();


document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".site-footer")) return;
    var footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.textContent = "Copyright \u00A9 " + new Date().getFullYear() + " Euodoo Hire. All rights reserved.";
    (document.querySelector("main.page") || document.body).insertAdjacentElement("afterend", footer);
});