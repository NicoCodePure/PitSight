from __future__ import annotations

import asyncio

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    AlertThresholdSettings,
    AppSettingsSnapshot,
    CameraHardwareSource,
    CameraMode,
    DeviceCameraSettings,
    DeviceLocalSettings,
    EffectiveSettingsSnapshot,
    SharedSettings,
    WebOperatorSettings,
)
from pitsight_api.core.models.telemetry import CameraState, CameraViewMode
from pitsight_api.services.camera_service import (
    STREAM_PATH,
    CameraBackendConfig,
    CameraOpenResult,
    CameraService,
)


class StubSettingsService:
    def __init__(self, snapshot: AppSettingsSnapshot) -> None:
        self._snapshot = snapshot

    def current(self) -> AppSettingsSnapshot:
        return self._snapshot


class FakeCameraBackend:
    def __init__(
        self,
        open_result: CameraOpenResult,
        frames: list[bytes | None],
    ) -> None:
        self.open_result = open_result
        self.frames = frames
        self.read_calls = 0

    def open(self) -> CameraOpenResult:
        return self.open_result

    def read_frame(self) -> bytes | None:
        if self.read_calls < len(self.frames):
            frame = self.frames[self.read_calls]
        else:
            frame = self.frames[-1] if self.frames else None
        self.read_calls += 1
        return frame

    def release(self) -> None:
        return None


def build_snapshot(
    *,
    camera_enabled: bool,
    camera_source: CameraHardwareSource,
    camera_mode: CameraMode,
) -> AppSettingsSnapshot:
    device_local = DeviceLocalSettings(
        camera=DeviceCameraSettings(
            camera_enabled=camera_enabled,
            camera_hardware_source=camera_source,
        )
    )
    shared = SharedSettings(
        thresholds=AlertThresholdSettings(
            oil_pressure_advisory_bar=1.9,
            oil_pressure_warning_bar=1.5,
            oil_pressure_critical_bar=1.0,
            water_temp_advisory_c=100.0,
            water_temp_warning_c=105.0,
            water_temp_critical_c=112.0,
            oil_temp_advisory_c=115.0,
            oil_temp_warning_c=120.0,
            oil_temp_critical_c=130.0,
            battery_voltage_advisory_v=12.2,
            battery_voltage_warning_v=11.8,
            battery_voltage_critical_v=11.2,
            fuel_pressure_advisory_bar=3.0,
            fuel_pressure_warning_bar=2.6,
            fuel_pressure_critical_bar=2.2,
            lambda_advisory_delta=0.03,
            lambda_warning_delta=0.06,
            lambda_critical_delta=0.1,
            fuel_level_warning_percent=15.0,
        ),
        camera_mode_preference=camera_mode,
    )
    return AppSettingsSnapshot(
        device_local=device_local,
        shared=shared,
        web=WebOperatorSettings(),
        effective=EffectiveSettingsSnapshot(
            device_local=device_local,
            shared=shared,
        ),
    )


def test_camera_service_reports_disabled_when_capture_is_off() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, camera_capture_fps=20.0)
        snapshot = build_snapshot(
            camera_enabled=False,
            camera_source=CameraHardwareSource.USB_CAM,
            camera_mode=CameraMode.ROAD,
        )
        service = CameraService(settings, StubSettingsService(snapshot))
        await service.start()
        try:
            await asyncio.sleep(0.1)
            status = await service.current_status()
            assert status.state is CameraState.DISABLED
            assert status.mode is CameraViewMode.DISABLED
            assert status.stream_url is None
        finally:
            await service.stop()

    asyncio.run(scenario())


def test_camera_service_reports_live_when_frames_arrive() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, camera_capture_fps=20.0)
        snapshot = build_snapshot(
            camera_enabled=True,
            camera_source=CameraHardwareSource.USB_CAM,
            camera_mode=CameraMode.ROAD,
        )
        service = CameraService(
            settings,
            StubSettingsService(snapshot),
            backend_factory=lambda _config: FakeCameraBackend(
                open_result=CameraOpenResult(opened=True, present=True, detail="USB ready"),
                frames=[b"jpeg-frame"],
            ),
        )
        await service.start()
        try:
            await asyncio.sleep(0.15)
            status = await service.current_status()
            assert status.state is CameraState.LIVE
            assert status.mode is CameraViewMode.ROAD
            assert status.present is True
            assert status.stream_url == STREAM_PATH
            assert status.last_frame_at is not None
            assert await service.latest_frame() == b"jpeg-frame"
        finally:
            await service.stop()

    asyncio.run(scenario())


def test_camera_service_reports_no_signal_when_backend_opens_without_frames() -> None:
    async def scenario() -> None:
        settings = Settings(
            _env_file=None,
            camera_capture_fps=20.0,
            camera_frame_stale_seconds=0.05,
        )
        snapshot = build_snapshot(
            camera_enabled=True,
            camera_source=CameraHardwareSource.PI_CAM,
            camera_mode=CameraMode.DRIVER,
        )
        service = CameraService(
            settings,
            StubSettingsService(snapshot),
            backend_factory=lambda _config: FakeCameraBackend(
                open_result=CameraOpenResult(opened=True, present=True, detail="Pi cam ready"),
                frames=[None, None, None, None],
            ),
        )
        await service.start()
        try:
            await asyncio.sleep(0.25)
            status = await service.current_status()
            assert status.state is CameraState.NO_SIGNAL
            assert status.mode is CameraViewMode.DRIVER
            assert status.present is True
            assert status.stream_url is None
        finally:
            await service.stop()

    asyncio.run(scenario())


def test_camera_service_reports_unavailable_when_camera_cannot_open() -> None:
    async def scenario() -> None:
        settings = Settings(_env_file=None, camera_capture_fps=20.0)
        snapshot = build_snapshot(
            camera_enabled=True,
            camera_source=CameraHardwareSource.USB_CAM,
            camera_mode=CameraMode.ROAD,
        )
        captured_config: list[CameraBackendConfig] = []

        def backend_factory(config: CameraBackendConfig) -> FakeCameraBackend:
            captured_config.append(config)
            return FakeCameraBackend(
                open_result=CameraOpenResult(
                    opened=False,
                    present=False,
                    detail="No USB cam detected.",
                ),
                frames=[],
            )

        service = CameraService(settings, StubSettingsService(snapshot), backend_factory=backend_factory)
        await service.start()
        try:
            await asyncio.sleep(0.15)
            status = await service.current_status()
            assert captured_config[0].hardware_source is CameraHardwareSource.USB_CAM
            assert status.state is CameraState.UNAVAILABLE
            assert status.present is False
            assert "No USB cam detected." in (status.detail or "")
        finally:
            await service.stop()

    asyncio.run(scenario())
