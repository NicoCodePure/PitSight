from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from pitsight_api.api.routes.health import router as health_router
from pitsight_api.config import Settings
from pitsight_api.core.models.session import SessionRecord
from pitsight_api.core.models.telemetry import (
    CapabilityLevel,
    CapabilityStatus,
    CameraMetrics,
    CameraState,
    CameraViewMode,
    ConnectionState,
    GPSFixState,
    GPSMetrics,
    ProviderName,
    SourceStatus,
    TelemetryCapabilities,
    TelemetrySnapshot,
)
from pitsight_api.services.device_runtime_service import DeviceRuntimeService
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.storage.repository import SQLiteRepository


class FakeTelemetryService:
    def __init__(self, snapshot: TelemetrySnapshot) -> None:
        self.provider_metadata = SimpleNamespace(
            name=ProviderName.SIMULATOR,
            transport="simulator",
        )
        self._snapshot = snapshot

    async def current_session(self) -> SessionRecord:
        return SessionRecord(
            session_id=self._snapshot.session_id,
            provider=ProviderName.SIMULATOR,
            started_at=self._snapshot.timestamp,
        )

    async def latest_snapshot(self) -> TelemetrySnapshot:
        return self._snapshot


class FakeCameraService:
    async def current_status(self) -> CameraMetrics:
        return CameraMetrics(
            state=CameraState.OFFLINE,
            mode=CameraViewMode.ROAD,
            present=False,
            detail="Camera capture offline.",
        )


class FakeGPSService:
    async def current_status(self) -> GPSMetrics:
        return GPSMetrics(
            present=True,
            connection_state=ConnectionState.CONNECTED,
            fix_state=GPSFixState.FIX_3D,
            source="serial",
            updated_at=datetime.now(timezone.utc),
            detail="GPS locked.",
        )


def test_health_route_exposes_provider_runtime_state(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        database_path=tmp_path / "pitsight.db",
        provider_mode=ProviderName.SIMULATOR,
    )
    repository = SQLiteRepository(settings.database_path)
    asyncio.run(repository.initialize())

    device_runtime_service = DeviceRuntimeService(settings)
    settings_service = SettingsService(
        repository=repository,
        defaults=settings,
        device_runtime_service=device_runtime_service,
    )
    asyncio.run(settings_service.load())
    asyncio.run(
        settings_service.update(
            settings_service.current().model_copy(
                update={
                    "shared": settings_service.current().shared.model_copy(
                        update={"telemetry_source_preference": ProviderName.DICTATOR}
                    )
                }
            )
        )
    )

    snapshot = TelemetrySnapshot(
        session_id="session-health",
        sequence=12,
        timestamp=datetime.now(timezone.utc),
        source=SourceStatus(
            provider=ProviderName.SIMULATOR,
            transport="simulator",
            protocol="internal",
            connection_state=ConnectionState.CONNECTED,
            connected=True,
        ),
        capabilities=TelemetryCapabilities(
            lap_timing=CapabilityStatus(
                level=CapabilityLevel.FULL,
                detail="Simulator provides lap timing.",
            ),
            track_position=CapabilityStatus(
                level=CapabilityLevel.FULL,
                detail="Simulator provides track position.",
            ),
            session_clock=CapabilityStatus(
                level=CapabilityLevel.FULL,
                detail="Simulator provides session clocks.",
            ),
        ),
    )

    app = FastAPI()
    app.state.telemetry_service = FakeTelemetryService(snapshot)
    app.state.settings_service = settings_service
    app.state.camera_service = FakeCameraService()
    app.state.gps_service = FakeGPSService()
    app.include_router(health_router)

    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "simulator"
    assert payload["provider_runtime"] == {
        "boot_provider": "simulator",
        "requested_provider": "dictator",
        "active_provider": "simulator",
        "selection_state": "restart_required",
        "live_switch_supported": False,
        "restart_required": True,
        "detail": (
            "Requested provider is DICTATOR, but the running backend booted with SIMULATOR. "
            "Restart the backend or Pi with PITSIGHT_PROVIDER_MODE=dictator to switch sources."
        ),
    }
    assert payload["active_source_provider"] == "simulator"
    assert payload["connection_state"] == "connected"
    assert payload["gps_connection_state"] == "connected"
    assert payload["camera_state"] == "offline"
    assert payload["capabilities"]["lap_timing"]["level"] == "full"
    assert payload["capabilities"]["track_position"]["level"] == "full"
    assert payload["capabilities"]["session_clock"]["level"] == "full"
