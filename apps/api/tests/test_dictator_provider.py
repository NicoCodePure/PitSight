from __future__ import annotations

import asyncio
from pathlib import Path

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import DictatorConnectionMethod
from pitsight_api.core.models.telemetry import ConnectionState
from pitsight_api.providers.dictator import DictatorTelemetryProvider


class FakeTransport:
    def __init__(self, frames: list[bytes]) -> None:
        self.frames = frames
        self.connected = False
        self.connect_calls = 0
        self.disconnect_calls = 0
        self.read_calls = 0

    async def connect(self) -> None:
        self.connected = True
        self.connect_calls += 1

    async def disconnect(self) -> None:
        self.connected = False
        self.disconnect_calls += 1

    async def read(self) -> bytes:
        if self.read_calls < len(self.frames):
            frame = self.frames[self.read_calls]
        else:
            frame = b""
        self.read_calls += 1
        return frame


def test_dictator_provider_maps_available_fields_into_canonical_snapshot() -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            provider_mode="dictator",
            dictator_connection_method=DictatorConnectionMethod.USB,
            dictator_port="COM9",
            dictator_hz=4.0,
        )
        transport = FakeTransport(
            [
                b'{"rpm":3150,"speed_mph":52.0,"water_temp_f":194.0,"oil_pressure_psi":43.5,"battery_v":13.8,"tps":27.3,"iat_c":31.2,"fuel_pressure_kpa":295.0,"lambda":1.02}\n'
            ]
        )
        provider = DictatorTelemetryProvider(
            settings=settings,
            transport_factory=lambda _config: transport,
        )
        await provider.start("dictator-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        assert transport.connect_calls == 1
        assert snapshot.source.provider.value == "dictator"
        assert snapshot.source.connection_state is ConnectionState.CONNECTED
        assert snapshot.source.connected is True
        assert snapshot.source.transport == "COM9"
        assert snapshot.engine.rpm == 3150
        assert snapshot.engine.speed_kph == 83.7
        assert snapshot.engine.water_temp_c == 90.0
        assert snapshot.engine.oil_pressure_bar == 3.0
        assert snapshot.engine.battery_voltage_v == 13.8
        assert snapshot.engine.throttle_position_pct == 27.3
        assert snapshot.engine.intake_temp_c == 31.2
        assert snapshot.engine.lambda_value == 1.02
        assert snapshot.fuel.pressure_bar == 2.95
        assert snapshot.gps.speed_kph is None
        assert "speed" in snapshot.source.details["observed_metrics"]
        assert "oil_pressure" in snapshot.source.details["available_metrics"]

    asyncio.run(scenario())


def test_dictator_provider_leaves_speed_unavailable_when_source_does_not_supply_it() -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            provider_mode="dictator",
            dictator_connection_method=DictatorConnectionMethod.USB,
            dictator_port="COM10",
        )
        provider = DictatorTelemetryProvider(
            settings=settings,
            transport_factory=lambda _config: FakeTransport(
                [b"rpm=2840;water_temp=91.5;oil_pressure=2.8;battery=13.6;fuel_level=42.0\n"]
            ),
        )
        await provider.start("dictator-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        assert snapshot.source.connection_state is ConnectionState.CONNECTED
        assert snapshot.engine.rpm == 2840
        assert snapshot.engine.speed_kph is None
        assert snapshot.engine.water_temp_c == 91.5
        assert snapshot.engine.oil_pressure_bar == 2.8
        assert snapshot.fuel.level_percent == 42.0
        assert "speed" not in snapshot.source.details["available_metrics"]

    asyncio.run(scenario())


def test_dictator_provider_reports_wireless_as_future_transport() -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            provider_mode="dictator",
            dictator_connection_method=DictatorConnectionMethod.WIRELESS,
        )
        provider = DictatorTelemetryProvider(settings=settings)
        await provider.start("dictator-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        assert snapshot.source.connection_state is ConnectionState.DISCONNECTED
        assert snapshot.source.connected is False
        assert "future slice" in snapshot.source.details["detail"].lower()

    asyncio.run(scenario())


def test_dictator_provider_writes_raw_capture_when_enabled(tmp_path: Path) -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            provider_mode="dictator",
            dictator_connection_method=DictatorConnectionMethod.USB,
            dictator_port="COM11",
            dictator_raw_capture_enabled=True,
            dictator_raw_capture_dir=tmp_path,
        )
        provider = DictatorTelemetryProvider(
            settings=settings,
            transport_factory=lambda _config: FakeTransport([b"rpm=3010;oil_pressure=3.1\n"]),
        )
        await provider.start("dictator-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
        finally:
            await stream.aclose()
            await provider.stop()

        capture_path = tmp_path / "dictator-session.log"
        assert snapshot.source.raw_capture_enabled is True
        assert capture_path.exists()
        assert "rpm=3010" in capture_path.read_text(encoding="utf-8")

    asyncio.run(scenario())
