from __future__ import annotations

from dataclasses import dataclass

from pitsight_api.transport.base import TelemetryTransport


@dataclass(slots=True)
class SerialTransportConfig:
    port: str
    baudrate: int
    timeout_seconds: float = 0.5


class SerialTransport(TelemetryTransport):
    def __init__(self, config: SerialTransportConfig) -> None:
        self.config = config

    async def connect(self) -> None:
        raise RuntimeError("Serial transport is scaffolded but not implemented yet.")

    async def disconnect(self) -> None:
        return None

    async def read(self) -> bytes:
        raise RuntimeError("Serial transport is scaffolded but not implemented yet.")
