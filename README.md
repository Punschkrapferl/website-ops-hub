# Website Ops Hub
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
```bash
docker-compose -f docker-compose.yml up --build
```
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
## License
MIT