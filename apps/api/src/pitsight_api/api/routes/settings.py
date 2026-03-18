from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from pitsight_api.api.deps import get_settings_service, get_telemetry_service
from pitsight_api.core.models.app_settings import AppSettingsSnapshot, AppSettingsUpdate
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/api/v1", tags=["settings"])


@router.get("/settings", response_model=AppSettingsSnapshot)
async def get_settings(
    service: Annotated[SettingsService, Depends(get_settings_service)],
    telemetry_service: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> AppSettingsSnapshot:
    snapshot = await telemetry_service.latest_snapshot()
    return await service.runtime_snapshot(snapshot.source if snapshot is not None else None)


@router.get("/settings/defaults", response_model=AppSettingsUpdate)
async def get_default_settings(
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> AppSettingsUpdate:
    return service.default_update()


@router.put("/settings", response_model=AppSettingsSnapshot)
async def update_settings(
    payload: AppSettingsUpdate,
    service: Annotated[SettingsService, Depends(get_settings_service)],
    telemetry_service: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> AppSettingsSnapshot:
    await service.update(payload)
    snapshot = await telemetry_service.latest_snapshot()
    return await service.runtime_snapshot(snapshot.source if snapshot is not None else None)
