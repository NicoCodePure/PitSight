from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse

from pitsight_api.api.deps import get_camera_service
from pitsight_api.core.models.telemetry import CameraMetrics, CameraState
from pitsight_api.services.camera_service import CameraService

router = APIRouter(prefix="/api/v1/camera", tags=["camera"])


@router.get("/status", response_model=CameraMetrics)
async def get_camera_status(
    camera_service: Annotated[CameraService, Depends(get_camera_service)],
) -> CameraMetrics:
    return await camera_service.current_status()


@router.get("/frame.jpg")
async def get_camera_frame(
    camera_service: Annotated[CameraService, Depends(get_camera_service)],
) -> Response:
    status = await camera_service.current_status()
    frame = await camera_service.latest_frame()
    if status.state is not CameraState.LIVE or frame is None:
        raise HTTPException(status_code=503, detail="No live camera frame is available.")
    return Response(content=frame, media_type="image/jpeg")


@router.get("/stream.mjpeg")
async def get_camera_stream(
    camera_service: Annotated[CameraService, Depends(get_camera_service)],
) -> StreamingResponse:
    return StreamingResponse(
        camera_service.mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )
