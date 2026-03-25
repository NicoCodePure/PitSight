from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from pitsight_api.api.deps import get_gps_service
from pitsight_api.core.models.telemetry import GPSMetrics
from pitsight_api.services.gps_service import GPSService

router = APIRouter(prefix="/api/v1/gps", tags=["gps"])


@router.get("/status", response_model=GPSMetrics)
async def get_gps_status(
    gps_service: Annotated[GPSService, Depends(get_gps_service)],
) -> GPSMetrics:
    return await gps_service.current_status()
