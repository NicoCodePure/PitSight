from __future__ import annotations

import asyncio
import binascii
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from pitsight_api.config import Settings
from pitsight_api.core.canonical_telemetry import build_snapshot_from_canonical
from pitsight_api.core.models.app_settings import DictatorConnectionMethod
from pitsight_api.core.models.telemetry import ConnectionState, ProviderName, SourceStatus, TelemetrySnapshot
from pitsight_api.protocol.dictator import DictatorProtocol
from pitsight_api.providers.base import ProviderMetadata, TelemetryProvider
from pitsight_api.transport.base import TelemetryTransport
from pitsight_api.transport.serial import SerialTransport, SerialTransportConfig

DICTATOR_USB_PORT_MARKERS = ("dictator", "usb serial", "uart", "ftdi", "cp210", "ch340", "ttl")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _format_exception(error: Exception) -> str:
    return f"{type(error).__name__}: {error}"


@dataclass(frozen=True, slots=True)
class DictatorProviderConfig:
    connection_method: DictatorConnectionMethod
    port: str | None
    baudrate: int
    timeout_seconds: float
    stale_seconds: float
    raw_capture_enabled: bool
    raw_capture_dir: Path


@dataclass(frozen=True, slots=True)
class DictatorConnectionStatus:
    connection_state: ConnectionState
    connected: bool
    detail: str
    resolved_transport: str
    port_name: str | None = None
    scanned_ports: tuple[str, ...] = ()


DictatorTransportFactory = Callable[[SerialTransportConfig], TelemetryTransport]


