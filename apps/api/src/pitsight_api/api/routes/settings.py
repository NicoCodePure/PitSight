from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from pitsight_api.api.deps import get_settings_service
from pitsight_api.core.models.app_settings import AppSettingsSnapshot, AppSettingsUpdate
from pitsight_api.services.settings_service import SettingsService

router = APIRouter(prefix="/api/v1", tags=["settings"])


@router.get("/settings", response_model=AppSettingsSnapshot)
async def get_settings(
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> AppSettingsSnapshot:
    return service.current()


@router.put("/settings", response_model=AppSettingsSnapshot)
async def update_settings(
    payload: AppSettingsUpdate,
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> AppSettingsSnapshot:
    return await service.update(payload)
