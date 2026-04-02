from __future__ import annotations

from datetime import timedelta, timezone, datetime

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    ActiveDashboardModeSource,
    DashboardMode,
    DeviceConnectionHealth,
    DeviceHeartbeatReport,
    DeviceStateSnapshot,
)
from pitsight_api.core.models.telemetry import ConnectionState, ProviderName, SourceStatus
from pitsight_api.services.device_runtime_service import DeviceRuntimeService


def test_device_runtime_service_tracks_identity_source_and_applied_mode() -> None:
    settings = Settings(_env_file=None, device_label="PitSight Test Pi")
    service = DeviceRuntimeService(settings)
    stored = DeviceStateSnapshot()

    service.prime(stored)
    service.observe_source(
        SourceStatus(
            provider=ProviderName.SIMULATOR,
            transport="internal",
            protocol="simulated",
            connection_state=ConnectionState.CONNECTED,
            connected=True,
            raw_capture_enabled=False,
        )
    )

    snapshot = service.snapshot(
        applied_dashboard_mode=DashboardMode.DRIVER_LEMONS,
        stored_state=stored,
    )

    assert snapshot.device_id.startswith("pitsight-")
    assert snapshot.device_label == "PitSight Pi Simulator"
    assert snapshot.hostname
    assert snapshot.online is True
    assert snapshot.current_dashboard_mode is DashboardMode.DRIVER_LEMONS
    assert snapshot.current_dashboard_mode_source is ActiveDashboardModeSource.APPLIED_DEFAULT
    assert snapshot.active_source_provider is ProviderName.SIMULATOR
    assert snapshot.source_connection_state is ConnectionState.CONNECTED
    assert snapshot.connection_health_summary is DeviceConnectionHealth.NOMINAL
    assert "simulator telemetry" in snapshot.connected_peripherals


def test_device_runtime_service_prefers_reported_mode_and_falls_back_when_report_stales() -> None:
    settings = Settings(_env_file=None)
    service = DeviceRuntimeService(settings)
    stored = DeviceStateSnapshot()

    service.observe_source(
        SourceStatus(
            provider=ProviderName.SIMULATOR,
            transport="internal",
            protocol="simulated",
            connection_state=ConnectionState.CONNECTED,
            connected=True,
            raw_capture_enabled=False,
        )
    )
    service.record_heartbeat(DeviceHeartbeatReport(current_dashboard_mode=DashboardMode.PIT_DASHBOARD))

    reported_snapshot = service.snapshot(
        applied_dashboard_mode=DashboardMode.DRIVER_NORMAL,
        stored_state=stored,
    )
    assert reported_snapshot.current_dashboard_mode is DashboardMode.PIT_DASHBOARD
    assert reported_snapshot.current_dashboard_mode_source is ActiveDashboardModeSource.REPORTED

    stale_timestamp = datetime.now(timezone.utc) - timedelta(
        seconds=settings.device_heartbeat_timeout_seconds + 1
    )
    service._last_runtime_seen_at = stale_timestamp
    service._last_mode_reported_at = stale_timestamp

    fallback_snapshot = service.snapshot(
        applied_dashboard_mode=DashboardMode.DRIVER_NORMAL,
        stored_state=reported_snapshot,
    )
    assert fallback_snapshot.current_dashboard_mode is DashboardMode.DRIVER_NORMAL
    assert fallback_snapshot.current_dashboard_mode_source is ActiveDashboardModeSource.APPLIED_DEFAULT


def test_device_runtime_service_marks_device_offline_when_last_seen_expires() -> None:
    settings = Settings(_env_file=None)
    service = DeviceRuntimeService(settings)
    stored = DeviceStateSnapshot(last_known_dashboard_mode=DashboardMode.PIT_DASHBOARD)

    service.observe_source(
        SourceStatus(
            provider=ProviderName.SIMULATOR,
            transport="internal",
            protocol="simulated",
            connection_state=ConnectionState.CONNECTED,
            connected=True,
            raw_capture_enabled=False,
        )
    )
    stale_timestamp = datetime.now(timezone.utc) - timedelta(
        seconds=settings.device_heartbeat_timeout_seconds + 1
    )
    service._last_source_seen_at = stale_timestamp

    snapshot = service.snapshot(
        applied_dashboard_mode=DashboardMode.DRIVER_NORMAL,
        stored_state=stored,
    )

    assert snapshot.online is False
    assert snapshot.connection_health_summary is DeviceConnectionHealth.OFFLINE
    assert snapshot.current_dashboard_mode is DashboardMode.PIT_DASHBOARD
    assert snapshot.current_dashboard_mode_source is ActiveDashboardModeSource.LAST_KNOWN
