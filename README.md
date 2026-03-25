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
- OBD2 baseline provider via ELM327/python-OBD
- Dictator left as an explicit extension point

## Quick Start

### Backend

```powershell
uv sync --project apps/api --extra dev
uv run --project apps/api uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

For local camera capture on a Pi or laptop with an attached camera:

```powershell
uv sync --project apps/api --extra dev --extra camera
uv run --project apps/api uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

For real OBD2 testing with an ELM327-compatible adapter:

```powershell
$env:PITSIGHT_PROVIDER_MODE='obd2'
# optional when auto-detection is not enough:
# $env:PITSIGHT_OBD_PORT='COM5'
uv sync --project apps/api --extra dev --extra obd2
uv run --project apps/api uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

For first-pass Dictator USB testing with a serial adapter:

```powershell
$env:PITSIGHT_PROVIDER_MODE='dictator'
# optional when auto-detection is not enough:
# $env:PITSIGHT_DICTATOR_PORT='COM9'
# optional raw capture debug mode:
# $env:PITSIGHT_DICTATOR_RAW_CAPTURE_ENABLED='true'
uv sync --project apps/api --extra dev --extra dictator
uv run --project apps/api uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

For real serial GPS testing on a Pi or laptop:

```powershell
$env:PITSIGHT_GPS_ENABLED='true'
# optional when auto-detection is not enough:
# $env:PITSIGHT_GPS_PORT='COM7'
uv sync --project apps/api --extra dev --extra gps
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
- `http://127.0.0.1:8000/api/v1/events/recent`
- `http://127.0.0.1:8000/api/v1/session/current`
- `http://127.0.0.1:8000/api/v1/settings`
- `http://127.0.0.1:8000/api/v1/device/runtime`
- `http://127.0.0.1:8000/api/v1/gps/status`
- `http://127.0.0.1:8000/api/v1/camera/status`
- `http://127.0.0.1:8000/api/v1/camera/frame.jpg`
- `http://127.0.0.1:8000/api/v1/camera/stream.mjpeg`
- `ws://127.0.0.1:8000/ws/telemetry`

The backend defaults to simulator mode, writes session/sample data to `data/pitsight.db`, and emits live telemetry over:

- `GET /api/v1/telemetry/latest`
- `GET /api/v1/alerts/recent`
- `GET /api/v1/events/recent`
- `GET /api/v1/session/current`
- `WS /ws/telemetry`

Device runtime state is exposed separately over:

- `GET /api/v1/device/runtime`
- `POST /api/v1/device/runtime/heartbeat`

Camera runtime is exposed over:

- `GET /api/v1/camera/status`
- `GET /api/v1/camera/frame.jpg`
- `GET /api/v1/camera/stream.mjpeg`

GPS runtime is exposed separately over:

- `GET /api/v1/gps/status`

For local testing, open a driver or pit route with `?deviceRuntime=1` to make that page report itself as the active Pi dashboard mode.

## Provider Assumptions And TODOs

### OBD2

- implemented as the first real hardware baseline using an ELM327-compatible adapter
- maps supported standard PIDs into the canonical telemetry schema
- preserves partial telemetry when a PID is unavailable
- runtime provider selection still follows backend startup configuration today

### Dictator

- implemented as a USB-first custom serial ECU path, not OBD2
- decoder is intentionally tolerant of variable Dictator field sets and only maps recognized fields into the canonical model
- speed is only populated when Dictator actually supplies it; otherwise the UI can fall back to GPS speed when available
- wireless Dictator transport remains a future slice
- raw capture/debug mode is available to support ongoing decoder hardening against real captured payloads

See [docs/architecture.md](/c:/Users/nicon/PitSight/docs/architecture.md) for the repo structure, telemetry schema, provider interfaces, page layout, and phased implementation plan.

See [docs/canonical_telemetry.md](/c:/Users/nicon/PitSight/docs/canonical_telemetry.md) for the canonical telemetry dictionary, source-to-canonical mapping flow, units, and no-data rules.
