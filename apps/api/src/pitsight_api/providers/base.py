from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator

from pitsight_api.core.models.telemetry import ProviderName, TelemetrySnapshot


@dataclass(frozen=True, slots=True)
class ProviderMetadata:
    name: ProviderName
    transport: str
    protocol: str
    raw_capture_supported: bool = False
    poll_interval_seconds: float = 1.0


class TelemetryProvider(ABC):
    metadata: ProviderMetadata

    @abstractmethod
    async def start(self, session_id: str) -> None:
        """Prepare the provider for streaming."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop the provider and release resources."""

    @abstractmethod
    async def stream(self) -> AsyncIterator[TelemetrySnapshot]:
        """Yield normalized telemetry snapshots."""

