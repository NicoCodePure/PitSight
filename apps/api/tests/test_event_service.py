from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import DashboardMode
from pitsight_api.core.models.event import EventAction
from pitsight_api.core.models.telemetry import (
    AlertEvent,
    AlertSeverity,
    CameraMetrics,
    CameraState,
    ConnectionState,
    GPSFixState,
    GPSMetrics,
    ProviderName,
    SourceStatus,
    TelemetrySnapshot,
)
from pitsight_api.services.device_runtime_service import DeviceRuntimeService
from pitsight_api.services.event_service import EventService
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.storage.repository import SQLiteRepository


def build_snapshot(
    *,
    session_id: str,
    timestamp: datetime,
    connection_state: ConnectionState,
    alerts: list[AlertEvent],
    camera_state: CameraState,
    gps_fix_state: GPSFixState | None,
) -> TelemetrySnapshot:
    return TelemetrySnapshot(
        session_id=session_id,
        sequence=1,
        timestamp=timestamp,
        source=SourceStatus(
            provider=ProviderName.SIMULATOR,
            transport="internal",
            protocol="simulated",
            connection_state=connection_state,
            connected=connection_state in {ConnectionState.CONNECTED, ConnectionState.DEGRADED},
            raw_capture_enabled=False,
        ),
        alerts=alerts,
        camera=CameraMetrics(state=camera_state, detail=f"Camera {camera_state.value}."),
        gps=GPSMetrics(fix_state=gps_fix_state, detail="GPS state changed."),
    )


def test_event_service_builds_alert_and_runtime_transition_events(tmp_path) -> None:
    async def scenario() -> None:
        repository = SQLiteRepository(tmp_path / "events.db")
        await repository.initialize()
        event_service = EventService(repository)

        previous = build_snapshot(
            session_id="session-1",
            timestamp=datetime(2026, 3, 25, 10, 0, tzinfo=timezone.utc),
            connection_state=ConnectionState.CONNECTED,
            alerts=[
                AlertEvent(
                    timestamp=datetime(2026, 3, 25, 10, 0, tzinfo=timezone.utc),
                    code="high_oil_temp_warning",
                    severity=AlertSeverity.WARNING,
                    message="High oil temperature",
                    active=True,
                    value=122.0,
                    threshold=120.0,
                )
            ],
            camera_state=CameraState.LIVE,
            gps_fix_state=GPSFixState.FIX_3D,
        )
        current = build_snapshot(
            session_id="session-1",
            timestamp=datetime(2026, 3, 25, 10, 1, tzinfo=timezone.utc),
            connection_state=ConnectionState.DISCONNECTED,
            alerts=[
                AlertEvent(
                    timestamp=datetime(2026, 3, 25, 10, 1, tzinfo=timezone.utc),
                    code="high_water_temp_critical",
                    severity=AlertSeverity.CRITICAL,
                    message="Critical water temperature",
                    active=True,
                    value=114.0,
                    threshold=112.0,
                )
            ],
            camera_state=CameraState.OFFLINE,
            gps_fix_state=GPSFixState.NO_FIX,
        )

        events = event_service.build_snapshot_events(previous, current)
        await event_service.record_events(events)
        stored = await event_service.recent_events()

        codes = {event.code for event in stored}
        assert "alert.high_oil_temp_warning.cleared" in codes
        assert "alert.high_water_temp_critical.entered" in codes
        assert "source.connection_state.lost" in codes
        assert "gps.fix.lost" in codes
        assert "camera.state.offline" in codes
        assert any(event.action is EventAction.CLEARED for event in stored)
        assert any(event.title == "Telemetry Signal Lost" for event in stored)

        await repository.close()

    asyncio.run(scenario())


def test_event_service_builds_settings_and_device_events(tmp_path) -> None:
    async def scenario() -> None:
        database_path = tmp_path / "settings-events.db"
        defaults = Settings(_env_file=None, database_path=database_path)
        repository = SQLiteRepository(database_path)
        await repository.initialize()
        event_service = EventService(repository)
        settings_service = SettingsService(
            repository=repository,
            defaults=defaults,
            device_runtime_service=DeviceRuntimeService(defaults),
        )
        current = await settings_service.load()
        next_snapshot = current.model_copy(
            update={
                "shared": current.shared.model_copy(
                    update={
                        "thresholds": current.shared.thresholds.model_copy(
                            update={"water_temp_warning_c": 108.0}
                        )
                    }
                ),
                "device_local": current.device_local.model_copy(
                    update={
                        "display": current.device_local.display.model_copy(
                            update={"default_dashboard_mode": DashboardMode.PIT_DASHBOARD}
                        )
                    }
                ),
                "updated_at": datetime(2026, 3, 25, 11, 0, tzinfo=timezone.utc),
            }
        )

        settings_events = event_service.build_settings_update_events(current, next_snapshot)
        device_events = event_service.build_device_state_events(
            current.device_state,
            current.device_state.model_copy(
                update={
                    "online": True,
                    "last_seen_at": datetime(2026, 3, 25, 11, 1, tzinfo=timezone.utc),
                    "current_dashboard_mode": DashboardMode.PIT_DASHBOARD,
                }
            ),
        )

        await event_service.record_events([*settings_events, *device_events])
        stored = await event_service.recent_events()

        titles = {event.title for event in stored}
        assert "Warning Thresholds Updated" in titles
        assert "Default Display Mode Changed" in titles
        assert "Device Connected" in titles
        assert "Active Display Mode Changed" in titles

        await repository.close()

    asyncio.run(scenario())
