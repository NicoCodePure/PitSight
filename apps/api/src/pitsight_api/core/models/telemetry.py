from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = "0.2.0"


class ProviderName(str, Enum):
    SIMULATOR = "simulator"
    OBD2 = "obd2"
    DICTATOR = "dictator"


class ConnectionState(str, Enum):
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DEGRADED = "degraded"
    DISCONNECTED = "disconnected"
    FAULT = "fault"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class HealthState(str, Enum):
    NOMINAL = "nominal"
    WARNING = "warning"
    CRITICAL = "critical"


class GPSFixState(str, Enum):
    NO_FIX = "no_fix"
    FIX_2D = "2d"
    FIX_3D = "3d"
    DGPS = "dgps"


class CameraState(str, Enum):
    DISABLED = "disabled"
    LOADING = "loading"
    LIVE = "live"
    NO_SIGNAL = "no_signal"
    OFFLINE = "offline"
    UNAVAILABLE = "unavailable"
    FAULT = "fault"


class CameraViewMode(str, Enum):
    DISABLED = "disabled"
    ROAD = "road"
    DRIVER = "driver"


class CapabilityLevel(str, Enum):
    FULL = "full"
    LIMITED = "limited"
    UNAVAILABLE = "unavailable"


class CapabilityStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: CapabilityLevel
    detail: str


class TelemetryCapabilities(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lap_timing: CapabilityStatus = Field(
        default_factory=lambda: CapabilityStatus(
            level=CapabilityLevel.UNAVAILABLE,
            detail="Lap timing support has not been declared for this snapshot.",
        )
    )
    track_position: CapabilityStatus = Field(
        default_factory=lambda: CapabilityStatus(
            level=CapabilityLevel.UNAVAILABLE,
            detail="Track-position support has not been declared for this snapshot.",
        )
    )
    session_clock: CapabilityStatus = Field(
        default_factory=lambda: CapabilityStatus(
            level=CapabilityLevel.UNAVAILABLE,
            detail="Session-clock support has not been declared for this snapshot.",
        )
    )


class SourceStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: ProviderName
    transport: str
    protocol: str
    connection_state: ConnectionState
    connected: bool
    raw_capture_enabled: bool = False
    details: dict[str, Any] | None = None


class LapMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lap_count: int | None = None
    current_lap_time_ms: int | None = None
    previous_lap_time_ms: int | None = None
    best_lap_time_ms: int | None = None
    optimal_lap_estimate_ms: int | None = None
    delta_ms: int | None = None


class SessionMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_time_ms: int | None = None
    drive_time_ms: int | None = None
    stint_time_ms: int | None = None


class EngineMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speed_kph: float | None = None
    rpm: float | None = None
    gear: int | None = None
    water_temp_c: float | None = None
    oil_temp_c: float | None = None
    oil_pressure_bar: float | None = None
    battery_voltage_v: float | None = None
    lambda_value: float | None = None
    afr: float | None = None
    intake_temp_c: float | None = None
    throttle_position_pct: float | None = None


class FuelMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level_percent: float | None = None
    range_km: float | None = None
    pressure_bar: float | None = None


class GPSMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float | None = None
    longitude: float | None = None
    speed_kph: float | None = None
    fix_state: GPSFixState | None = None
    present: bool | None = None
    connection_state: ConnectionState | None = None
    source: str | None = None
    updated_at: datetime | None = None
    detail: str | None = None


class CameraMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: CameraState | None = None
    mode: CameraViewMode | None = None
    stream_url: str | None = None
    detail: str | None = None
    present: bool | None = None
    last_frame_at: datetime | None = None


class AlertEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: datetime | None = None
    code: str
    severity: AlertSeverity
    message: str
    active: bool = True
    value: float | None = None
    threshold: float | None = None


def derive_health_state(alerts: Iterable[AlertEvent]) -> HealthState:
    alert_list = list(alerts)
    if any(alert.active and alert.severity == AlertSeverity.CRITICAL for alert in alert_list):
        return HealthState.CRITICAL
    if any(alert.active and alert.severity == AlertSeverity.WARNING for alert in alert_list):
        return HealthState.WARNING
    return HealthState.NOMINAL


class TelemetrySnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(default=SCHEMA_VERSION)
    session_id: str
    sequence: int = 0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: SourceStatus
    lap: LapMetrics = Field(default_factory=LapMetrics)
    session: SessionMetrics = Field(default_factory=SessionMetrics)
    engine: EngineMetrics = Field(default_factory=EngineMetrics)
    fuel: FuelMetrics = Field(default_factory=FuelMetrics)
    gps: GPSMetrics = Field(default_factory=GPSMetrics)
    camera: CameraMetrics = Field(default_factory=CameraMetrics)
    capabilities: TelemetryCapabilities = Field(default_factory=TelemetryCapabilities)
    alerts: list[AlertEvent] = Field(default_factory=list)
    health_state: HealthState = HealthState.NOMINAL

    def with_alerts(self, alerts: Iterable[AlertEvent]) -> "TelemetrySnapshot":
        alert_list = list(alerts)
        return self.model_copy(
            update={
                "alerts": alert_list,
                "health_state": derive_health_state(alert_list),
            }
        )
