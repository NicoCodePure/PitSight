from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict[str, object]:
    service = request.app.state.telemetry_service
    session = await service.current_session()
    snapshot = await service.latest_snapshot()
    source = snapshot.source if snapshot is not None else None
    return {
        "status": "ok",
        "provider": service.provider_metadata.name.value,
        "source_status": (
            f"{service.provider_metadata.name.value} active"
            if source and source.connected
            else f"{service.provider_metadata.name.value} inactive"
        ),
        "connection_state": source.connection_state.value if source else "connecting",
        "connected": source.connected if source else False,
        "transport": service.provider_metadata.transport,
        "session_id": session.session_id if session else None,
    }
