# Website Ops Hub

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

```bash
docker compose --profile dev up --build
```
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

## License
MIT