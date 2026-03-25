from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, TypeAlias

from pitsight_api.core.models.telemetry import (
    SCHEMA_VERSION,
    CameraState,
    ConnectionState,
    GPSFixState,
    HealthState,
    SourceStatus,
    TelemetrySnapshot,
)

CanonicalTelemetryValue: TypeAlias = int | float | str | bool | None
CanonicalTelemetryMap: TypeAlias = Mapping[str, CanonicalTelemetryValue]


@dataclass(frozen=True, slots=True)
class CanonicalMetricDefinition:
    key: str
    snapshot_path: str
    category: str
    display_label: str
    canonical_unit: str | None
    supported_display_units: tuple[str, ...]
    warning_profile: str | None
    core: bool
    no_data_state: str
    no_data_meaning: str

    def as_contract_entry(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["supported_display_units"] = list(self.supported_display_units)
        payload["availability"] = "core" if self.core else "optional"
        payload.pop("core")
        return payload


def _definition(
    *,
    key: str,
    snapshot_path: str,
    category: str,
    display_label: str,
    canonical_unit: str | None,
    supported_display_units: tuple[str, ...] = (),
    warning_profile: str | None = None,
    core: bool,
    no_data_meaning: str,
) -> CanonicalMetricDefinition:
    return CanonicalMetricDefinition(
        key=key,
        snapshot_path=snapshot_path,
        category=category,
        display_label=display_label,
        canonical_unit=canonical_unit,
        supported_display_units=supported_display_units,
        warning_profile=warning_profile,
        core=core,
        no_data_state="null",
        no_data_meaning=no_data_meaning,
    )


CANONICAL_METRIC_DEFINITIONS: dict[str, CanonicalMetricDefinition] = {
    definition.key: definition
    for definition in [
        _definition(
            key="rpm",
            snapshot_path="engine.rpm",
            category="engine",
            display_label="RPM",
            canonical_unit="rpm",
            supported_display_units=("rpm",),
            core=True,
            no_data_meaning="Null means RPM is unavailable from the active source.",
        ),
        _definition(
            key="speed",
            snapshot_path="engine.speed_kph",
            category="engine",
            display_label="Speed",
            canonical_unit="kph",
            supported_display_units=("kph", "mph"),
            core=True,
            no_data_meaning="Null means vehicle speed is unavailable from the active source.",
        ),
        _definition(
            key="gear",
            snapshot_path="engine.gear",
            category="engine",
            display_label="Gear",
            canonical_unit=None,
            supported_display_units=("gear",),
            core=False,
            no_data_meaning="Null means gear is not decoded or cannot be inferred confidently.",
        ),
        _definition(
            key="coolant_temp",
            snapshot_path="engine.water_temp_c",
            category="engine",
            display_label="Coolant Temp",
            canonical_unit="celsius",
            supported_display_units=("celsius", "fahrenheit"),
            warning_profile="coolant_temp",
            core=True,
            no_data_meaning="Null means coolant/water temperature is unavailable from the active source.",
        ),
        _definition(
            key="oil_temp",
            snapshot_path="engine.oil_temp_c",
            category="engine",
            display_label="Oil Temp",
            canonical_unit="celsius",
            supported_display_units=("celsius", "fahrenheit"),
            warning_profile="oil_temp",
            core=True,
            no_data_meaning="Null means oil temperature is unavailable from the active source.",
        ),
        _definition(
            key="oil_pressure",
            snapshot_path="engine.oil_pressure_bar",
            category="engine",
            display_label="Oil Pressure",
            canonical_unit="bar",
            supported_display_units=("bar", "psi"),
            warning_profile="oil_pressure",
            core=True,
            no_data_meaning="Null means oil pressure is unavailable from the active source.",
        ),
        _definition(
            key="battery_voltage",
            snapshot_path="engine.battery_voltage_v",
            category="engine",
            display_label="Battery Voltage",
            canonical_unit="volts",
            supported_display_units=("volts",),
            warning_profile="battery_voltage",
            core=False,
            no_data_meaning="Null means electrical system voltage is not available from the active source.",
        ),
        _definition(
            key="intake_temp",
            snapshot_path="engine.intake_temp_c",
            category="engine",
            display_label="Intake Temp",
            canonical_unit="celsius",
            supported_display_units=("celsius", "fahrenheit"),
            core=False,
            no_data_meaning="Null means intake air temperature is unavailable from the active source.",
        ),
        _definition(
            key="throttle_position",
            snapshot_path="engine.throttle_position_pct",
            category="engine",
            display_label="Throttle Position",
            canonical_unit="percent",
            supported_display_units=("percent",),
            core=False,
            no_data_meaning="Null means throttle position is unavailable from the active source.",
        ),
        _definition(
            key="lambda",
            snapshot_path="engine.lambda_value",
            category="engine",
            display_label="Lambda",
            canonical_unit="lambda",
            supported_display_units=("lambda", "afr"),
            warning_profile="lambda_delta",
            core=False,
            no_data_meaning="Null means lambda is unavailable; do not synthesize it unless the source or derivation is trustworthy.",
        ),
        _definition(
            key="afr",
            snapshot_path="engine.afr",
            category="engine",
            display_label="AFR",
            canonical_unit="afr",
            supported_display_units=("afr", "lambda"),
            core=False,
            no_data_meaning="Null means AFR is unavailable; derived AFR is acceptable only when the lambda basis is known.",
        ),
        _definition(
            key="fuel_level",
            snapshot_path="fuel.level_percent",
            category="fuel",
            display_label="Fuel Level",
            canonical_unit="percent",
            supported_display_units=("percent",),
            warning_profile="fuel_level",
            core=False,
            no_data_meaning="Null means fuel level is unavailable from the active source.",
        ),
        _definition(
            key="fuel_pressure",
            snapshot_path="fuel.pressure_bar",
            category="fuel",
            display_label="Fuel Pressure",
            canonical_unit="bar",
            supported_display_units=("bar", "psi"),
            warning_profile="fuel_pressure",
            core=False,
            no_data_meaning="Null means fuel pressure is unavailable from the active source.",
        ),
        _definition(
            key="fuel_range",
            snapshot_path="fuel.range_km",
            category="fuel",
            display_label="Fuel Range",
            canonical_unit="kilometres",
            supported_display_units=("kilometres", "miles"),
            core=False,
            no_data_meaning="Null means no trustworthy remaining-range estimate is available.",
        ),
        _definition(
            key="lap_time",
            snapshot_path="lap.current_lap_time_ms",
            category="lap",
            display_label="Current Lap",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means the current lap timer is unavailable.",
        ),
        _definition(
            key="previous_lap",
            snapshot_path="lap.previous_lap_time_ms",
            category="lap",
            display_label="Previous Lap",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means no previous lap has been completed yet.",
        ),
        _definition(
            key="best_lap",
            snapshot_path="lap.best_lap_time_ms",
            category="lap",
            display_label="Best Lap",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means no best lap exists yet for the session.",
        ),
        _definition(
            key="optimal_lap_estimate",
            snapshot_path="lap.optimal_lap_estimate_ms",
            category="lap",
            display_label="Optimal Lap",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means there is not enough timing data to estimate an optimal lap.",
        ),
        _definition(
            key="delta",
            snapshot_path="lap.delta_ms",
            category="lap",
            display_label="Delta",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means there is no valid reference lap to compare against.",
        ),
        _definition(
            key="lap_count",
            snapshot_path="lap.lap_count",
            category="lap",
            display_label="Lap Count",
            canonical_unit="laps",
            supported_display_units=("laps",),
            core=True,
            no_data_meaning="Null means lap counting is unavailable from the active timing source.",
        ),
        _definition(
            key="session_elapsed",
            snapshot_path="session.session_time_ms",
            category="session",
            display_label="Session Elapsed",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means session elapsed time is unavailable.",
        ),
        _definition(
            key="drive_time",
            snapshot_path="session.drive_time_ms",
            category="session",
            display_label="Drive Time",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means drive time is unavailable.",
        ),
        _definition(
            key="stint_time",
            snapshot_path="session.stint_time_ms",
            category="session",
            display_label="Stint Time",
            canonical_unit="milliseconds",
            supported_display_units=("milliseconds", "seconds", "clock"),
            core=False,
            no_data_meaning="Null means stint time is unavailable.",
        ),
        _definition(
            key="gps_latitude",
            snapshot_path="gps.latitude",
            category="gps",
            display_label="GPS Latitude",
            canonical_unit="degrees",
            supported_display_units=("degrees",),
            core=False,
            no_data_meaning="Null means GPS latitude is unavailable from the active source.",
        ),
        _definition(
            key="gps_longitude",
            snapshot_path="gps.longitude",
            category="gps",
            display_label="GPS Longitude",
            canonical_unit="degrees",
            supported_display_units=("degrees",),
            core=False,
            no_data_meaning="Null means GPS longitude is unavailable from the active source.",
        ),
        _definition(
            key="gps_speed",
            snapshot_path="gps.speed_kph",
            category="gps",
            display_label="GPS Speed",
            canonical_unit="kph",
            supported_display_units=("kph", "mph"),
            core=False,
            no_data_meaning="Null means GPS-derived speed is unavailable from the active source.",
        ),
        _definition(
            key="gps_fix_state",
            snapshot_path="gps.fix_state",
            category="gps",
            display_label="GPS Fix State",
            canonical_unit=None,
            supported_display_units=("state",),
            core=False,
            no_data_meaning="Null means there is no GPS source; no_fix means GPS hardware is present but has no satellite fix.",
        ),
        _definition(
            key="source_state",
            snapshot_path="source.connection_state",
            category="source",
            display_label="Source State",
            canonical_unit=None,
            supported_display_units=("state",),
            core=True,
            no_data_meaning="This metric should always be populated for a live snapshot.",
        ),
        _definition(
            key="camera_state",
            snapshot_path="camera.state",
            category="camera",
            display_label="Camera State",
            canonical_unit=None,
            supported_display_units=("state",),
            core=False,
            no_data_meaning="Null means the camera subsystem is not instrumented yet; unavailable means it is instrumented but not providing a feed.",
        ),
    ]
}


_ENUM_COERCIONS: dict[str, type[ConnectionState | GPSFixState | CameraState]] = {
    "source_state": ConnectionState,
    "gps_fix_state": GPSFixState,
    "camera_state": CameraState,
}


def canonical_telemetry_contract() -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "metrics": {
            key: definition.as_contract_entry()
            for key, definition in CANONICAL_METRIC_DEFINITIONS.items()
        },
    }


