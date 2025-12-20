# Website Ops Hub
<<<<<<< HEAD

A tiny Web & Technical Ops demo: a static site (Middleman) submits leads to an API (Express + SQLite), which records an event trail so you can inspect what happened and why.

## What this demonstrates
- Static site + API integration via a form submission
- Validation + persistence (SQLite volume)
- Simple “observability”: an event feed showing each step in the flow
- Docker Compose setup for local spin-up

## Architecture (high level)
**Site (nginx + built static files)** → `POST /api/lead` → **API (Express)** → **SQLite** → **Events feed** displayed in the UI.

### Event model
For each lead submission, the API emits events like:
- `lead_received` (request accepted)
- `crm_upsert` (mock downstream system step)
- `notify` (mock ops notification step)

These are intentionally separate events so the UI can show a trace of the pipeline.

## Quickstart (Docker)
### Prereqs
- Docker + Docker Compose

### Run
```bash
docker compose up --build
```

Open:
- Site: `http://localhost:3000`
- API health: `http://localhost:8080/health`

### Local dev (optional)
If you use the Middleman dev server (hot reload):

=======
A Web & Technical Operations demo project showing how a **static website**
can be reliably connected to backend services, automation logic, and
observable data flows.
---
## Quick Start (Prebuilt Demo – Recommended)

This project runs entirely via Docker Compose using **prebuilt images**.
No local builds required.

### Clone the repo and start the system
```bash
git clone https://github.com/Punschkrapferl/website-ops-hub.git
cd website-ops-hub
docker-compose -f docker-compose.demo.yml pull
docker-compose -f docker-compose.demo.yml up -d
```
### Stop
```bash
docker compose -f docker-compose.demo.yml down

```
---
## Overview
Website Ops Hub demonstrates a realistic Web & Technical Operations setup:
- A static website collects leads via a form
- Data is sent to a backend API
- Validated data is persisted
- Each processing step emits observable events
  The goal is to make data flows **transparent, inspectable, and reliable**.
---
## Architecture
High-level data flow:
```
Static Site (Middleman)
          |
          v
    POST /api/lead
          |
          v
  Backend API (Express)
          |
          v
        SQLite
          |
          v
 Events Feed (/events)
```
- The static site is served via **nginx**
- API requests are proxied to the backend
- State-changing actions emit structured events
---
## Tech Stack
- **Static site:** Middleman, HTML, CSS, JavaScript, Bootstrap
- **Backend API:** Node.js (Express)
- **Persistence:** SQLite (Docker volume)
- **Reverse proxy:** nginx
- **Containerization:** Docker, Docker Compose
- **Version control:** GitHub (pull requests, protected branches)
---
## Features
- Validated lead ingestion
- Idempotency handling for duplicate submissions
- Structured event trail per request
- Health endpoint for monitoring
- Admin-protected reset endpoint (demo use)
- Environment-based configuration
---
## Relevance to Web & Technical Operations
This project directly mirrors common Web & Technical Operations tasks:
- Maintaining a code-driven static website
- Connecting website forms to backend systems
- Designing reliable data flows with validation and persistence
- Troubleshooting system behavior using observable events
- Working with GitHub pull requests and branch protection
---
## Local Development (build from source)
Start the full stack locally using Docker Compose:
>>>>>>> parent of 051251e (merge: sync safety branch with trunk)
```bash
docker-compose -f docker-compose.yml up --build
```
<<<<<<< HEAD
Open:
- Site dev: `http://localhost:4567`
Note: in dev mode the API sets CORS to allow the dev origin.

### Configuration
Environment variables:
Copy `.env.example` to `.env` and adjust if needed:
```bash
cp .env.example .env
```
#### Important
- `ADMIN_TOKEN` is used by the site to send admin actions (e.g. clearing events). Do not commit real tokens.

### API endpoints (summary)
- `GET /health` → healthcheck
- Site → nginx → API: `POST /api/lead` (proxied to API `POST /lead`)
- `GET /events` → list recent events
- `DELETE /events` → clear events (requires admin token)

If your site proxies under `/api/`, routes are accessible as `/api/...` on the site domain.

## Troubleshooting
- If `localhost:3000` doesn't load: run `docker compose ps` and check the `site` container status/logs.
- If the API returns "Cannot GET /": that's normal unless you implemented a root route. Use `/health`.
- If `depends_on: condition: service_healthy` blocks: ensure the API has a working healthcheck and `/health` returns 200.

=======
After startup:
- Website: http://localhost:3000
- API health: http://localhost:8080/health
- Events view: http://localhost:3000/events.html
---
## Future Improvements
- Integrate a real CRM or webhook-based downstream system
- Add retry logic and dead-letter handling
- Expose basic metrics (lead count, error rate)
- Extend documentation for non-technical stakeholders
---
>>>>>>> parent of 051251e (merge: sync safety branch with trunk)
## License
MIT