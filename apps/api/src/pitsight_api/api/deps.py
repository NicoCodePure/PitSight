from __future__ import annotations

from fastapi import Request

from pitsight_api.services.event_service import EventService
from pitsight_api.services.camera_service import CameraService
from pitsight_api.services.device_runtime_service import DeviceRuntimeService
from pitsight_api.services.gps_service import GPSService
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.services.telemetry_service import TelemetryService


def get_telemetry_service(request: Request) -> TelemetryService:
    return request.app.state.telemetry_service


def get_settings_service(request: Request) -> SettingsService:
    return request.app.state.settings_service


def get_device_runtime_service(request: Request) -> DeviceRuntimeService:
    return request.app.state.device_runtime_service


def get_camera_service(request: Request) -> CameraService:
    return request.app.state.camera_service


def get_gps_service(request: Request) -> GPSService:
    return request.app.state.gps_service


def get_event_service(request: Request) -> EventService:
    return request.app.state.event_service
