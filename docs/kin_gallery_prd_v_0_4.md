# KinGallery

## 1 — Executive Summary
Build **KinGallery**, an ad‑free, self‑hosted, open‑source Progressive Web App for sharing family photos and videos. The stack is **Astro + TailwindCSS** on the front end, **SQLite** for metadata, and the local filesystem for media storage. Authentication and secure remote access are handled entirely by **Cloudflare Tunnels + Cloudflare Access**. Deployment targets a single Linux server (Docker Compose). Future hooks exist for optional cloud backups and object storage, but v1 focuses on low‑maintenance home‑server operation.

---

## 2 — Goals / Non‑Goals
| | Goals | Non‑Goals |
|---|---|---|
| **G‑1** | Private, invite‑only media grouped by child and date | Public social networking features |
| **G‑2** | Installable PWA (iOS/Android) with offline caching | Native App Store releases |
| **G‑3** | Earth‑tone green UI, ❤️ reactions, comments | Full image‑editing suite, stories, reels |
| **G‑4** | All authenticated users may upload; admins moderate | Complex enterprise role matrix |
| **G‑5** | 100 % ad‑free, data lives on family server | Ad‑tech or external trackers |
| **G‑6** | AirPlay slideshow support | Chromecast (stretch goal) |

---

## 3 — Personas
1. **Admin (Parent)** — uploads, curates, oversees users
2. **User (Relative/Grandparent)** — views, comments, uploads
3. **Future Self** — exports and restores archives years later

---

## 4 — User Stories (MVP)
| ID | As a… | I want to… | So that… |
|----|-------|-----------|----------|
| U‑01 | Any user | Upload photos/videos with no length limit | Share memories easily |
| U‑02 | System | Auto‑group uploads by Month → Day | Browsing feels organized |
| U‑03 | User | “Add to Home Screen” (PWA) | Site behaves like an app |
| U‑04 | User | Browse Recents, ❤️, comment | Engage quickly |
| U‑05 | Admin | Grant/revoke access via Cloudflare Access groups | Control privacy |
| U‑06 | Any | AirPlay a slideshow to the TV | Share in the living room |
| U‑07 | Admin | Bulk‑download originals | Keep personal backups |

*Stretch*: “Year‑in‑Review” montage; Chromecast casting.

---

## 5 — Functional Requirements
### 5.1 Authentication & Authorization
* Cloudflare Access provides identity (email based).
* Roles: `admin`, `user`. Role assignment happens in‑app: if an email from the Cloudflare Access JWT is unseen, a record is auto‑created with role `user`; admins can manually promote/demote later.
* No SMTP or password flow required.

### 5.2 Upload & Processing
* Accepted: JPEG, HEIC, PNG, GIF, MP4, MOV (no hard video‑length cap).
* **Image pipeline** — resize to `thumb` and `medium`; keep original.
* **Video pipeline** — transcode/normalize to H.264 + poster frame.
* **Tooling** — `ffmpeg` for both images and video. Benchmark later vs `sharp` for speed/quality trade‑offs.

### 5.3 Browsing UI
* **Albums Grid** — Year → Month hero tile.
* **Recents Feed** with comments and ❤️.
* **Select Mode** — bulk download/share.

### 5.4 PWA Features
* Service Worker caches the last *N* items.
* Offline comment and upload queue.
* Web manifest: name, icons, display = standalone, theme = Kin green.

### 5.5 Comments & Reactions
* Plain‑text comments, single ❤️ reaction. Users can edit or delete their own comments; admins can delete any comment.
* Browser push notifications (stretch).

### 5.6 Admin Dashboard
* Media library table: filters, delete, rotate, set cover.
* User list read‑only (actual access controlled in Cloudflare dashboard).

---

## 6 — Non‑Functional Requirements
| Category | Requirement |
|---|---|
| **Performance** | First contentful paint ≤ 2 s on LTE; media endpoints must return long‑lived `Cache‑Control` headers (e.g., `public, max‑age=31536000, immutable`) so Cloudflare edge cache serves images and thumbnails. |
| **Security** | Site reachable only through Cloudflare Tunnel; HTTPS enforced |
| **Privacy** | No trackers; **Cloudflare Web Analytics** only |
| **Backup** | **TODO** nightly tar of `/media` + SQLite dump; optional `rclone` to S3‑compatible bucket |
| **Accessibility** | WCAG 2.1 AA; earth‑tone palette with sufficient contrast |
| **License** | MIT (or Unlicense) — public code, no warranty |

