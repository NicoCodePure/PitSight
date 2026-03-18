from __future__ import annotations

from pitsight_api.config import Settings
from pitsight_api.core.models.telemetry import ProviderName
from pitsight_api.providers.base import TelemetryProvider
from pitsight_api.providers.dictator import DictatorTelemetryProvider
from pitsight_api.providers.obd2 import OBD2TelemetryProvider
from pitsight_api.providers.simulator import SimulatorTelemetryProvider


def build_provider(settings: Settings) -> TelemetryProvider:
    if settings.provider_mode == ProviderName.SIMULATOR:
        return SimulatorTelemetryProvider(interval_seconds=settings.simulator_interval_seconds)
    if settings.provider_mode == ProviderName.OBD2:
        return OBD2TelemetryProvider()
    if settings.provider_mode == ProviderName.DICTATOR:
        return DictatorTelemetryProvider(raw_capture_enabled=True)
    raise ValueError(f"Unsupported provider mode: {settings.provider_mode}")

