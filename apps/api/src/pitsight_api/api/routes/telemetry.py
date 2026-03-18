from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from pitsight_api.api.deps import get_telemetry_service
from pitsight_api.core.models.telemetry import AlertEvent, TelemetrySnapshot
from pitsight_api.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/api/v1", tags=["telemetry"])


@router.get("/telemetry/latest", response_model=TelemetrySnapshot | None)
async def latest_telemetry(
    service: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> TelemetrySnapshot | None:
    return await service.latest_snapshot()


@router.get("/alerts/recent", response_model=list[AlertEvent])
async def recent_alerts(
    service: Annotated[TelemetryService, Depends(get_telemetry_service)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AlertEvent]:
    return await service.recent_alerts(limit=limit)

