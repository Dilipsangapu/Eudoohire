# EUODOO HIRE — HR Module

A full-stack hiring platform with a **React SPA** for the public portal and candidate experience, and **Spring Boot + Thymeleaf** server-rendered dashboards for recruiters and client admins. Candidates manage resumes, portfolios and job interest; recruiters post jobs, review applicants and run the hiring pipeline; admins oversee approvals, companies and hire matches. Subscriptions (Free / Basic / Premium) are enforced server-side and paid through Razorpay.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend (SPA) | React 19, Vite, React Router 7, `tech-stack-icons` (Technology SVG icons) |
| Backend | Java 21, Spring Boot 4.1.1 (Web MVC, Security, Validation, DevTools), Lombok |
| Persistence | MongoDB via Spring Data MongoDB (auto index creation) |
| Server UI | Thymeleaf + `thymeleaf-extras-springsecurity6` (recruiter / admin / resume-template pages) |
| Payments | Razorpay Java SDK (orders, signature verification, webhooks, invoices)) |
| Files | Cloudinary with local-disk fallback, signed URLs |
| Documents | Apache PDFBox (resume PDF parsing/generation), Apache POI (DOCX) |
| Build | Maven wrapper (`mvnw`), Vite |

## Architecture Overview

- **Two UI surfaces, one backend:**
  - React SPA (`/frontend`) — public portal, candidate login/registration (5 steps with scrolling), candidate forgot password, recruiter login/registration, admin page, paid (`/paid-dashboard`) and unpaid (`/unpaid-dashboard`) candidate dashboards.
  - Thymeleaf pages served by Spring Boot (`/backend/src/main/resources/templates`) — recruiter (`/recruiter/**`), client‑admin (`/client-admin/**`), and resume template pages (`/candidate/**`).
- **In production the SPA is deployed inside the backend:** `frontend/dist/*` is copied to `backend/src/main/resources/static/`, so everything is served from `http://localhost:8080` with no CORS issues.
- **In development** Vite runs on port 5173 and proxies `/api`, `/candidate`, `/recruiter(?!-)`, `/client-admin`, `/admin(?!-)`, `/css`, `/js`, `/images`, `/static`, `/auth/logout` to port 8080 (see `frontend/vite.config.js`).
- **Shared tech-icon module:** the Thymeleaf pages and the React bundle both use `/js/tech-icons*.js` served from backend static assets.
- **Auth & sessions:** server-side sessions (30 min, HttpOnly, SameSite=Lax cookies), CSRF protection (cookie `XSRF-TOKEN` ⇒ `X-XSRF-TOKEN` header on POSTs), role-based redirects (Admin / Recruiter / Candidate login pages with role-mismatch popups), and a rate-limiting filter.
- **Plan gating is server-authoritative:** Free vs Basic vs Premium checks happen in backend services, so URL manipulation can't bypass plan restrictions.

## Feature Highlights

### Candidates
- 5-step registration, separate candidate login, role-mismatch validation.
- Plan-based dashboard redirection: paid users → `/paid-dashboard`, free users → `/unpaid-dashboard`.
- Premium users do **not** see an "Upgrade to Premium" option.
- Resume upload / preview / download / version history; "active resume" selection.
- ATS Resume Form Builder with per-plan ATS check limits and evaluation history.
- Portfolio projects with approval workflow.
- Interested jobs, recruiter activity feed (views, shortlists, resume downloads), KPIs.
- Subscription upgrade via Razorpay (₹199 Basic / ₹499 Premium — server-side pricing), payment verification, invoices.

### Recruiters
- Thymeleaf dashboard (`/recruiter/dashboard`): create/manage jobs (draft → active → closed), review applicants, shortlist, request hire, release/hire — all actions audited.
- Recruiter activities are recorded server-side only (after successful actions, with dedup).

### Client Admin
- `/client-admin/dashboard`: candidate/resume/portfolio approvals, registrations, companies, hire matches, job descriptions, account settings.

