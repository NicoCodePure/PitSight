from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from pitsight_api.config import Settings
from pitsight_api.core.canonical_telemetry import build_snapshot_from_canonical
from pitsight_api.core.models.telemetry import ConnectionState, ProviderName, SourceStatus, TelemetrySnapshot
from pitsight_api.providers.base import ProviderMetadata, TelemetryProvider


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _format_exception(error: Exception) -> str:
    return f"{type(error).__name__}: {error}"


@dataclass(frozen=True, slots=True)
class OBD2ClientConfig:
    port: str | None
    baudrate: int | None
    protocol: str | None
    fast: bool
    timeout_seconds: float
    check_voltage: bool
    start_low_power: bool


@dataclass(frozen=True, slots=True)
class OBD2ClientStatus:
    connection_state: ConnectionState
    connected: bool
    status_name: str
    detail: str
    port_name: str | None = None
    protocol_name: str | None = None
    scanned_ports: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class OBD2MetricBinding:
    canonical_key: str
    command_names: tuple[str, ...]
    unit_name: str | None = None
    core: bool = False


class OBD2DependencyUnavailable(RuntimeError):
    pass


class OBD2Client(Protocol):
    def connect(self) -> OBD2ClientStatus:
        ...

    def status(self) -> OBD2ClientStatus:
        ...

    def close(self) -> None:
        ...

    def supports(self, command_name: str) -> bool | None:
        ...

    def query(self, command_name: str, unit_name: str | None = None) -> float | None:
        ...


OBD2_BINDINGS: tuple[OBD2MetricBinding, ...] = (
    OBD2MetricBinding("rpm", ("RPM",), core=True),
    OBD2MetricBinding("speed", ("SPEED",), unit_name="kph", core=True),
    OBD2MetricBinding("coolant_temp", ("COOLANT_TEMP",), unit_name="celsius", core=True),
    OBD2MetricBinding("battery_voltage", ("CONTROL_MODULE_VOLTAGE", "ELM_VOLTAGE"), unit_name="volt"),
    OBD2MetricBinding("throttle_position", ("THROTTLE_POS",), unit_name="percent"),
    OBD2MetricBinding("intake_temp", ("INTAKE_TEMP",), unit_name="celsius"),
    OBD2MetricBinding("fuel_level", ("FUEL_LEVEL",), unit_name="percent"),
    OBD2MetricBinding("fuel_pressure", ("FUEL_PRESSURE",), unit_name="bar"),
)


