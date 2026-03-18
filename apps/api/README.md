# PitSight API

FastAPI backend for the PitSight MVP.

## Current scope

- simulator telemetry provider
- normalized telemetry schema
- local REST and WebSocket surface
- SQLite session and telemetry logging
- warning engine for oil pressure, water temp, oil temp, and fuel
- extension points for OBD2 and Dictator integrations

## Run

```powershell
uv sync --extra dev
uv run uvicorn pitsight_api.main:app --reload --host 127.0.0.1 --port 8000
```

## Current endpoints

- `GET /health`
- `GET /api/v1/telemetry/latest`
- `GET /api/v1/alerts/recent`
- `GET /api/v1/session/current`
- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `WS /ws/telemetry`

## Stubbed providers

- `obd2`: reserved for future ELM327/python-OBD support
- `dictator`: reserved for future serial raw capture and decoder work
