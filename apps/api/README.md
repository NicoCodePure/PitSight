# PitSight API

FastAPI backend for the PitSight MVP.

## Current scope

- simulator telemetry provider
- OBD2 baseline provider via ELM327/python-OBD
- Dictator USB baseline provider with tolerant field mapping
- normalized telemetry schema
- local REST and WebSocket surface
- SQLite session and telemetry logging
- warning engine for oil pressure, water temp, oil temp, and fuel
- wireless Dictator transport left as an explicit extension point

## Provider Selection Rules

- the telemetry provider is chosen explicitly at backend startup through `PITSIGHT_PROVIDER_MODE`
- supported startup providers are `simulator`, `obd2`, and `dictator`
- provider changes saved through the settings API are treated as requested-next-startup state
- live provider hot-switching is intentionally not performed in this build
- current provider selection state is exposed through `GET /api/v1/settings` and `GET /health`

## Run

```powershell
uv sync --extra dev
uv run uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

Browser origins are controlled by `PITSIGHT_CORS_ORIGINS`. Supported formats:

- comma-separated origins: `http://localhost:5173,http://192.168.3.104:5173`
- JSON array: `["http://localhost:5173","http://192.168.3.104:5173"]`
- wildcard: `*`

Example LAN-friendly startup:

```powershell
$env:PITSIGHT_CORS_ORIGINS='http://192.168.3.104:5173'
uv sync --extra dev
uv run uvicorn pitsight_api.main:app --reload --host 0.0.0.0 --port 8000
```

To enable the first camera integration slice:

```powershell
uv sync --extra dev --extra camera
uv run uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

To run against a real ELM327-compatible OBD2 adapter:

```powershell
$env:PITSIGHT_PROVIDER_MODE='obd2'
# optional when auto-detection is not enough:
# $env:PITSIGHT_OBD_PORT='COM5'
uv sync --extra dev --extra obd2
uv run uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

To run the first Dictator USB integration slice:

```powershell
$env:PITSIGHT_PROVIDER_MODE='dictator'
# optional when auto-detection is not enough:
# $env:PITSIGHT_DICTATOR_PORT='COM9'
# optional raw capture debug mode:
# $env:PITSIGHT_DICTATOR_RAW_CAPTURE_ENABLED='true'
uv sync --extra dev --extra dictator
uv run uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

To enable the first serial GPS integration slice:

```powershell
$env:PITSIGHT_GPS_ENABLED='true'
# optional when auto-detection is not enough:
# $env:PITSIGHT_GPS_PORT='COM7'
uv sync --extra dev --extra gps
uv run uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

## Current endpoints

- `GET /health`
- `GET /api/v1/telemetry/latest`
- `GET /api/v1/alerts/recent`
- `GET /api/v1/events/recent`
- `GET /api/v1/session/current`
- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `GET /api/v1/gps/status`
- `GET /api/v1/camera/status`
- `GET /api/v1/camera/frame.jpg`
- `GET /api/v1/camera/stream.mjpeg`
- `WS /ws/telemetry`
- provider runtime metadata is included in `GET /api/v1/settings` and `GET /health`

## Remaining Dictator limits

- wireless Dictator transport is not implemented yet
- the decoder is intentionally generic and should be hardened further with captured real-world payloads
