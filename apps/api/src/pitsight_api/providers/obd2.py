from __future__ import annotations

from typing import AsyncIterator

from pitsight_api.core.models.telemetry import ProviderName, TelemetrySnapshot
from pitsight_api.providers.base import ProviderMetadata, TelemetryProvider


class OBD2TelemetryProvider(TelemetryProvider):
    """Reserved for the future ELM327/python-OBD integration.

    TODO:
    - open an ELM327 transport over USB or Bluetooth
    - map supported OBD2 PIDs into the normalized telemetry model
    - preserve partial-data behavior when PIDs are unavailable
    """

    metadata = ProviderMetadata(
        name=ProviderName.OBD2,
        transport="usb-or-bluetooth",
        protocol="elm327",
        raw_capture_supported=False,
        poll_interval_seconds=0.5,
    )

    async def start(self, session_id: str) -> None:
        raise RuntimeError("OBD2 provider is scaffolded but not implemented yet.")

    async def stop(self) -> None:
        return None

    async def stream(self) -> AsyncIterator[TelemetrySnapshot]:
        if False:
            yield