class PythonOBDClient:
    def __init__(self, config: OBD2ClientConfig) -> None:
        self.config = config
        self._obd_module = None
        self._connection = None

    def connect(self) -> OBD2ClientStatus:
        if self._connection is not None:
            current_status = self.status()
            if current_status.connection_state is not ConnectionState.DISCONNECTED:
                return current_status
            self.close()

        obd = self._load_obd_module()
        portstr = self.config.port or None
        self._connection = obd.OBD(
            portstr=portstr,
            baudrate=self.config.baudrate,
            protocol=self.config.protocol,
            fast=self.config.fast,
            timeout=self.config.timeout_seconds,
            check_voltage=self.config.check_voltage,
            start_low_power=self.config.start_low_power,
        )
        return self.status()

    def status(self) -> OBD2ClientStatus:
        if self._connection is None or self._obd_module is None:
            return OBD2ClientStatus(
                connection_state=ConnectionState.DISCONNECTED,
                connected=False,
                status_name="NOT_CONNECTED",
                detail="No ELM327 adapter connection is open.",
                port_name=self.config.port,
                protocol_name=self.config.protocol,
                scanned_ports=self._scan_ports(),
            )

        raw_status = self._connection.status()
        status_name = self._status_name(raw_status)
        state, connected = self._map_status(raw_status)
        port_name = getattr(self._connection, "port_name", lambda: None)()
        protocol_name = getattr(self._connection, "protocol_name", lambda: None)()
        detail = self._detail_for_status(status_name, port_name, protocol_name)

        return OBD2ClientStatus(
            connection_state=state,
            connected=connected,
            status_name=status_name,
            detail=detail,
            port_name=port_name,
            protocol_name=protocol_name,
            scanned_ports=() if connected else self._scan_ports(),
        )

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    def supports(self, command_name: str) -> bool | None:
        if self._connection is None or self._obd_module is None:
            return None
        command = getattr(self._obd_module.commands, command_name, None)
        if command is None:
            return None
        try:
            return bool(self._connection.supports(command))
        except Exception:
            return None

    def query(self, command_name: str, unit_name: str | None = None) -> float | None:
        if self._connection is None or self._obd_module is None:
            return None

        command = getattr(self._obd_module.commands, command_name, None)
        if command is None:
            return None

        response = self._connection.query(command)
        if response is None or response.is_null():
            return None
        return self._coerce_numeric_value(response.value, unit_name)

    def _load_obd_module(self):
        if self._obd_module is not None:
            return self._obd_module

        try:
            import obd  # type: ignore[import-not-found]
        except ImportError as error:
            raise OBD2DependencyUnavailable(
                "python-OBD is not installed. Run with the obd2 extra to enable OBD2 support."
            ) from error

        self._obd_module = obd
        return obd

    def _scan_ports(self) -> tuple[str, ...]:
        try:
            obd = self._load_obd_module()
            ports = obd.scan_serial()
        except Exception:
            return ()

        if ports is None:
            return ()
        return tuple(str(port) for port in ports)

    def _status_name(self, raw_status: Any) -> str:
        if hasattr(raw_status, "name"):
            return str(raw_status.name)
        text = str(raw_status).strip().upper().replace(" ", "_")
        return text or "UNKNOWN"

    def _map_status(self, raw_status: Any) -> tuple[ConnectionState, bool]:
        if self._obd_module is None:
            return ConnectionState.DISCONNECTED, False

        obd_status = self._obd_module.OBDStatus
        if raw_status == obd_status.CAR_CONNECTED:
            return ConnectionState.CONNECTED, True
        if raw_status == obd_status.OBD_CONNECTED:
            return ConnectionState.DEGRADED, True
        if raw_status == obd_status.ELM_CONNECTED:
            return ConnectionState.CONNECTING, False
        return ConnectionState.DISCONNECTED, False

    def _detail_for_status(
        self,
        status_name: str,
        port_name: str | None,
        protocol_name: str | None,
    ) -> str:
        target = port_name or self.config.port or "auto-detected adapter"
        if status_name == "CAR_CONNECTED":
            protocol_detail = f" using {protocol_name}" if protocol_name else ""
            return f"Vehicle connected through {target}{protocol_detail}."
        if status_name == "OBD_CONNECTED":
            return f"Adapter handshake succeeded on {target}, but the vehicle link is only partially initialized."
        if status_name == "ELM_CONNECTED":
            return f"ELM327 adapter detected on {target}, waiting for a stable vehicle protocol."
        return f"No OBD2 adapter connection is available on {target}."

    def _coerce_numeric_value(self, value: Any, unit_name: str | None) -> float | None:
        if value is None:
            return None

        if unit_name and self._obd_module is not None and hasattr(value, "to"):
            try:
                target_unit = getattr(self._obd_module.Unit, unit_name)
                value = value.to(target_unit)
            except Exception:
                pass

        magnitude = getattr(value, "magnitude", None)
        if magnitude is not None:
            try:
                return float(magnitude)
            except (TypeError, ValueError):
                return None

        if isinstance(value, (int, float)):
            return float(value)

        if isinstance(value, str):
            match = re.search(r"-?\d+(?:\.\d+)?", value)
            if match:
                return float(match.group(0))
        return None


OBD2ClientFactory = Callable[[OBD2ClientConfig], OBD2Client]


