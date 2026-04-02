# PitSight MVP Architecture

## Repo Structure

```text
PitSight/
├── apps/
│   ├── api/
│   │   ├── pyproject.toml
│   │   └── src/pitsight_api/
│   │       ├── api/
│   │       ├── core/models/
│   │       ├── protocol/
│   │       ├── providers/
│   │       ├── services/
│   │       ├── storage/
│   │       └── transport/
│   └── web/
│       ├── package.json
│       └── src/
│           ├── api/
│           ├── components/
│           ├── hooks/
│           ├── pages/
│           ├── types/
│           └── utils/
├── docs/
├── shared/contracts/
└── README.md
```

## Architecture Boundaries

- `transport`: physical link handling such as serial, USB, or Bluetooth sockets
- `protocol`: byte/string decoding for ELM327 or Dictator-specific payloads
- `normalized telemetry model`: optional-field snapshot shape used everywhere above the protocol layer
- `providers`: source-specific orchestration that turns transport/protocol data into normalized snapshots
- `services`: session lifecycle, warnings, persistence, and broadcast
- `ui`: driver display and pit dashboard consuming the same normalized stream

## Normalized Telemetry Schema

The normalized payload is snapshot-based, not packet-based. Every emission is a best-effort state view with optional fields when data is unavailable.

### Top-level fields

- `schema_version`: contract version
- `session_id`: current session identifier
- `sequence`: monotonically increasing sequence number per session
- `timestamp`: UTC capture timestamp
- `source`: provider and connection metadata
- `lap`: lap and timing metrics
- `session`: session and stint timing
- `engine`: engine and vehicle health metrics
- `fuel`: fuel metrics when available
- `gps`: GPS metrics when available
- `alerts`: derived warnings or critical alarms
- `health_state`: `nominal`, `warning`, or `critical`

### Units

- speed: `kph`
- rpm: `rpm`
- temperature: `celsius`
- oil pressure: `bar`
- time: `milliseconds`
- fuel level: `percent`
- position: decimal degrees

### Optional-field rule

Unavailable telemetry remains `null`. Providers must not invent values for unsupported sensors.

## Provider Interfaces

### Transport

Purpose: read raw bytes or text frames from a physical connection.

Required methods:

- `connect()`
- `disconnect()`
- `read()`

### Protocol

Purpose: turn raw transport payloads into partial normalized measurements.

Required methods:

- `feed(raw_chunk)`
- `decode(message)`

### Telemetry Provider

Purpose: expose a live async stream of normalized telemetry snapshots.

Required methods:

- `metadata()`
- `start()`
- `stop()`
- `stream()`

Provider rules:

- simulator must work without hardware
- OBD2 provider uses ELM327 transport/protocol stack
- Dictator provider uses custom serial transport/protocol stack
- Dictator raw capture mode writes undecoded payloads for reverse-engineering/debugging

## Screen Structure

### Driver Normal Mode

Primary blocks:

- warning banner overlay
- lap count
- current lap time
- previous lap time
- best lap time
- speed
- rpm
- oil pressure
- water temp
- source/connection strip

Behavior:

- large typography
- minimal interaction
- critical alerts override the layout with a full-width banner

### Driver Lemons Mode

Primary blocks:

- warning banner overlay
- lap count
- oil pressure
- water temp
- true speed
- source/connection strip

Behavior:

- excludes timing, delta, optimal, and session metrics
- optimized for low distraction and engine-preservation focus

### Pit Dashboard

Panels:

- live telemetry summary
- health and connection state
- lap summary
- temperatures and oil pressure
- fuel warning when present
- drive time and stint time
- camera panel with explicit live/loading/no-signal/offline states
- recent events timeline with alert transitions and state changes

## Phased MVP Plan

### Phase 1

- backend skeleton
- normalized schema
- simulator provider
- warning engine
- SQLite session and telemetry logging
- local REST/WebSocket API

### Phase 2

- driver normal mode
- driver Lemons mode
- warning override behavior
- responsive local desktop layout

### Phase 3

- pit dashboard
- recent alerts timeline
- current session summary
- camera placeholder panel

### Phase 4

- OBD2 provider via `python-OBD`
- PID mapping into normalized telemetry
- degraded/partial-data handling
- real-world baseline testing against ELM327-compatible adapters

### Phase 5

- Dictator USB serial transport
- raw capture/debug mode
- tolerant decoder iteration from captured payloads
- protocol hardening and diagnostics

### Phase 6

- Raspberry Pi packaging
- kiosk startup
- Bluetooth/USB adapter selection
- optional camera streaming
