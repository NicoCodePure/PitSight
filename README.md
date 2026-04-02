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

## Provider Selection

Telemetry provider selection is explicit at backend startup.

- `PITSIGHT_PROVIDER_MODE=simulator` boots the simulator provider
- `PITSIGHT_PROVIDER_MODE=obd2` boots the OBD2 provider
- `PITSIGHT_PROVIDER_MODE=dictator` boots the Dictator provider
- the running provider does not hot-switch when the settings page changes the requested telemetry source
- the settings UI now shows:
  - requested source
  - boot provider
  - active provider
  - whether restart is required
  - current live source connection state

Changing the requested telemetry source in `/settings` saves the desired next provider, but the backend or Pi must be restarted before the running provider changes.

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

Frontend network resolution now follows a simple rule set:

- if `VITE_API_BASE_URL` is set, the frontend uses it directly for REST, media, and WebSocket connections
- otherwise, the frontend uses the current browser host with `VITE_API_PORT` or port `8000`
- local dev therefore still resolves to `http://localhost:8000` when you open the app on `localhost:5173`
- Pi/LAN testing works without code edits when the frontend and backend are on the same Pi host and the backend is reachable on port `8000`

Backend browser access control is now environment-driven through `PITSIGHT_CORS_ORIGINS`. It accepts either:

- a comma-separated string such as `http://localhost:5173,http://192.168.3.104:5173`
- a JSON array string such as `["http://localhost:5173","http://192.168.3.104:5173"]`
- `*` when you intentionally want to allow all origins

## LAN / Pi Notes

For Raspberry Pi or LAN testing where another machine opens the frontend:

1. Start the backend on a LAN-reachable interface:

```powershell
uv run --project apps/api uvicorn pitsight_api.main:app --reload --host 0.0.0.0 --port 8000
```

2. Set backend CORS to allow the frontend origin:

```powershell
$env:PITSIGHT_CORS_ORIGINS='http://192.168.3.104:5173'
```

3. Start the frontend on a LAN-reachable interface:

```powershell
cd apps/web
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

4. Open the frontend from the same Pi host or another LAN machine at:

- `http://192.168.3.104:5173/driver/normal`
- `http://192.168.3.104:5173/driver/lemons`
- `http://192.168.3.104:5173/pit`
- `http://192.168.3.104:5173/settings`

If the frontend and backend are not on the same host, set:

```powershell
$env:VITE_API_BASE_URL='http://<pi-or-api-host>:8000'
```

before starting the frontend dev server or building the frontend.

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

Provider runtime selection state is exposed through:

- `GET /api/v1/settings`
- `GET /health`

Look for the `provider_runtime` block to see boot provider, requested provider, active provider, and restart-required state.

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
