from __future__ import annotations

from abc import ABC, abstractmethod


class TelemetryTransport(ABC):
    @abstractmethod
    async def connect(self) -> None:
        """Open the hardware or socket connection."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Close the hardware or socket connection."""

    @abstractmethod
    async def read(self) -> bytes:
        """Read the next raw chunk from the transport."""

