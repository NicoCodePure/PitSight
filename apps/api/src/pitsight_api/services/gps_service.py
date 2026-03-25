from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from pitsight_api.config import Settings
from pitsight_api.core.models.telemetry import ConnectionState, GPSFixState, GPSMetrics
from pitsight_api.protocol.nmea import NMEA0183Protocol

GPS_MARKERS = ("gps", "gnss", "ublox", "u-blox", "nmea")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True, slots=True)
class GPSBackendConfig:
    port: str | None
    baudrate: int
    timeout_seconds: float


@dataclass(frozen=True, slots=True)
class GPSOpenResult:
    opened: bool
    present: bool | None
    detail: str
    port_name: str | None = None


class GPSBackend(Protocol):
    def open(self) -> GPSOpenResult:
        ...

    def read_sentence(self) -> bytes | None:
        ...

    def release(self) -> None:
        ...


GPSBackendFactory = Callable[[GPSBackendConfig], GPSBackend]


class SerialGPSBackend:
    def __init__(self, config: GPSBackendConfig) -> None:
        self.config = config
        self._serial_module = None
        self._connection = None
        self._resolved_port: str | None = None

    def open(self) -> GPSOpenResult:
        serial_module = self._load_serial_module()
        resolved_port = self.config.port or self._auto_detect_port()
        if resolved_port is None:
            return GPSOpenResult(
                opened=False,
                present=False,
                detail="No GPS serial port configured or auto-detected.",
                port_name=None,
            )

        try:
            self._connection = serial_module.Serial(
                port=resolved_port,
                baudrate=self.config.baudrate,
                timeout=self.config.timeout_seconds,
            )
        except Exception as error:
            return GPSOpenResult(
                opened=False,
                present=False,
                detail=f"Could not open GPS port {resolved_port}: {error}",
                port_name=resolved_port,
            )

        self._resolved_port = resolved_port
        return GPSOpenResult(
            opened=True,
            present=True,
            detail=f"NMEA serial GPS connected on {resolved_port}.",
            port_name=resolved_port,
        )

    def read_sentence(self) -> bytes | None:
        if self._connection is None:
            return None
        line = self._connection.readline()
        if not line:
            return None
        return bytes(line)

    def release(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    def _load_serial_module(self):
        if self._serial_module is not None:
            return self._serial_module

        try:
            import serial  # type: ignore[import-not-found]
        except ImportError as error:
            raise RuntimeError(
                "pyserial is not installed. Run with the gps extra to enable serial GPS support."
            ) from error

        self._serial_module = serial
        return serial

    def _auto_detect_port(self) -> str | None:
        try:
            from serial.tools import list_ports  # type: ignore[import-not-found]
        except ImportError:
            return None

        matches: list[str] = []
        for port_info in list_ports.comports():
            descriptor = " ".join(
                filter(
                    None,
                    [
                        getattr(port_info, "device", ""),
                        getattr(port_info, "description", ""),
                        getattr(port_info, "manufacturer", ""),
                    ],
                )
            ).lower()
            if any(marker in descriptor for marker in GPS_MARKERS):
                matches.append(str(port_info.device))

        if len(matches) == 1:
            return matches[0]
        return None


class GPSService:
    def __init__(
        self,
        settings: Settings,
        backend_factory: GPSBackendFactory | None = None,
    ) -> None:
        self.settings = settings
        self.backend_factory = backend_factory or SerialGPSBackend
        self.protocol = NMEA0183Protocol()
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._backend: GPSBackend | None = None
        self._backend_config: GPSBackendConfig | None = None
        self._state_lock = asyncio.Lock()
        self._status = GPSMetrics(
            present=None,
            connection_state=ConnectionState.DISCONNECTED,
            source=None,
            updated_at=None,
            detail="GPS disabled.",
        )
        self._parse_errors = 0

    def should_override_snapshot(self) -> bool:
        return self.settings.gps_enabled

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run(), name="pitsight-gps-service")

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await self._release_backend()
        await self._set_status(
            GPSMetrics(
                present=None,
                connection_state=ConnectionState.DISCONNECTED,
                source=self._status.source,
                updated_at=self._status.updated_at,
                detail="GPS service stopped.",
            )
        )

    async def current_status(self) -> GPSMetrics:
        async with self._state_lock:
            return self._status.model_copy(deep=True)

    async def _run(self) -> None:
        while self._running:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception as error:
                current = await self.current_status()
                await self._release_backend()
                await self._set_status(
                    current.model_copy(
                        update={
                            "connection_state": ConnectionState.FAULT,
                            "detail": f"GPS pipeline fault: {error}",
                        }
                    )
                )
                await asyncio.sleep(1.0)

    async def _tick(self) -> None:
        current = await self.current_status()
        if not self.settings.gps_enabled:
            await self._release_backend()
            await self._set_status(
                GPSMetrics(
                    present=None,
                    connection_state=ConnectionState.DISCONNECTED,
                    source="nmea-0183",
                    updated_at=current.updated_at,
                    detail="GPS disabled by configuration.",
                )
            )
            await asyncio.sleep(0.5)
            return

        config = GPSBackendConfig(
            port=self.settings.gps_port,
            baudrate=self.settings.gps_baudrate,
            timeout_seconds=self.settings.gps_timeout_seconds,
        )
        if self._backend is None or self._backend_config != config:
            await self._reconfigure_backend(config)
            await asyncio.sleep(0.1)
            return

        raw_line = await asyncio.to_thread(self._backend.read_sentence)
        if raw_line is None:
            await self._handle_idle()
            return

        messages = self.protocol.feed(raw_line)
        if not messages:
            await self._handle_idle()
            return

        for message in messages:
            try:
                decoded = self.protocol.decode(message)
            except Exception as error:
                self._parse_errors += 1
                if self._parse_errors >= 3:
                    current = await self.current_status()
                    await self._set_status(
                        current.model_copy(
                            update={
                                "connection_state": ConnectionState.DEGRADED,
                                "detail": f"GPS parse noise detected: {error}",
                            }
                        )
                    )
                continue

            await self._apply_decoded_fields(decoded.fields)
            self._parse_errors = 0

    async def _handle_idle(self) -> None:
        current = await self.current_status()
        now = _utcnow()
        if current.updated_at is None:
            await self._set_status(
                current.model_copy(
                    update={
                        "present": True,
                        "connection_state": ConnectionState.CONNECTING,
                        "detail": "GPS connected, awaiting NMEA sentences.",
                    }
                )
            )
            return

        if (now - current.updated_at).total_seconds() >= self.settings.gps_stale_seconds:
            await self._set_status(
                current.model_copy(
                    update={
                        "connection_state": ConnectionState.DEGRADED,
                        "detail": "No recent GPS updates. Last known position is stale.",
                    }
                )
            )

    async def _apply_decoded_fields(self, fields: dict[str, object]) -> None:
        current = await self.current_status()
        now = _utcnow()
        fix_state = fields.get("gps_fix_state")
        latitude = fields.get("gps_latitude")
        longitude = fields.get("gps_longitude")
        speed = fields.get("gps_speed")

        next_status = current.model_copy(
            update={
                "present": True,
                "source": current.source or "nmea-0183",
                "updated_at": now,
                "fix_state": fix_state if fix_state is not None else current.fix_state,
                "latitude": latitude if latitude is not None else current.latitude,
                "longitude": longitude if longitude is not None else current.longitude,
                "speed_kph": round(float(speed), 1) if speed is not None else current.speed_kph,
            }
        )

        if next_status.fix_state is GPSFixState.NO_FIX:
            next_status = next_status.model_copy(
                update={
                    "latitude": None,
                    "longitude": None,
                    "speed_kph": None,
                    "connection_state": ConnectionState.CONNECTED,
                    "detail": "GPS connected, but no valid satellite fix is available yet.",
                }
            )
        elif next_status.fix_state in {GPSFixState.FIX_2D, GPSFixState.FIX_3D, GPSFixState.DGPS}:
            next_status = next_status.model_copy(
                update={
                    "connection_state": ConnectionState.CONNECTED,
                    "detail": f"GPS fix active: {next_status.fix_state.value}.",
                }
            )
        else:
            next_status = next_status.model_copy(
                update={
                    "connection_state": ConnectionState.CONNECTING,
                    "detail": "GPS sentence received, awaiting fix state.",
                }
            )

        await self._set_status(next_status)

    async def _reconfigure_backend(self, config: GPSBackendConfig) -> None:
        await self._release_backend()
        backend = self.backend_factory(config)
        open_result = await asyncio.to_thread(backend.open)
        if not open_result.opened:
            await asyncio.to_thread(backend.release)
            await self._set_status(
                GPSMetrics(
                    present=open_result.present,
                    connection_state=ConnectionState.DISCONNECTED,
                    source="nmea-0183",
                    updated_at=(await self.current_status()).updated_at,
                    detail=open_result.detail,
                )
            )
            await asyncio.sleep(1.0)
            return

        self._backend = backend
        self._backend_config = config
        await self._set_status(
            GPSMetrics(
                present=True,
                connection_state=ConnectionState.CONNECTING,
                source=f"nmea-0183:{open_result.port_name or 'serial'}",
                updated_at=(await self.current_status()).updated_at,
                detail=f"{open_result.detail} Waiting for GPS sentences.",
            )
        )

    async def _release_backend(self) -> None:
        backend = self._backend
        self._backend = None
        self._backend_config = None
        self._parse_errors = 0
        if backend is not None:
            await asyncio.to_thread(backend.release)

    async def _set_status(self, status: GPSMetrics) -> None:
        async with self._state_lock:
            self._status = status
