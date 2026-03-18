from __future__ import annotations

from fastapi import Request

from pitsight_api.services.settings_service import SettingsService
from pitsight_api.services.telemetry_service import TelemetryService


def get_telemetry_service(request: Request) -> TelemetryService:
    return request.app.state.telemetry_service


def get_settings_service(request: Request) -> SettingsService:
    return request.app.state.settings_service

