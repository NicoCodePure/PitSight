# Canonical Telemetry Model

PitSight normalizes every source into one internal telemetry contract before the UI or storage layer sees it.

## Purpose

- Providers do not expose raw source field names to the UI.
- Source-specific decoding happens below the canonical layer.
- Driver UI, pit dashboard, logging, alerts, and future replay/export all consume the same normalized snapshot shape.

## Canonical Shape

The runtime snapshot stays grouped for readability:

- `source`
- `lap`
- `session`
- `engine`
- `fuel`
- `gps`
- `camera`
- `alerts`

The canonical metric registry is flat and maps each metric key into one snapshot path. The machine-readable registry lives in [telemetry.dictionary.json](/c:/Users/nicon/PitSight/shared/contracts/telemetry.dictionary.json).

Examples:

- `rpm` -> `engine.rpm`
- `speed` -> `engine.speed_kph`
- `coolant_temp` -> `engine.water_temp_c`
- `oil_pressure` -> `engine.oil_pressure_bar`
- `fuel_pressure` -> `fuel.pressure_bar`
- `lap_time` -> `lap.current_lap_time_ms`
- `session_elapsed` -> `session.session_time_ms`
- `gps_fix_state` -> `gps.fix_state`
- `source_state` -> `source.connection_state`
- `camera_state` -> `camera.state`

## Source Mapping Flow

Each provider should follow the same pipeline:

1. Transport reads raw bytes, frames, or adapter responses.
2. Protocol decoding turns source payloads into source-specific measurements.
3. Provider maps those measurements into a flat canonical metric dictionary in canonical units.
4. `build_snapshot_from_canonical(...)` converts that dictionary into the grouped `TelemetrySnapshot`.
5. Services handle warnings, persistence, and broadcast from the normalized snapshot only.

This means:

- OBD2 can map PIDs into canonical keys without changing any UI code.
- Dictator can map decoded serial payloads into canonical keys without changing any UI code.
- Partial telemetry stays valid because unsupported metrics remain `null`.

## Canonical Units

PitSight stores canonical telemetry in stable backend units:

- speed: `kph`
- temperatures: `celsius`
- pressures: `bar`
- timing: `milliseconds`
- fuel level and throttle: `percent`
- battery: `volts`
- GPS position: decimal `degrees`
- lambda: `lambda`
- AFR: `afr`

Display-unit conversion happens above this layer.

## Speed Source Rule

PitSight keeps source speed and GPS speed separate in the canonical snapshot:

- `engine.speed_kph` is the primary vehicle-speed field
- `gps.speed_kph` is a secondary GPS-derived field

Consumer rule:

- use `engine.speed_kph` first when it is present and trustworthy
- use `gps.speed_kph` only as a fallback when the active source does not provide usable vehicle speed
- render speed as unavailable when both are `null`

This preserves source fidelity while still allowing GPS fallback for integrations such as a future Dictator path.

## Warning Profiles

The canonical registry marks which metrics can participate in threshold logic.

Current warning profiles:

- `coolant_temp`
- `oil_temp`
- `oil_pressure`
- `fuel_level`
- `battery_voltage`
- `fuel_pressure`
- `lambda_delta`

Not every profile is active in the warning engine yet. The registry exists so warning behavior can expand without renaming telemetry fields.

## No-Data Rules

Default rule:

- `null` means unavailable, unsupported, or not yet established.
- Providers must not invent sensor values just to fill the payload.
- UI must render `null` as unavailable, never as zero.

Metric-specific rules:

- timing metrics like `best_lap`, `previous_lap`, and `delta` may be `null` until enough lap history exists
- `gear` may be `null` if it cannot be decoded or inferred confidently
- `gps_fix_state = null` means no GPS source is present; `no_fix` means GPS hardware is present but has no lock
- grouped GPS runtime fields can additionally report `present`, `connection_state`, `source`, `updated_at`, and `detail` for diagnostics without changing the speed-source rule
- `camera_state = null` means camera telemetry is not instrumented yet; `unavailable` means it is instrumented but has no active feed
- camera runtime can additionally report `loading`, `live`, `no_signal`, `disabled`, `offline`, or `fault` through the grouped `camera` object without exposing raw backend-specific field names to the UI
- derived metrics like `afr` should only be emitted when the provider knows the derivation is trustworthy

## Current Simulator Coverage

The simulator now maps into the canonical layer and emits:

- core speed, rpm, coolant temp, oil temp, oil pressure, lap count
- optional gear, battery voltage, lambda, afr, intake temp, throttle position
- optional fuel pressure, fuel level, range estimate
- optional lap delta, GPS fix state, and camera state

This simulator path is the reference implementation for future OBD2 and Dictator providers.
