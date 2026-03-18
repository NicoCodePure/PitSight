from __future__ import annotations

from typing import AsyncIterator

from pitsight_api.core.models.telemetry import ProviderName, TelemetrySnapshot
from pitsight_api.providers.base import ProviderMetadata, TelemetryProvider


class DictatorTelemetryProvider(TelemetryProvider):
    """Reserved for the future custom Dictator serial integration.

    TODO:
    - implement serial transport configuration and connection management
    - add raw capture mode for reverse-engineering payloads
    - decode captured frames into normalized telemetry fields
    """

    metadata = ProviderMetadata(
        name=ProviderName.DICTATOR,
        transport="serial",
        protocol="dictator-custom",
        raw_capture_supported=True,
        poll_interval_seconds=0.25,
    )

    def __init__(self, raw_capture_enabled: bool = False) -> None:
        self.raw_capture_enabled = raw_capture_enabled

    async def start(self, session_id: str) -> None:
        raise RuntimeError("Dictator provider is scaffolded but not implemented yet.")

    async def stop(self) -> None:
        return None

    async def stream(self) -> AsyncIterator[TelemetrySnapshot]:
        if False:
            yield
