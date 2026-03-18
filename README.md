# PitSight

PitSight is a local-first MVP for in-car telemetry and pit monitoring aimed at amateur motorsport and endurance racing.

The starter scaffold is organized around four boundaries:

- `apps/api`: FastAPI backend, simulator provider, local WebSocket/API, logging, and SQLite storage
- `apps/web`: React frontend for the driver display and pit dashboard
- `shared/contracts`: normalized telemetry contract shared across backend/frontend
- `docs`: architecture, screen structure, and phased MVP plan

## Local MVP Scope

The current scaffold is intentionally biased toward local laptop development before Raspberry Pi deployment:

- simulator provider first
- driver UI first
- local API and WebSocket stream
- SQLite session storage and telemetry logging
- pit dashboard starter
- OBD2 and Dictator left as explicit extension points

## Quick Start

### Backend

```powershell
uv sync --project apps/api --extra dev
uv run --project apps/api uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd apps/web
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Expected URLs

### Frontend routes

- `http://127.0.0.1:5173/driver/normal`
- `http://127.0.0.1:5173/driver/lemons`
- `http://127.0.0.1:5173/pit`
- `http://127.0.0.1:5173/settings`

### Backend routes

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/api/v1/telemetry/latest`
- `http://127.0.0.1:8000/api/v1/alerts/recent`
- `http://127.0.0.1:8000/api/v1/session/current`
- `http://127.0.0.1:8000/api/v1/settings`
- `ws://127.0.0.1:8000/ws/telemetry`

The backend defaults to simulator mode, writes session/sample data to `data/pitsight.db`, and emits live telemetry over:

- `GET /api/v1/telemetry/latest`
- `GET /api/v1/alerts/recent`
- `GET /api/v1/session/current`
- `WS /ws/telemetry`

## Provider Assumptions And TODOs

### OBD2

- intentionally stubbed
- will use an ELM327-compatible adapter
- will map only supported PIDs into the normalized telemetry schema
- must preserve partial telemetry when a PID is unavailable

### Dictator

- intentionally stubbed
- treated as a custom serial ECU integration, not OBD2
- raw capture/debug mode comes before full decoding
- decoder work remains blocked on captured payload samples

See [docs/architecture.md](/c:/Users/nicon/PitSight/docs/architecture.md) for the repo structure, telemetry schema, provider interfaces, page layout, and phased implementation plan.
