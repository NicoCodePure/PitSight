from __future__ import annotations

import platform
import re
import socket
from datetime import datetime, timedelta, timezone

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    ActiveDashboardModeSource,
    DashboardMode,
    DeviceConnectionHealth,
    DeviceHeartbeatReport,
    DeviceStateSnapshot,
)
from pitsight_api.core.models.telemetry import ConnectionState, ProviderName, SourceStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _sanitize_device_id(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return normalized or "pitsight-device"


class DeviceRuntimeService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        hostname = socket.gethostname() or "localhost"
        self._base_device_id = settings.device_id or f"pitsight-{_sanitize_device_id(hostname)}"
        self._base_label = settings.device_label
        self._hostname = hostname
        self._platform = f"{platform.system()} {platform.release()}".strip()
        self._last_source_seen_at: datetime | None = None
        self._last_runtime_seen_at: datetime | None = None
        self._reported_dashboard_mode: DashboardMode | None = None
        self._last_mode_reported_at: datetime | None = None
        self._active_source_provider: ProviderName | None = None
        self._source_connection_state: ConnectionState | None = None
        self._source_connected: bool = False
        self._connected_peripherals: list[str] = ["simulator feed", "loopback websocket"]
        self._stored_device_id: str | None = None
        self._stored_label: str | None = None

    def prime(self, stored_state: DeviceStateSnapshot | None) -> None:
        if stored_state is None:
            return
        self._stored_device_id = stored_state.device_id
        self._stored_label = stored_state.device_label
        if stored_state.connected_peripherals:
            self._connected_peripherals = list(stored_state.connected_peripherals)

    def observe_source(self, source_status: SourceStatus, observed_at: datetime | None = None) -> None:
        timestamp = observed_at or _utcnow()
        self._last_source_seen_at = timestamp
        self._active_source_provider = source_status.provider
        self._source_connection_state = source_status.connection_state
        self._source_connected = source_status.connected
        self._connected_peripherals = self._derive_peripherals(source_status)

    def record_heartbeat(self, report: DeviceHeartbeatReport) -> None:
        timestamp = _utcnow()
        self._last_runtime_seen_at = timestamp

        if report.current_dashboard_mode is not None:
            self._reported_dashboard_mode = report.current_dashboard_mode
            self._last_mode_reported_at = timestamp

        if report.active_source_provider is not None:
            self._active_source_provider = report.active_source_provider
        if report.source_connection_state is not None:
            self._source_connection_state = report.source_connection_state
        if report.source_connected is not None:
            self._source_connected = report.source_connected
        if report.connected_peripherals is not None:
            self._connected_peripherals = list(report.connected_peripherals)

    def snapshot(
        self,
        *,
        applied_dashboard_mode: DashboardMode,
        stored_state: DeviceStateSnapshot,
    ) -> DeviceStateSnapshot:
        now = _utcnow()
        last_seen_at = self._latest_seen_at()
        online = self._is_recent(last_seen_at, now)

        if online and self._is_recent(self._last_mode_reported_at, now):
            current_dashboard_mode = self._reported_dashboard_mode or applied_dashboard_mode
            current_mode_source = ActiveDashboardModeSource.REPORTED
        elif online:
            current_dashboard_mode = applied_dashboard_mode
            current_mode_source = ActiveDashboardModeSource.APPLIED_DEFAULT
        else:
            current_dashboard_mode = stored_state.last_known_dashboard_mode
            current_mode_source = ActiveDashboardModeSource.LAST_KNOWN

        last_known_dashboard_mode = (
            current_dashboard_mode if online else stored_state.last_known_dashboard_mode
        )
        source_provider = self._active_source_provider or stored_state.active_source_provider
        source_connection_state = self._source_connection_state or stored_state.source_connection_state
        source_connected = self._source_connected if online else False

        return stored_state.model_copy(
            update={
                "device_id": self._stored_device_id or stored_state.device_id or self._base_device_id,
                "device_label": self._stored_label or stored_state.device_label or self._base_label,
                "software_version": self.settings.app_version,
                "hostname": self._hostname,
                "platform": self._platform,
                "heartbeat_interval_seconds": self.settings.device_heartbeat_interval_seconds,
                "heartbeat_timeout_seconds": self.settings.device_heartbeat_timeout_seconds,
                "last_seen_at": last_seen_at,
                "last_known_dashboard_mode": last_known_dashboard_mode,
                "current_dashboard_mode": current_dashboard_mode,
                "current_dashboard_mode_source": current_mode_source,
                "active_source_provider": source_provider,
                "source_connection_state": source_connection_state,
                "source_connected": source_connected,
                "connection_health_summary": self._connection_health(
                    online=online,
                    source_connection_state=source_connection_state,
                    source_connected=source_connected,
                ),
                "online": online,
                "connected_peripherals": self._connected_peripherals or stored_state.connected_peripherals,
            }
        )

    def _latest_seen_at(self) -> datetime | None:
        candidates = [value for value in (self._last_source_seen_at, self._last_runtime_seen_at) if value is not None]
        if not candidates:
            return None
        return max(candidates)

    def _is_recent(self, timestamp: datetime | None, now: datetime) -> bool:
        if timestamp is None:
            return False
        timeout = timedelta(seconds=self.settings.device_heartbeat_timeout_seconds)
        return now - timestamp <= timeout

    @staticmethod
    def _connection_health(
        *,
        online: bool,
        source_connection_state: ConnectionState | None,
        source_connected: bool,
    ) -> DeviceConnectionHealth:
        if not online:
            return DeviceConnectionHealth.OFFLINE
        if source_connection_state in {ConnectionState.FAULT, ConnectionState.DISCONNECTED}:
            return DeviceConnectionHealth.FAULT
        if source_connection_state in {ConnectionState.CONNECTING, ConnectionState.DEGRADED}:
            return DeviceConnectionHealth.DEGRADED
        if source_connected and source_connection_state is ConnectionState.CONNECTED:
            return DeviceConnectionHealth.NOMINAL
        return DeviceConnectionHealth.DEGRADED

    @staticmethod
    def _derive_peripherals(source_status: SourceStatus) -> list[str]:
        peripherals: list[str] = [f"{source_status.provider.value} telemetry"]
        transport = source_status.transport.strip()
        if transport:
            peripherals.append(f"{transport} link")
        protocol = source_status.protocol.strip()
        if protocol:
            peripherals.append(f"{protocol} protocol")
        return peripherals
