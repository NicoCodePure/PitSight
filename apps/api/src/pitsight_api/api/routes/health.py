from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict[str, object]:
    service = request.app.state.telemetry_service
    settings_service = request.app.state.settings_service
    camera_service = request.app.state.camera_service
    gps_service = request.app.state.gps_service
    session = await service.current_session()
    snapshot = await service.latest_snapshot()
    camera_status = await camera_service.current_status()
    gps_status = await gps_service.current_status()
    settings_snapshot = await settings_service.runtime_snapshot(
        snapshot.source if snapshot is not None else None,
        snapshot.timestamp if snapshot is not None else None,
    )
    source = snapshot.source if snapshot is not None else None
    return {
        "status": "ok",
        "provider": service.provider_metadata.name.value,
        "device_id": settings_snapshot.device_state.device_id,
        "device_online": settings_snapshot.device_state.online,
        "device_last_seen_at": (
            settings_snapshot.device_state.last_seen_at.isoformat()
            if settings_snapshot.device_state.last_seen_at
            else None
        ),
        "current_dashboard_mode": settings_snapshot.device_state.current_dashboard_mode.value,
        "active_source_provider": (
            settings_snapshot.device_state.active_source_provider.value
            if settings_snapshot.device_state.active_source_provider is not None
            else None
        ),
        "connection_health_summary": settings_snapshot.device_state.connection_health_summary.value,
        "source_status": (
            f"{service.provider_metadata.name.value} active"
            if source and source.connected
            else f"{service.provider_metadata.name.value} inactive"
        ),
        "connection_state": source.connection_state.value if source else "connecting",
        "connected": source.connected if source else False,
        "transport": service.provider_metadata.transport,
        "camera_state": camera_status.state.value if camera_status.state is not None else None,
        "camera_mode": camera_status.mode.value if camera_status.mode is not None else None,
        "gps_present": gps_status.present,
        "gps_connection_state": (
            gps_status.connection_state.value if gps_status.connection_state is not None else None
        ),
        "gps_fix_state": gps_status.fix_state.value if gps_status.fix_state is not None else None,
        "gps_source": gps_status.source,
        "gps_last_update_at": (
            gps_status.updated_at.isoformat() if gps_status.updated_at is not None else None
        ),
        "session_id": session.session_id if session else None,
    }