class DictatorTelemetryProvider(TelemetryProvider):
    def __init__(
        self,
        settings: Settings,
        transport_factory: DictatorTransportFactory | None = None,
        protocol: DictatorProtocol | None = None,
    ) -> None:
        self.settings = settings
        self.metadata = ProviderMetadata(
            name=ProviderName.DICTATOR,
            transport="usb-or-wireless",
            protocol="dictator-flex-v1",
            raw_capture_supported=True,
            poll_interval_seconds=settings.dictator_interval_seconds,
        )
        self.provider_config = DictatorProviderConfig(
            connection_method=settings.dictator_connection_method,
            port=settings.dictator_port,
            baudrate=settings.dictator_baudrate,
            timeout_seconds=settings.dictator_timeout_seconds,
            stale_seconds=settings.dictator_stale_seconds,
            raw_capture_enabled=settings.dictator_raw_capture_enabled,
            raw_capture_dir=settings.dictator_raw_capture_dir,
        )
        self.transport_factory = transport_factory or (lambda config: SerialTransport(config))
        self.protocol = protocol or DictatorProtocol()
        self._transport: TelemetryTransport | None = None
        self._running = False
        self._sequence = 0
        self._session_id = ""
        self._session_started = 0.0
        self._latest_metrics: dict[str, int | float | None] = {}
        self._observed_metrics: set[str] = set()
        self._last_frame_at: datetime | None = None
        self._last_frame_preview: str | None = None
        self._parse_error_count = 0
        self._mapped_frame_count = 0
        self._last_error: str | None = None
        self._resolved_port: str | None = None
        self._scanned_ports: tuple[str, ...] = ()
        self._raw_capture_path: Path | None = None

    async def start(self, session_id: str) -> None:
        self._running = True
        self._sequence = 0
        self._session_id = session_id
        self._session_started = time.monotonic()
        self._latest_metrics = {}
        self._observed_metrics = set()
        self._last_frame_at = None
        self._last_frame_preview = None
        self._parse_error_count = 0
        self._mapped_frame_count = 0
        self._last_error = None
        self._resolved_port = None
        self._scanned_ports = ()
        self._transport = None
        self._raw_capture_path = None

        if self.provider_config.raw_capture_enabled:
            self.provider_config.raw_capture_dir.mkdir(parents=True, exist_ok=True)
            self._raw_capture_path = self.provider_config.raw_capture_dir / f"{session_id}.log"

    async def stop(self) -> None:
        self._running = False
        if self._transport is not None:
            await self._transport.disconnect()
            self._transport = None

    async def stream(self):
        while self._running:
            yield await self._build_snapshot()
            await asyncio.sleep(self.metadata.poll_interval_seconds)

    async def _build_snapshot(self) -> TelemetrySnapshot:
        timestamp = _utcnow()
        elapsed_ms = int(max(0.0, time.monotonic() - self._session_started) * 1000)
        metrics: dict[str, int | float | str | bool | None] = {
            "session_elapsed": elapsed_ms,
            "drive_time": elapsed_ms,
            "stint_time": elapsed_ms,
        }

        connection_status = await self._ensure_transport()
        if self._transport is not None:
            await self._read_and_decode_frames()
            connection_status = self._derive_connection_status()

        metrics["source_state"] = connection_status.connection_state
        metrics.update(self._latest_metrics)

        source_status = SourceStatus(
            provider=ProviderName.DICTATOR,
            transport=connection_status.port_name or connection_status.resolved_transport,
            protocol=self.metadata.protocol,
            connection_state=connection_status.connection_state,
            connected=connection_status.connected,
            raw_capture_enabled=self.provider_config.raw_capture_enabled,
            details={
                "connection_method": self.provider_config.connection_method.value,
                "configured_port": self.provider_config.port or "AUTO",
                "resolved_port": connection_status.port_name,
                "detail": connection_status.detail,
                "observed_metrics": sorted(self._observed_metrics),
                "available_metrics": sorted(
                    key for key, value in self._latest_metrics.items() if value is not None
                ),
                "parse_error_count": self._parse_error_count,
                "mapped_frame_count": self._mapped_frame_count,
                "last_frame_at": self._last_frame_at.isoformat() if self._last_frame_at else None,
                "last_frame_preview": self._last_frame_preview,
                "last_error": self._last_error,
                "scanned_ports": list(connection_status.scanned_ports),
                "raw_capture_path": str(self._raw_capture_path) if self._raw_capture_path else None,
            },
        )

        snapshot = build_snapshot_from_canonical(
            session_id=self._session_id,
            sequence=self._sequence,
            timestamp=timestamp,
            source_status=source_status,
            metrics=metrics,
        )
        self._sequence += 1
        return snapshot

    async def _ensure_transport(self) -> DictatorConnectionStatus:
        if self.provider_config.connection_method is DictatorConnectionMethod.WIRELESS:
            return DictatorConnectionStatus(
                connection_state=ConnectionState.DISCONNECTED,
                connected=False,
                detail="Dictator wireless transport is reserved for a future slice. USB is the supported path today.",
                resolved_transport="dictator-wireless",
            )

        if self._transport is not None:
            return self._derive_connection_status()

        resolved_port = await asyncio.to_thread(self._resolve_usb_port)
        if resolved_port is None:
            return DictatorConnectionStatus(
                connection_state=ConnectionState.DISCONNECTED,
                connected=False,
                detail="No Dictator USB serial port is configured or auto-detected.",
                resolved_transport=self.metadata.transport,
                scanned_ports=self._scanned_ports,
            )

        self._resolved_port = resolved_port
        transport = self.transport_factory(
            SerialTransportConfig(
                port=resolved_port,
                baudrate=self.provider_config.baudrate,
                timeout_seconds=self.provider_config.timeout_seconds,
            )
        )
        try:
            await transport.connect()
        except Exception as error:
            self._last_error = _format_exception(error)
            self._transport = None
            return DictatorConnectionStatus(
                connection_state=ConnectionState.FAULT,
                connected=False,
                detail=f"Could not open Dictator USB transport on {resolved_port}: {self._last_error}",
                resolved_transport=self.metadata.transport,
                port_name=resolved_port,
                scanned_ports=self._scanned_ports,
            )

        self._transport = transport
        self._last_error = None
        return DictatorConnectionStatus(
            connection_state=ConnectionState.CONNECTING,
            connected=False,
            detail=f"Dictator USB transport connected on {resolved_port}, waiting for telemetry frames.",
            resolved_transport="dictator-usb",
            port_name=resolved_port,
            scanned_ports=self._scanned_ports,
        )

    async def _read_and_decode_frames(self) -> None:
        if self._transport is None:
            return

        try:
            raw_chunk = await self._transport.read()
        except Exception as error:
            self._last_error = _format_exception(error)
            self._last_frame_preview = None
            await self._transport.disconnect()
            self._transport = None
            return

        if not raw_chunk:
            return

        messages = self.protocol.feed(raw_chunk)
        if not messages:
            self._last_frame_preview = self._preview_bytes(raw_chunk)
            if self.provider_config.raw_capture_enabled:
                await self._write_raw_capture(raw_chunk, _utcnow())
            return

        captured_at = _utcnow()
        if self.provider_config.raw_capture_enabled:
            await self._write_raw_capture(raw_chunk, captured_at)

        for message in messages:
            self._last_frame_preview = self._preview_bytes(message)
            try:
                decoded = self.protocol.decode(message)
            except Exception as error:
                self._parse_error_count += 1
                self._last_error = _format_exception(error)
                continue

            self._latest_metrics.update(decoded.fields)
            self._observed_metrics.update(decoded.fields.keys())
            self._mapped_frame_count += 1
            self._parse_error_count = 0
            self._last_frame_at = decoded.captured_at
            self._last_error = None

    def _derive_connection_status(self) -> DictatorConnectionStatus:
        if self.provider_config.connection_method is DictatorConnectionMethod.WIRELESS:
            return DictatorConnectionStatus(
                connection_state=ConnectionState.DISCONNECTED,
                connected=False,
                detail="Dictator wireless transport is reserved for a future slice. USB is the supported path today.",
                resolved_transport="dictator-wireless",
                scanned_ports=self._scanned_ports,
            )

        if self._transport is None:
            state = ConnectionState.FAULT if self._last_error else ConnectionState.DISCONNECTED
            detail = self._last_error or "Dictator USB transport is not connected."
            return DictatorConnectionStatus(
                connection_state=state,
                connected=False,
                detail=detail,
                resolved_transport=self.metadata.transport,
                port_name=self._resolved_port,
                scanned_ports=self._scanned_ports,
            )

        if self._last_frame_at is None:
            state = ConnectionState.DEGRADED if self._parse_error_count >= 3 else ConnectionState.CONNECTING
            detail = (
                f"Connected on {self._resolved_port}, but received {self._parse_error_count} unmapped or invalid frames."
                if self._parse_error_count >= 3
                else f"Connected on {self._resolved_port}, waiting for Dictator telemetry frames."
            )
            return DictatorConnectionStatus(
                connection_state=state,
                connected=state is ConnectionState.DEGRADED,
                detail=detail,
                resolved_transport="dictator-usb",
                port_name=self._resolved_port,
                scanned_ports=self._scanned_ports,
            )

        age_seconds = (_utcnow() - self._last_frame_at).total_seconds()
        if age_seconds >= self.provider_config.stale_seconds:
            return DictatorConnectionStatus(
                connection_state=ConnectionState.DEGRADED,
                connected=True,
                detail="Dictator telemetry is stale. Last known values are being held until fresh frames arrive.",
                resolved_transport="dictator-usb",
                port_name=self._resolved_port,
                scanned_ports=self._scanned_ports,
            )

        if self._parse_error_count >= 3:
            return DictatorConnectionStatus(
                connection_state=ConnectionState.DEGRADED,
                connected=True,
                detail="Dictator link is active, but frame parsing is degraded.",
                resolved_transport="dictator-usb",
                port_name=self._resolved_port,
                scanned_ports=self._scanned_ports,
            )

        return DictatorConnectionStatus(
            connection_state=ConnectionState.CONNECTED,
            connected=True,
            detail="Dictator telemetry frames are being decoded successfully.",
            resolved_transport="dictator-usb",
            port_name=self._resolved_port,
            scanned_ports=self._scanned_ports,
        )

    def _resolve_usb_port(self) -> str | None:
        configured_port = (self.provider_config.port or "").strip()
        if configured_port and configured_port.upper() != "AUTO":
            self._scanned_ports = (configured_port,)
            return configured_port

        try:
            from serial.tools import list_ports  # type: ignore[import-not-found]
        except ImportError:
            self._scanned_ports = ()
            return None

        port_infos = list(list_ports.comports())
        self._scanned_ports = tuple(str(getattr(port, "device", "")) for port in port_infos if getattr(port, "device", ""))
        if len(port_infos) == 1:
            return str(port_infos[0].device)

        matches: list[str] = []
        for port_info in port_infos:
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
            if any(marker in descriptor for marker in DICTATOR_USB_PORT_MARKERS):
                matches.append(str(port_info.device))

        if len(matches) == 1:
            return matches[0]
        return None

    async def _write_raw_capture(self, raw_frame: bytes, captured_at: datetime) -> None:
        if self._raw_capture_path is None:
            return
        await asyncio.to_thread(self._append_raw_capture_line, raw_frame, captured_at)

    def _append_raw_capture_line(self, raw_frame: bytes, captured_at: datetime) -> None:
        if self._raw_capture_path is None:
            return
        self._raw_capture_path.parent.mkdir(parents=True, exist_ok=True)
        preview = self._preview_bytes(raw_frame)
        with self._raw_capture_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{captured_at.isoformat()} | {preview}\n")

    def _preview_bytes(self, raw_frame: bytes, limit: int = 180) -> str:
        text = raw_frame.decode("utf-8", errors="ignore").strip()
        if text:
            compact = " ".join(text.split())
            return compact[:limit]
        return binascii.hexlify(raw_frame[: limit // 2]).decode("ascii")
