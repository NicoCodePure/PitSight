from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from pitsight_api.api.deps import (
    get_device_runtime_service,
    get_settings_service,
    get_telemetry_service,
)
from pitsight_api.core.models.app_settings import DeviceHeartbeatReport, DeviceStateSnapshot
from pitsight_api.services.device_runtime_service import DeviceRuntimeService
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/api/v1/device", tags=["device"])


@router.get("/runtime", response_model=DeviceStateSnapshot)
async def get_device_runtime(
    settings_service: Annotated[SettingsService, Depends(get_settings_service)],
    telemetry_service: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> DeviceStateSnapshot:
    latest_snapshot = await telemetry_service.latest_snapshot()
    settings_snapshot = await settings_service.runtime_snapshot(
        latest_snapshot.source if latest_snapshot is not None else None,
        latest_snapshot.timestamp if latest_snapshot is not None else None,
    )
    return settings_snapshot.device_state


@router.post("/runtime/heartbeat", response_model=DeviceStateSnapshot)
async def post_device_runtime_heartbeat(
    payload: DeviceHeartbeatReport,
    device_runtime_service: Annotated[DeviceRuntimeService, Depends(get_device_runtime_service)],
    settings_service: Annotated[SettingsService, Depends(get_settings_service)],
    telemetry_service: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> DeviceStateSnapshot:
    device_runtime_service.record_heartbeat(payload)
    latest_snapshot = await telemetry_service.latest_snapshot()
    settings_snapshot = await settings_service.runtime_snapshot(
        latest_snapshot.source if latest_snapshot is not None else None,
        latest_snapshot.timestamp if latest_snapshot is not None else None,
    )
    return settings_snapshot.device_state
