from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Callable

from pitsight_api.transport.base import TelemetryTransport


@dataclass(slots=True)
class SerialTransportConfig:
    port: str
    baudrate: int
    timeout_seconds: float = 0.5


class SerialTransport(TelemetryTransport):
    def __init__(
        self,
        config: SerialTransportConfig,
        serial_factory: Callable[..., Any] | None = None,
    ) -> None:
        self.config = config
        self._serial_factory = serial_factory
        self._connection: Any | None = None

    async def connect(self) -> None:
        if self._connection is not None:
            return

        factory = self._serial_factory or self._load_serial_factory()
        self._connection = await asyncio.to_thread(
            factory,
            port=self.config.port,
            baudrate=self.config.baudrate,
            timeout=self.config.timeout_seconds,
        )

    async def disconnect(self) -> None:
        if self._connection is None:
            return
        await asyncio.to_thread(self._connection.close)
        self._connection = None

    async def read(self) -> bytes:
        if self._connection is None:
            raise RuntimeError("Serial transport is not connected.")

        payload = await asyncio.to_thread(self._connection.readline)
        if not payload:
            return b""
        return bytes(payload)

    def _load_serial_factory(self) -> Callable[..., Any]:
        try:
            import serial  # type: ignore[import-not-found]
        except ImportError as error:
            raise RuntimeError(
                "pyserial is not installed. Run with the dictator extra to enable Dictator USB support."
            ) from error
        return serial.Serial
