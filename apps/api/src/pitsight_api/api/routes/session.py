from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from pitsight_api.api.deps import get_telemetry_service
from pitsight_api.core.models.session import SessionRecord
from pitsight_api.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/api/v1", tags=["session"])


@router.get("/session/current", response_model=SessionRecord | None)
async def current_session(
    service: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> SessionRecord | None:
    return await service.current_session()