### Job Matching Rules
- Technology SVG icons appear **only** on the full job-description page; plain text chips everywhere else.
- Job listings show only ACTIVE jobs; ATS job targeting enforces `JOB_NOT_ACTIVE` / `JOB_EXPIRED` server-side.
- Every dashboard listing is backed by real MongoDB data (no mock/fallback data).

## Project Structure

```
hr module/
├── frontend/                  # React SPA (Vite)
│   ├── public/                # favicon, icons, redirects, service worker
│   ├── scripts/               # tech-icons generation script
│   └── src/
│       ├── main.jsx, App.jsx  # entry points & routes
│       ├── context/           # AuthContext (session/plan awareness)
│       ├── components/        # shared UI (LoginRoleMismatchModal, TechnologyIcon, ...)
│       ├── Pages/             # Portal, Logins, Registration, Dashboards (+ *Logic.js),
│       │                      # FeaturedJobs, CategoriesSection, FAQSection, AdminPage...
│       └── services/api.js    # typed fetch wrapper (auth, jobs, ATS, payments...)
├── backend/
│   ├── src/main/java/com/euodoo/hire/
│   │   ├── config/            # SecurityConfig, MongoConfig, DataInitializer, filters
│   │   ├── controller/        # REST + MVC controllers (Auth, Candidate, Recruiter,
│   │   │                      # ClientAdmin, Payment, Invoice, Job, Public, ...)
│   │   ├── service/           # business services (AtsService, CandidateService,
│   │   │                      # RecruiterService, PaymentService, ...)
│   │   ├── repository/        # Spring Data MongoDB repositories
│   │   ├── model/             # MongoDB documents & enums
│   │   ├── exception/         # global exception handling
│   │   └── util/
│   ├── src/main/resources/
│   │   ├── static/            # deployed SPA bundle + shared Thymeleaf assets (/css, /js)
│   │   ├── templates/         # recruiter/, admin/, resumetempletes/ Thymeleaf pages
│   │   └── application.properties
│   └── src/test/java/         # unit + controller tests (security, payments, workflows)
└── uploads/                   # local file storage (created at runtime)
```

## Getting Started

### Prerequisites
- Java 21 (JDK)
- Node.js 18+ (LTS recommended)
- MongoDB running locally on `localhost:27017` (or a MongoDB Atlas URI)

### 1. Backend

```bash
cd backend
.\mvnw.cmd spring-boot:run      # Windows
./mvnw spring-boot:run          # macOS / Linux
```

The app starts on **http://localhost:8080**. Spring DevTools auto-restarts on classpath changes during development.

### 2. Frontend (development)

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxies API calls to :8080)
```

### 3. Frontend (production build → deploy into backend)

```bash
cd frontend
npm run build
# then copy the bundle into the backend:
#   dist/*  →  backend/src/main/resources/static/
# rebuild/restart the backend so static assets reload
```

`npm run lint` runs ESLint.

## Configuration

All secrets are supplied via environment variables; the properties file only carries safe defaults:

| Variable | Purpose | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/euodoo_hire` |
| `MONGODB_DATABASE` | Database name fallback | `euodoo_hire` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay credentials | Razorpay *test* keys — set your own |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification | — (empty) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloud file storage | empty ⇒ local-disk fallback |
| `APP_STORAGE_DIR` | Local upload directory | `~/.euodoo-hire/uploads` (absolute) |
| `APP_STORAGE_SIGNING_SECRET` | Signs local file URLs | random per process if unset |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:5173,...` |

### MongoDB Atlas (production)

Run with `--spring.profiles.active=prod` — `application-prod.properties` makes
`MONGODB_URI` and all `CLOUDINARY_*` variables **mandatory** (startup fails
with a clear unresolved-placeholder error if any is missing) and there is no
localhost fallback in that profile. The URI is only read from the environment
and is never logged.

- Database user: `hireeuodoo_db_user`, cluster: `euodoo.bvqcqwt.mongodb.net`.
- **Database name: `euodoo_hire`** — this is what the app's existing collections
  and indexes use; the Atlas cluster already contains it. Do not point at a
  different/new database name or previously stored records will appear missing.
- Recommended URI (password must be URL-encoded):

  `mongodb+srv://hireeuodoo_db_user:<URL_ENCODED_PASSWORD>@euodoo.bvqcqwt.mongodb.net/euodoo_hire?retryWrites=true&w=majority&serverSelectionTimeoutMS=10000&connectTimeoutMS=10000&socketTimeoutMS=60000`

