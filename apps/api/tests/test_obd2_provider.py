from __future__ import annotations

import asyncio

from pitsight_api.config import Settings
from pitsight_api.core.models.telemetry import ConnectionState
from pitsight_api.providers.obd2 import (
    OBD2ClientConfig,
    OBD2ClientStatus,
    OBD2DependencyUnavailable,
    OBD2TelemetryProvider,
)


class FakeOBD2Client:
    def __init__(
        self,
        status: OBD2ClientStatus,
        query_values: dict[str, float | None],
        supports_map: dict[str, bool | None] | None = None,
        query_error_commands: set[str] | None = None,
    ) -> None:
        self._status = status
        self._query_values = query_values
        self._supports_map = supports_map or {}
        self._query_error_commands = query_error_commands or set()

    def connect(self) -> OBD2ClientStatus:
        return self._status

    def status(self) -> OBD2ClientStatus:
        return self._status

    def close(self) -> None:
        return None

    def supports(self, command_name: str) -> bool | None:
        return self._supports_map.get(command_name)

    def query(self, command_name: str, unit_name: str | None = None) -> float | None:
        if command_name in self._query_error_commands:
            raise RuntimeError(f"{command_name} failed")
        return self._query_values.get(command_name)


def test_obd2_provider_maps_available_pid_values_into_canonical_snapshot() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, provider_mode="obd2", obd_hz=4.0)
        provider = OBD2TelemetryProvider(
            settings=settings,
            client_factory=lambda _config: FakeOBD2Client(
                status=OBD2ClientStatus(
                    connection_state=ConnectionState.CONNECTED,
                    connected=True,
                    status_name="CAR_CONNECTED",
                    detail="Vehicle connected through COM5.",
                    port_name="COM5",
                    protocol_name="6",
                ),
                query_values={
                    "RPM": 3150.0,
                    "SPEED": 82.4,
                    "COOLANT_TEMP": 91.6,
                    "CONTROL_MODULE_VOLTAGE": None,
                    "ELM_VOLTAGE": 13.9,
                    "THROTTLE_POS": 27.3,
                    "INTAKE_TEMP": 34.1,
                    "FUEL_LEVEL": 46.2,
                    "FUEL_PRESSURE": 2.97,
                },
                supports_map={
                    "RPM": True,
                    "SPEED": True,
                    "COOLANT_TEMP": True,
                    "CONTROL_MODULE_VOLTAGE": False,
                    "ELM_VOLTAGE": True,
                    "THROTTLE_POS": True,
                    "INTAKE_TEMP": True,
                    "FUEL_LEVEL": True,
                    "FUEL_PRESSURE": True,
                },
            ),
        )
        await provider.start("obd-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        assert snapshot.source.provider.value == "obd2"
        assert snapshot.source.connection_state is ConnectionState.CONNECTED
        assert snapshot.source.connected is True
        assert snapshot.source.transport == "COM5"
        assert snapshot.engine.rpm == 3150
        assert snapshot.engine.speed_kph == 82.4
        assert snapshot.engine.water_temp_c == 91.6
        assert snapshot.engine.battery_voltage_v == 13.9
        assert snapshot.engine.throttle_position_pct == 27.3
        assert snapshot.engine.intake_temp_c == 34.1
        assert snapshot.fuel.level_percent == 46.2
        assert snapshot.fuel.pressure_bar == 2.97
        assert snapshot.gps.speed_kph is None
        assert snapshot.session.session_time_ms is not None
        assert "rpm" in snapshot.source.details["implemented_metrics"]
        assert "rpm" in snapshot.source.details["available_metrics"]
        assert "speed" in snapshot.source.details["observed_metrics"]
        assert "rpm" in snapshot.source.details["supported_metrics"]

    asyncio.run(scenario())


def test_obd2_provider_leaves_missing_fields_null_and_marks_degraded_if_core_data_missing() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, provider_mode="obd2", obd_hz=4.0)
        provider = OBD2TelemetryProvider(
            settings=settings,
            client_factory=lambda _config: FakeOBD2Client(
                status=OBD2ClientStatus(
                    connection_state=ConnectionState.CONNECTED,
                    connected=True,
                    status_name="OBD_CONNECTED",
                    detail="Adapter partially initialized.",
                    port_name="AUTO",
                    protocol_name="AUTO",
                ),
                query_values={
                    "RPM": None,
                    "SPEED": None,
                    "COOLANT_TEMP": None,
                    "CONTROL_MODULE_VOLTAGE": 12.8,
                },
                supports_map={
                    "RPM": False,
                    "SPEED": False,
                    "COOLANT_TEMP": False,
                    "CONTROL_MODULE_VOLTAGE": True,
                },
            ),
        )
        await provider.start("obd-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        assert snapshot.source.connection_state is ConnectionState.DEGRADED
        assert snapshot.source.connected is True
        assert snapshot.engine.rpm is None
        assert snapshot.engine.speed_kph is None
        assert snapshot.engine.water_temp_c is None
        assert snapshot.engine.battery_voltage_v == 12.8
        assert snapshot.fuel.level_percent is None
        assert "battery_voltage" in snapshot.source.details["available_metrics"]
        assert "rpm" in snapshot.source.details["unavailable_metrics"]
        assert "speed" in snapshot.source.details["unavailable_metrics"]
        assert "coolant_temp" in snapshot.source.details["unavailable_metrics"]
        assert "battery_voltage" not in snapshot.source.details["unavailable_metrics"]

    asyncio.run(scenario())


def test_obd2_provider_emits_disconnected_snapshot_when_adapter_is_missing() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, provider_mode="obd2", obd_hz=4.0)
        provider = OBD2TelemetryProvider(
            settings=settings,
            client_factory=lambda _config: FakeOBD2Client(
                status=OBD2ClientStatus(
                    connection_state=ConnectionState.DISCONNECTED,
                    connected=False,
                    status_name="NOT_CONNECTED",
                    detail="No OBD2 adapter found.",
                    port_name=None,
                    protocol_name=None,
                    scanned_ports=("COM4", "COM5"),
                ),
                query_values={},
            ),
        )
        await provider.start("obd-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        assert snapshot.source.connection_state is ConnectionState.DISCONNECTED
        assert snapshot.source.connected is False
        assert snapshot.source.details["scanned_ports"] == ["COM4", "COM5"]
        assert snapshot.engine.rpm is None
        assert snapshot.engine.speed_kph is None

    asyncio.run(scenario())


def test_obd2_provider_reports_fault_when_python_obd_dependency_is_missing() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, provider_mode="obd2", obd_hz=4.0)

        def missing_dependency_factory(_config: OBD2ClientConfig):
            class MissingDependencyClient:
                def connect(self):
                    raise OBD2DependencyUnavailable("python-OBD is not installed.")

                def status(self):
                    raise AssertionError("status should not be called")

                def close(self) -> None:
                    return None

                def supports(self, command_name: str):
                    return None

                def query(self, command_name: str, unit_name: str | None = None):
                    return None

            return MissingDependencyClient()

        provider = OBD2TelemetryProvider(
            settings=settings,
            client_factory=missing_dependency_factory,
        )
        await provider.start("obd-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        assert snapshot.source.connection_state is ConnectionState.FAULT
        assert snapshot.source.connected is False
        assert snapshot.source.details["last_error"] == "python-OBD is not installed."

    asyncio.run(scenario())