class OBD2TelemetryProvider(TelemetryProvider):
    def __init__(
        self,
        settings: Settings,
        client_factory: OBD2ClientFactory | None = None,
    ) -> None:
        self.settings = settings
        self.metadata = ProviderMetadata(
            name=ProviderName.OBD2,
            transport="usb-or-bluetooth",
            protocol="elm327",
            raw_capture_supported=False,
            poll_interval_seconds=settings.obd_interval_seconds,
        )
        self.client_factory = client_factory or PythonOBDClient
        self.client_config = OBD2ClientConfig(
            port=settings.obd_port,
            baudrate=settings.obd_baudrate,
            protocol=settings.obd_protocol,
            fast=settings.obd_fast,
            timeout_seconds=settings.obd_timeout_seconds,
            check_voltage=settings.obd_check_voltage,
            start_low_power=settings.obd_start_low_power,
        )
        self._client: OBD2Client | None = None
        self._running = False
        self._sequence = 0
        self._session_id = ""
        self._session_started = 0.0
        self._last_error: str | None = None

    async def start(self, session_id: str) -> None:
        self._running = True
        self._sequence = 0
        self._session_id = session_id
        self._session_started = time.monotonic()
        self._last_error = None
        self._client = self.client_factory(self.client_config)

    async def stop(self) -> None:
        self._running = False
        if self._client is not None:
            await asyncio.to_thread(self._client.close)
            self._client = None

    async def stream(self):
        while self._running:
            yield await self._build_snapshot()
            await asyncio.sleep(self.metadata.poll_interval_seconds)

    async def _build_snapshot(self) -> TelemetrySnapshot:
        timestamp = _utcnow()
        elapsed_ms = int(max(0.0, time.monotonic() - self._session_started) * 1000)

        if self._client is None:
            self._client = self.client_factory(self.client_config)

        try:
            client_status = await asyncio.to_thread(self._client.connect)
            self._last_error = None
        except OBD2DependencyUnavailable as error:
            self._last_error = str(error)
            client_status = OBD2ClientStatus(
                connection_state=ConnectionState.FAULT,
                connected=False,
                status_name="DEPENDENCY_MISSING",
                detail=str(error),
                port_name=self.client_config.port,
                protocol_name=self.client_config.protocol,
            )
        except Exception as error:
            self._last_error = _format_exception(error)
            client_status = OBD2ClientStatus(
                connection_state=ConnectionState.DISCONNECTED,
                connected=False,
                status_name="CONNECT_FAILED",
                detail=self._last_error,
                port_name=self.client_config.port,
                protocol_name=self.client_config.protocol,
            )
            if self._client is not None:
                await asyncio.to_thread(self._client.close)
                self._client = self.client_factory(self.client_config)

        metrics: dict[str, int | float | str | bool | None] = {
            "source_state": client_status.connection_state,
            "session_elapsed": elapsed_ms,
            "drive_time": elapsed_ms,
            "stint_time": elapsed_ms,
        }

        observed_metrics: list[str] = []
        supported_metrics: list[str] = []
        query_errors: list[str] = []

        if self._client is not None and client_status.connected:
            for binding in OBD2_BINDINGS:
                support_states: list[bool] = []
                resolved_value: float | None = None

                for command_name in binding.command_names:
                    support = await asyncio.to_thread(self._client.supports, command_name)
                    if support is True:
                        support_states.append(True)
                    elif support is False:
                        support_states.append(False)

                    try:
                        value = await asyncio.to_thread(
                            self._client.query,
                            command_name,
                            binding.unit_name,
                        )
                    except Exception as error:
                        query_errors.append(f"{command_name}: {_format_exception(error)}")
                        continue

                    if value is None:
                        continue

                    resolved_value = self._round_metric(binding.canonical_key, value)
                    break

                if resolved_value is not None:
                    metrics[binding.canonical_key] = resolved_value
                    observed_metrics.append(binding.canonical_key)

                if True in support_states or resolved_value is not None:
                    supported_metrics.append(binding.canonical_key)

        core_observed = any(binding.core and binding.canonical_key in observed_metrics for binding in OBD2_BINDINGS)
        connection_state = client_status.connection_state
        if client_status.connected and (query_errors or not core_observed):
            connection_state = ConnectionState.DEGRADED
            metrics["source_state"] = connection_state

        source_status = SourceStatus(
            provider=ProviderName.OBD2,
            transport=client_status.port_name or self.metadata.transport,
            protocol=client_status.protocol_name or self.metadata.protocol,
            connection_state=connection_state,
            connected=client_status.connected and connection_state is not ConnectionState.DISCONNECTED,
            raw_capture_enabled=False,
            details={
                "obd_status": client_status.status_name,
                "configured_port": self.client_config.port or "AUTO",
                "configured_protocol": self.client_config.protocol or "AUTO",
                "detail": client_status.detail,
                "supported_metrics": supported_metrics,
                "observed_metrics": observed_metrics,
                "query_error_count": len(query_errors),
                "query_errors": query_errors[:5],
                "scanned_ports": list(client_status.scanned_ports),
                "last_error": self._last_error,
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

    @staticmethod
    def _round_metric(metric_key: str, value: float) -> float:
        if metric_key in {"rpm"}:
            return round(value, 0)
        if metric_key in {"speed", "coolant_temp", "intake_temp", "battery_voltage"}:
            return round(value, 1)
        if metric_key in {"throttle_position", "fuel_level"}:
            return round(value, 1)
        if metric_key in {"fuel_pressure"}:
            return round(value, 2)
        return round(value, 3)