- `/actuator/health` exposes a MongoDB-aware health check for deployment
  probes (details disabled, so no connection state leaks).
- **Connecting to Atlas does not migrate local data.** If existing records live
  only on a local MongoDB, migrate explicitly and safely:

  1. **Back up** the lock: `mongodump --uri="mongodb://localhost:27017/euodoo_hire" --out=./backup-$(date +%F)`
  2. **Export** (verify local writes stopped before the export so both ends match).
  3. **Import:** `mongorestore --uri="mongodb+srv://hireeuodoo_db_user:<PASSWORD>@euodoo.bvqcqwt.mongodb.net/euodoo_hire" --nsInclude="euodoo_hire.*" ./backup-<date>/euodoo_hire`
  4. **Verify** counts per collection match (`mongosh` `db.<collection>.countDocuments()` on both sides), then spot-check one resume record and its Cloudinary file.
  `mongodump`/`mongorestore` preserve `_id`s, so relationships are kept intact. Never run the import twice without a `--drop` decision you have consciously made — imports are additive and don't delete production data.

### Cloudinary

Uploaded resumes use the `euodoo-hire/resumes/<userId>/` folder convention
(`euodoo-hire/profile-pictures/` for profile pictures). Existing files stored
under the older `resumes/` / `profile-pictures/` paths keep working: every
read/delete uses the public id persisted inside the document, never a rebuilt
path. File types are detected from the file's magic bytes (not the client's
declared Content-Type or filename), then re-validated by parsing (PDFBox / POI).
Uploads run with explicit per-call timeouts (`timeout`, `connect_timeout`,
`connection_request_timeout`). In the `prod` profile the app refuses to start
without Cloudinary credentials instead of silently storing candidate documents
on local disk.

> ⚠️ **Important:** if `MONGODB_URI` is set machine-wide (e.g. to an Atlas cluster), Spring Boot uses the URI's database and **ignores** the datasource fallback — starting the app from a fresh terminal can silently point it at a different database. Always start the backend with an explicit `MONGODB_URI` for the environment you intend to use.
>
> ⚠️ When local disk storage is used without `APP_STORAGE_SIGNING_SECRET`, a random per-process secret is generated — file URLs issued before a restart stop working. Set the variable in shared/production environments.

## Development Seed Accounts

Created automatically at startup by `DataInitializer` (only when missing):

| Role | Email | Password | Plan |
|---|---|---|---|
| Client Admin | `admin@euodoo.dev` | `DevAdmin@2024!` | — |
| Recruiter | `recruiter@euodoo.dev` | `Recruiter@2024!` | — |
| Paid Candidate | `candidate.paid@euodoo.dev` | `Candidate@2024!` | PREMIUM |
| Free Candidate | `candidate.free@euodoo.dev` | `Candidate@2024!` | FREE |

> These are demo credentials for local development only. Change them before deploying anywhere public.

## Testing

```bash
cd backend
.\mvnw.cmd test        # ~224 unit/controller/service tests
```

Tests cover authentication/security filters, subscription & payment rules (incl. Razorpay signature verification), job/application workflows, ATS scoring, recruiter activities, shortlists, invoice generation and more.

## Notes

- API orientation: everything under `/api/*` is JSON REST; Thymeleaf routes render HTML.
- For authenticated POST requests from scripts/tools, send the CSRF cookie `XSRF-TOKEN` as the `X-XSRF-TOKEN` header.
- Multipart limits: uploads up to 10 MB.
- Session inactivity timeout: 30 minutes.