def _coerce_metric_value(metric_key: str, value: CanonicalTelemetryValue) -> CanonicalTelemetryValue:
    enum_type = _ENUM_COERCIONS.get(metric_key)
    if enum_type is None or value is None or isinstance(value, enum_type):
        return value
    return enum_type(value)


def _set_nested_value(payload: dict[str, Any], path: str, value: CanonicalTelemetryValue) -> None:
    segments = path.split(".")
    target = payload
    for segment in segments[:-1]:
        target = target.setdefault(segment, {})
    target[segments[-1]] = value


def build_snapshot_from_canonical(
    *,
    session_id: str,
    sequence: int,
    source_status: SourceStatus,
    metrics: CanonicalTelemetryMap,
    timestamp: datetime | None = None,
) -> TelemetrySnapshot:
    payload: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_id,
        "sequence": sequence,
        "timestamp": timestamp or datetime.now(timezone.utc),
        "source": source_status.model_dump(mode="python"),
        "lap": {},
        "session": {},
        "engine": {},
        "fuel": {},
        "gps": {},
        "camera": {},
        "alerts": [],
        "health_state": HealthState.NOMINAL,
    }

    for metric_key, raw_value in metrics.items():
        definition = CANONICAL_METRIC_DEFINITIONS.get(metric_key)
        if definition is None:
            raise KeyError(f"Unknown canonical telemetry metric '{metric_key}'")
        if raw_value is None:
            continue

        value = _coerce_metric_value(metric_key, raw_value)
        _set_nested_value(payload, definition.snapshot_path, value)

        if metric_key == "source_state" and isinstance(value, ConnectionState):
            payload["source"]["connected"] = value in {ConnectionState.CONNECTED, ConnectionState.DEGRADED}

    return TelemetrySnapshot.model_validate(payload)
