from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pitsight_api.api.routes.camera import router as camera_router
from pitsight_api.api.routes.health import router as health_router
from pitsight_api.api.routes.device import router as device_router
from pitsight_api.api.routes.gps import router as gps_router
from pitsight_api.api.routes.session import router as session_router
from pitsight_api.api.routes.settings import router as settings_router
from pitsight_api.api.routes.stream import router as stream_router
from pitsight_api.api.routes.telemetry import router as telemetry_router
from pitsight_api.config import get_settings
from pitsight_api.logging import configure_logging
from pitsight_api.providers.factory import build_provider
from pitsight_api.services.camera_service import CameraService
from pitsight_api.services.device_runtime_service import DeviceRuntimeService
from pitsight_api.services.event_service import EventService
from pitsight_api.services.gps_service import GPSService
from pitsight_api.services.session_service import SessionService
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.services.telemetry_service import TelemetryService
from pitsight_api.services.warning_engine import WarningEngine
from pitsight_api.storage.repository import SQLiteRepository

settings = get_settings()
configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_data_dir()

    repository = SQLiteRepository(settings.database_path)
    provider = build_provider(settings)
    device_runtime_service = DeviceRuntimeService(settings)
    event_service = EventService(repository=repository)
    settings_service = SettingsService(
        repository=repository,
        defaults=settings,
        device_runtime_service=device_runtime_service,
        event_service=event_service,
    )
    await repository.initialize()
    await settings_service.load()
    warning_engine = WarningEngine(settings_service)
    session_service = SessionService()
    camera_service = CameraService(settings=settings, settings_service=settings_service)
    gps_service = GPSService(settings=settings)
    telemetry_service = TelemetryService(
        provider=provider,
        repository=repository,
        warning_engine=warning_engine,
        session_service=session_service,
        device_runtime_service=device_runtime_service,
        camera_service=camera_service,
        gps_service=gps_service,
        event_service=event_service,
        alert_history_limit=settings.alert_history_limit,
    )

    app.state.settings = settings
    app.state.settings_service = settings_service
    app.state.telemetry_service = telemetry_service
    app.state.device_runtime_service = device_runtime_service
    app.state.event_service = event_service
    app.state.camera_service = camera_service
    app.state.gps_service = gps_service

    await camera_service.start()
    await gps_service.start()
    await telemetry_service.start()
    try:
        yield
    finally:
        await telemetry_service.stop()
        await gps_service.stop()
        await camera_service.stop()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(device_router)
app.include_router(camera_router)
app.include_router(gps_router)
app.include_router(telemetry_router)
app.include_router(session_router)
app.include_router(settings_router)
app.include_router(stream_router)
