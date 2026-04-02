from __future__ import annotations

import asyncio

from pitsight_api.config import Settings
from pitsight_api.core.models.telemetry import ConnectionState, GPSFixState
from pitsight_api.services.gps_service import GPSBackendConfig, GPSOpenResult, GPSService


class FakeGPSBackend:
    def __init__(
        self,
        *,
        open_result: GPSOpenResult,
        sentences: list[bytes | None],
    ) -> None:
        self.open_result = open_result
        self.sentences = sentences
        self.read_calls = 0

    def open(self) -> GPSOpenResult:
        return self.open_result

    def read_sentence(self) -> bytes | None:
        if self.read_calls < len(self.sentences):
            sentence = self.sentences[self.read_calls]
        else:
            sentence = None
        self.read_calls += 1
        return sentence

    def release(self) -> None:
        return None


def test_gps_service_reports_disabled_when_configuration_is_off() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, gps_enabled=False, gps_timeout_seconds=0.01)
        service = GPSService(
            settings=settings,
            backend_factory=lambda _config: FakeGPSBackend(
                open_result=GPSOpenResult(opened=True, present=True, detail="Unexpected GPS"),
                sentences=[],
            ),
        )
        await service.start()
        try:
            await asyncio.sleep(0.1)
            status = await service.current_status()
            assert status.connection_state is ConnectionState.DISCONNECTED
            assert status.present is None
            assert status.detail == "GPS disabled by configuration."
        finally:
            await service.stop()

    asyncio.run(scenario())


def test_gps_service_maps_live_fix_from_nmea_sentences() -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            gps_enabled=True,
            gps_timeout_seconds=0.01,
            gps_stale_seconds=0.5,
        )
        captured_config: list[GPSBackendConfig] = []

        def backend_factory(config: GPSBackendConfig) -> FakeGPSBackend:
            captured_config.append(config)
            return FakeGPSBackend(
                open_result=GPSOpenResult(
                    opened=True,
                    present=True,
                    detail="USB GPS ready.",
                    port_name="COM7",
                ),
                sentences=[
                    b"$GPRMC,092751.000,A,5321.6802,N,00630.3372,W,12.50,054.7,191194,020.3,E\r\n",
                    b"$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K\r\n",
                ],
            )

        service = GPSService(settings=settings, backend_factory=backend_factory)
        await service.start()
        try:
            await asyncio.sleep(0.25)
            status = await service.current_status()
            assert captured_config[0].baudrate == 9600
            assert status.present is True
            assert status.connection_state is ConnectionState.CONNECTED
            assert status.fix_state is GPSFixState.FIX_3D
            assert round(status.latitude or 0, 6) == 53.361337
            assert round(status.longitude or 0, 6) == -6.50562
            assert status.speed_kph == 10.2
            assert status.updated_at is not None
            assert status.source == "nmea-0183:COM7"
            assert status.detail == "GPS fix active: 3d."
        finally:
            await service.stop()

    asyncio.run(scenario())


def test_gps_service_marks_no_fix_without_inventing_position_or_speed() -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            gps_enabled=True,
            gps_timeout_seconds=0.01,
            gps_stale_seconds=0.5,
        )
        service = GPSService(
            settings=settings,
            backend_factory=lambda _config: FakeGPSBackend(
                open_result=GPSOpenResult(
                    opened=True,
                    present=True,
                    detail="USB GPS ready.",
                    port_name="COM8",
                ),
                sentences=[
                    b"$GPRMC,092204.999,V,,,,,,,290923,,,N\r\n",
                ],
            ),
        )
        await service.start()
        try:
            await asyncio.sleep(0.2)
            status = await service.current_status()
            assert status.present is True
            assert status.connection_state is ConnectionState.CONNECTED
            assert status.fix_state is GPSFixState.NO_FIX
            assert status.latitude is None
            assert status.longitude is None
            assert status.speed_kph is None
            assert "no valid satellite fix" in (status.detail or "").lower()
        finally:
            await service.stop()

    asyncio.run(scenario())


def test_gps_service_degrades_when_updates_go_stale() -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            gps_enabled=True,
            gps_timeout_seconds=0.01,
            gps_stale_seconds=0.05,
        )
        service = GPSService(
            settings=settings,
            backend_factory=lambda _config: FakeGPSBackend(
                open_result=GPSOpenResult(
                    opened=True,
                    present=True,
                    detail="USB GPS ready.",
                    port_name="COM9",
                ),
                sentences=[
                    b"$GPRMC,092751.000,A,5321.6802,N,00630.3372,W,12.50,054.7,191194,020.3,E\r\n",
                    None,
                    None,
                    None,
                    None,
                ],
            ),
        )
        await service.start()
        try:
            await asyncio.sleep(0.2)
            status = await service.current_status()
            assert status.present is True
            assert status.connection_state is ConnectionState.DEGRADED
            assert status.fix_state is GPSFixState.FIX_3D
            assert "stale" in (status.detail or "").lower()
        finally:
            await service.stop()

    asyncio.run(scenario())
