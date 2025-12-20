# Website Ops Hub
A tiny Web & Technical Ops demo: a static site (Middleman) submits leads to an API
(Express + SQLite), which records an event trail so you can inspect what happened
and why.

![Website Ops Hub – overview](docs/screenshots/LiveStatus.png)
---
## What this demonstrates
- Static site + API integration via form submission
- Validation + persistence using SQLite (Docker volume)
- Simple observability via an event feed
- Clear separation between demo mode and dev mode
- Docker Compose–based local setup
---

## Intended audience

This project is designed for:
- technical operations / platform engineers
- full-stack developers
- interview demos and technical take-home reviews

It focuses on **clarity, observability, and correctness**, not feature completeness.

---

## Quick Start (Prebuilt Demo – Recommended)

This project runs entirely via Docker Compose using **prebuilt images**.
No local builds required.

### Clone the repo and start the system
```bash
git clone https://github.com/Punschkrapferl/website-ops-hub.git
cd website-ops-hub
docker-compose -f docker-compose.demo.yml pull
docker-compose -f docker-compose.demo.yml up
```
## Architecture (high level)
```
┌──────────────────────────────┐
│        Static Website        │
│   Middleman (build output)   │
│          served by           │
│            nginx             │
│   http://localhost:3000      │
│   (or :4567 in dev mode)     │
└──────────────┬───────────────┘
               │
               │ POST /api/lead
               │ (form submission)
               ▼
┌──────────────────────────────┐
│        Express API           │
│     http://localhost:8080    │
│                              │
│ - Input validation (Zod)     │
│ - Idempotency handling       │
│ - Transactional writes       │
│ - Event emission             │
└──────────────┬───────────────┘
               │
               │ inserts / reads
               ▼
┌──────────────────────────────┐
│           SQLite             │
│      (Docker volume)         │
│                              │
│ - leads table                │
│ - events table               │
│ - WAL mode enabled           │
└──────────────┬───────────────┘
               │
               │ queried by API
               ▼
┌──────────────────────────────┐
│        Events Feed UI        │
│                              │
│ Shows step-by-step trace:    │
│ - lead_received              │
│ - crm_upsert (mock)          │
│ - notify (mock)              │
└──────────────────────────────┘

```
---
## Lead submission (Contact form)

The contact form is the entry point into the pipeline.  
Submitting the form triggers validation, persistence, and downstream events.

![Contact form – lead submission](docs/screenshots/Contact.png)

---
## Event model
For each lead submission, the API emits a sequence of events:
- `lead_received` – request accepted and validated
- `crm_upsert` – mock downstream CRM integration
- `notify` – mock operations notification
  events are intentionally separate so partial failures are visible in the UI.

![Event feed showing a full lead pipeline](docs/screenshots/Event.png)

---
## What is intentionally simplified

- Integrations (`crm_upsert`, `notify`) are mocked
- Authentication is a shared admin token (demo-only)
- No background workers or message queues
- SQLite instead of a managed database

These choices keep the data flow inspectable and the demo self-contained.

---

## Run modes
### Demo mode (default)
- Static site served by **nginx**
- API requests proxied through nginx
- Same-origin requests (no CORS required)
  Ports:
- Site: `http://localhost:3000`
- API (internal): `http://api:8080`
- API health (direct): `http://localhost:8080/health`
  Run:
```bash
docker-compose -f docker-compose.demo.yml up --build
```
---
### Dev mode (Middleman hot reload)
- Middleman dev server with hot reload
- Browser calls API directly
- API must allow CORS
  Ports:
- Site (dev): `http://localhost:4567`
- API: `http://localhost:8080`
  Run:
```bash
docker compose --profile dev up --build
```
---
## Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
### Environment variables
```env
ADMIN_TOKEN=changeme
CORS_ORIGIN=http://localhost:4567
DB_PATH=/data/app.db
```
- `ADMIN_TOKEN`
  Shared secret for admin-only endpoints.
  Required for destructive operations.
- `CORS_ORIGIN`
  Comma-separated list of allowed origins.
  Required only in dev mode.
- `DB_PATH`
  Path to the SQLite database file inside the container.
---
## API endpoints
### Health
```http
GET /health
```

Returns `200 OK` if the API is running.

---
### Lead ingestion
```http
POST /api/lead
```
- Validates input
- Stores lead in SQLite
- Emits events
- Triggers mock integrations
- Supports idempotency via `Idempotency-Key` header
---
### Events feed
```http
GET /api/events
```
Returns recent events for inspection.
```http
DELETE /api/events
```
Clears the event log.
Requires:
```http
X-Admin-Token: <ADMIN_TOKEN>
```
---
### Admin reset
```http
POST /api/admin/reset
```
Resets all demo data.
Optional query:
```http
?vacuum=1
```

Requires admin token.

---
## Admin authentication
Admin endpoints require a shared secret:
```http
X-Admin-Token: <ADMIN_TOKEN>
```

If `ADMIN_TOKEN` is not configured, the API fails fast on startup.

---

## Security notes (demo scope)

- Admin actions are protected by a shared token embedded at build time
- Tokens are for local demo use only
- No secrets should be committed to the repository
- No user authentication is implemented

This setup is intentionally minimal and not intended for public deployment.

---

## Persistence
- SQLite database stored on a Docker volume
- WAL mode enabled for better concurrency
- Data survives container restarts
---
## Observability
Every significant step emits an event.
The UI displays the event feed as a trace so you can see:
- what succeeded
- what failed
- where the pipeline stopped
---
## Project structure (top level only)
```
website-ops-hub/
├── api/ # Express API + SQLite
├── site/ # Middleman static site
├── docker-compose.yml
├── docker-compose.demo.yml
├── .env.example
└── README.md
```

## Troubleshooting
- **CORS errors in dev mode**
  Ensure `CORS_ORIGIN` includes `http://localhost:4567`
- **404 on `/api/*`**
  Check nginx proxy configuration and trailing slashes
- **API not starting**
  Ensure `ADMIN_TOKEN` is set

Note: Images are published with a placeholder admin token.
  A real ADMIN_TOKEN must be provided at runtime via .env.
---
## License
MIT