---

## 7 — Tech Stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Astro + TailwindCSS | Islands architecture, fast PWA |
| Styling | Custom Tailwind theme in earth greens |
| Backend | Astro API routes with `@astrojs/node` (`mode: standalone`) |
| Runtime | **Node 20 LTS** |
| Database | SQLite |
| Media Store | Local filesystem (`/media/{child}/{YYYY}/{MM}/{slug}.{ext}`) |
| Processing | `ffmpeg` (benchmark vs `sharp` for images) |
| Deployment | Docker Compose; Astro standalone Node server exposed through Cloudflare Tunnel (Cloudflare terminates HTTPS) |
| Analytics | Cloudflare Web Analytics |
| **Language** | **TypeScript (strict)** | All application code is authored in TypeScript; no plain JavaScript source files |

---

## 8 — Data Model (Draft)
| Table | Columns |
|-------|---------|
| `users` | id, email, role (`admin/user`), created_at |
| `children` | id, name, birthdate, cover_media_id |
| `media` | id, child_id, filename, type(photo/video), taken_at, width, height, size_bytes, sha256, created_at |
| `comments` | id, media_id, user_id, body, created_at |

---

## 9 — Backup & Recovery
1. Local nightly cron creates `backup‑YYYYMMDD.tar.gz` containing `/media/**` and `sqlite.db`.
2. **TODO** optional script: `rclone sync` tarball to S3‑compatible bucket (e.g., Backblaze B2, Cloudflare R2).

---

## 10 — Open Points
1. **ffmpeg vs sharp** — decide post‑benchmark.
2. **AirPlay UX** — implement a dedicated AirPlay picker (via `HTMLMediaElement.webkitShowPlaybackTargetPicker()`) and a slideshow “Play” button that auto‑advances through images/videos at a configurable interval.
   *Action*: finalize slideshow UI/controls.

---

## 11 — Branding Starter Kit
| Element | Suggested Value |
|---------|-----------------|
| **Primary HEX** | `#3B6F49` (Forest) |
| **Secondary** | `#6F8F6B` (Moss), `#A7C4A0` (Sage) |
| **Accent** | `#EFE7DB` (Parchment) |
| **Font Pairing** | Headings – Inter or Nunito Sans; Body – system‑UI stack |
| **Logo Idea** | Line‑art leaf whose veins form a camera aperture; doubles as PWA icon (512×512 SVG) |

---

## 12 — Distribution Philosophy
KinGallery is publicly hosted on GitHub **only as a personal OSS reference**.
* No roadmap promises for external users.
* PRs accepted only if they match the maintainer’s needs.
* README will state: *“Use at your own risk. No support or SLA.”*

---

## 13 — Roadmap (MVP → v1)
| Phase | Milestone | Notes |
|-------|-----------|-------|
| 0 | Tech spike: Astro PWA + image upload | Validate Service Worker & resizing |
| 1 | Core browsing & comment MVP | Auth via Cloudflare Access |
| 2 | AirPlay slideshow | Verify TV casting |
| 3 | Bulk select & download | ZIP originals |
| 4 | Backup automation, docs | Ready for long‑term usage |

---

## 14 — Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Disk fills up | Configurable quota + disk‑free monitor alert |
| PWA quirks on iOS | Test on iOS ≥ 17; offline queue retries |
| Legal (COPPA) | Private by default; no public sharing |

---

## 15 — Testing & Continuous Integration
* **Unit Tests** — model and utility functions covered via Vitest (runs in Node and Astro components).
* **Integration Tests** — API routes and database operations exercised with an in‑memory SQLite instance.
* **End‑to‑End (E2E)** — Playwright scripts simulate user flows (login via Cloudflare Access stub, upload, browse, comment, AirPlay picker).
* **Visual Regression** — Lighthouse + Playwright screenshot diff on critical pages; fail CI if contrast or layout drifts beyond threshold.
* **Performance Budget** — automated Lighthouse PWA audit gate ≥ 90 for Performance & Best‑Practices.
* **CI Pipeline (GitHub Actions)** —
  1. `npm ci`
  2. Lint (`biome` or `eslint`), type‑check (`tsc`), unit/integration tests.
  3. Spin Docker Compose stack, run Playwright E2E.
  4. Upload coverage report, Lighthouse scores.
* **Branch Protection** — main blocked unless all tests & budgets pass.
* **Versioning** — Semantic Versioning with changelog; automated release notes via `semantic‑release`.

---

