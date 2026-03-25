from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import CameraHardwareSource, CameraMode
from pitsight_api.core.models.telemetry import CameraMetrics, CameraState, CameraViewMode
from pitsight_api.services.settings_service import SettingsService

STREAM_PATH = "/api/v1/camera/stream.mjpeg"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True, slots=True)
class CameraBackendConfig:
    hardware_source: CameraHardwareSource
    device_index: int
    frame_width: int
    frame_height: int
    jpeg_quality: int


@dataclass(frozen=True, slots=True)
class CameraOpenResult:
    opened: bool
    present: bool | None
    detail: str


class CameraBackend(Protocol):
    def open(self) -> CameraOpenResult:
        ...

    def read_frame(self) -> bytes | None:
        ...

    def release(self) -> None:
        ...


CameraBackendFactory = Callable[[CameraBackendConfig], CameraBackend]


class OpenCVCameraBackend:
    def __init__(self, config: CameraBackendConfig) -> None:
        self.config = config
        self._cv2 = None
        self._capture = None

    def open(self) -> CameraOpenResult:
        try:
            import cv2  # type: ignore[import-not-found]
        except ImportError:
            return CameraOpenResult(
                opened=False,
                present=None,
                detail="Install the camera extra to enable OpenCV capture on the Pi.",
            )

        backend_flag = cv2.CAP_ANY
        if os.name == "nt" and hasattr(cv2, "CAP_DSHOW"):
            backend_flag = cv2.CAP_DSHOW

        capture = cv2.VideoCapture(self.config.device_index, backend_flag)
        if not capture.isOpened():
            capture.release()
            return CameraOpenResult(
                opened=False,
                present=False,
                detail=(
                    f"No {self.config.hardware_source.value.replace('_', ' ')} camera detected "
                    f"at index {self.config.device_index}."
                ),
            )

        capture.set(cv2.CAP_PROP_FRAME_WIDTH, float(self.config.frame_width))
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, float(self.config.frame_height))
        self._cv2 = cv2
        self._capture = capture
        return CameraOpenResult(
            opened=True,
            present=True,
            detail=(
                f"{self.config.hardware_source.value.replace('_', ' ').upper()} capture ready "
                f"at index {self.config.device_index}."
            ),
        )

    def read_frame(self) -> bytes | None:
        if self._capture is None or self._cv2 is None:
            return None

        ok, frame = self._capture.read()
        if not ok or frame is None:
            return None

        encoded_ok, encoded = self._cv2.imencode(
            ".jpg",
            frame,
            [int(self._cv2.IMWRITE_JPEG_QUALITY), self.config.jpeg_quality],
        )
        if not encoded_ok:
            return None
        return encoded.tobytes()

    def release(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None
        self._cv2 = None


class CameraService:
    def __init__(
        self,
        settings: Settings,
        settings_service: SettingsService,
        backend_factory: CameraBackendFactory | None = None,
    ) -> None:
        self.settings = settings
        self.settings_service = settings_service
        self.backend_factory = backend_factory or OpenCVCameraBackend
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._backend: CameraBackend | None = None
        self._backend_config: CameraBackendConfig | None = None
        self._state_lock = asyncio.Lock()
        self._status = CameraMetrics(
            state=CameraState.DISABLED,
            mode=CameraViewMode.DISABLED,
            detail="Camera disabled.",
            present=None,
            stream_url=None,
            last_frame_at=None,
        )
        self._latest_frame: bytes | None = None
        self._frame_sequence = 0
        self._frame_condition = asyncio.Condition()
        self._consecutive_read_failures = 0

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run(), name="pitsight-camera-service")

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
            CameraMetrics(
                state=CameraState.DISABLED,
                mode=CameraViewMode.DISABLED,
                detail="Camera service stopped.",
                present=None,
                stream_url=None,
                last_frame_at=None,
            ),
            clear_frame=True,
        )

    async def current_status(self) -> CameraMetrics:
        async with self._state_lock:
            return self._status.model_copy(deep=True)

    async def latest_frame(self) -> bytes | None:
        async with self._state_lock:
            return self._latest_frame

    async def mjpeg_stream(self) -> AsyncIterator[bytes]:
        last_sequence = -1
        while self._running:
            async with self._state_lock:
                frame_sequence = self._frame_sequence
                status = self._status
                frame = self._latest_frame

            if status.state is not CameraState.LIVE or frame is None:
                await asyncio.sleep(0.2)
                continue

            if frame_sequence == last_sequence:
                async with self._frame_condition:
                    try:
                        await asyncio.wait_for(self._frame_condition.wait(), timeout=1.0)
                    except asyncio.TimeoutError:
                        pass
                continue

            last_sequence = frame_sequence
            header = (
                b"--frame\r\n"
                + b"Content-Type: image/jpeg\r\n"
                + f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii")
            )
            yield header + frame + b"\r\n"

    async def _run(self) -> None:
        interval_seconds = max(0.1, 1.0 / max(self.settings.camera_capture_fps, 0.1))
        while self._running:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception as error:
                current_status = await self.current_status()
                await self._release_backend()
                await self._set_status(
                    CameraMetrics(
                        state=CameraState.FAULT,
                        mode=self._effective_mode(),
                        detail=f"Camera pipeline fault: {error}",
                        present=None,
                        stream_url=None,
                        last_frame_at=current_status.last_frame_at,
                    ),
                    clear_frame=False,
                )
            await asyncio.sleep(interval_seconds)

    def _effective_mode(self) -> CameraViewMode:
        current_settings = self.settings_service.current().effective.shared.camera_mode_preference
        return self._to_view_mode(current_settings)

    async def _tick(self) -> None:
        effective = self.settings_service.current().effective
        camera_settings = effective.device_local.camera
        mode = self._to_view_mode(effective.shared.camera_mode_preference)
        current_status = await self.current_status()

        if not camera_settings.camera_enabled or mode is CameraViewMode.DISABLED:
            await self._release_backend()
            await self._set_status(
                CameraMetrics(
                    state=CameraState.DISABLED,
                    mode=CameraViewMode.DISABLED,
                    detail="Camera capture is disabled in the effective settings.",
                    present=None,
                    stream_url=None,
                    last_frame_at=current_status.last_frame_at,
                ),
                clear_frame=True,
            )
            return

        if camera_settings.camera_hardware_source is CameraHardwareSource.NONE:
            await self._release_backend()
            await self._set_status(
                CameraMetrics(
                    state=CameraState.UNAVAILABLE,
                    mode=mode,
                    detail="Camera is enabled, but no hardware source is selected.",
                    present=False,
                    stream_url=None,
                    last_frame_at=current_status.last_frame_at,
                ),
                clear_frame=True,
            )
            return

        if camera_settings.camera_hardware_source is CameraHardwareSource.NETWORK_STREAM:
            await self._release_backend()
            await self._set_status(
                CameraMetrics(
                    state=CameraState.UNAVAILABLE,
                    mode=mode,
                    detail="Network stream camera support is not implemented in this slice.",
                    present=None,
                    stream_url=None,
                    last_frame_at=current_status.last_frame_at,
                ),
                clear_frame=True,
            )
            return

        config = self._build_backend_config(camera_settings.camera_hardware_source)
        if self._backend is None or self._backend_config != config:
            await self._reconfigure_backend(config, mode)
            return

        frame = await asyncio.to_thread(self._backend.read_frame)
        if frame is not None:
            await self._publish_frame(frame=frame, mode=mode, detail=self._live_detail(config))
            self._consecutive_read_failures = 0
            return

        self._consecutive_read_failures += 1
        last_frame_at = current_status.last_frame_at
        stale_seconds = (
            (max((_utcnow() - last_frame_at).total_seconds(), 0.0) if last_frame_at is not None else None)
        )
        no_signal = (
            last_frame_at is None
            or stale_seconds is None
            or stale_seconds >= self.settings.camera_frame_stale_seconds
            or self._consecutive_read_failures >= 3
        )

        if no_signal:
            await self._set_status(
                CameraMetrics(
                    state=CameraState.NO_SIGNAL,
                    mode=mode,
                    detail="Camera transport is open, but no video frames are arriving.",
                    present=True,
                    stream_url=None,
                    last_frame_at=last_frame_at,
                ),
                clear_frame=False,
            )

    async def _reconfigure_backend(
        self,
        config: CameraBackendConfig,
        mode: CameraViewMode,
    ) -> None:
        await self._release_backend()
        await self._set_status(
            CameraMetrics(
                state=CameraState.LOADING,
                mode=mode,
                detail=self._loading_detail(config),
                present=None,
                stream_url=None,
                last_frame_at=(await self.current_status()).last_frame_at,
            ),
            clear_frame=True,
        )

        backend = self.backend_factory(config)
        open_result = await asyncio.to_thread(backend.open)
        if not open_result.opened:
            await asyncio.to_thread(backend.release)
            await self._set_status(
                CameraMetrics(
                    state=CameraState.UNAVAILABLE,
                    mode=mode,
                    detail=open_result.detail,
                    present=open_result.present,
                    stream_url=None,
                    last_frame_at=(await self.current_status()).last_frame_at,
                ),
                clear_frame=True,
            )
            return

        self._backend = backend
        self._backend_config = config
        self._consecutive_read_failures = 0
        await self._set_status(
            CameraMetrics(
                state=CameraState.LOADING,
                mode=mode,
                detail=f"{open_result.detail} Waiting for first frame.",
                present=True,
                stream_url=None,
                last_frame_at=(await self.current_status()).last_frame_at,
            ),
            clear_frame=True,
        )

    async def _release_backend(self) -> None:
        backend = self._backend
        self._backend = None
        self._backend_config = None
        self._consecutive_read_failures = 0
        if backend is not None:
            await asyncio.to_thread(backend.release)

    async def _publish_frame(self, *, frame: bytes, mode: CameraViewMode, detail: str) -> None:
        now = _utcnow()
        async with self._state_lock:
            self._latest_frame = frame
            self._frame_sequence += 1
            self._status = self._status.model_copy(
                update={
                    "state": CameraState.LIVE,
                    "mode": mode,
                    "detail": detail,
                    "present": True,
                    "stream_url": STREAM_PATH,
                    "last_frame_at": now,
                }
            )

        async with self._frame_condition:
            self._frame_condition.notify_all()

    async def _set_status(self, status: CameraMetrics, *, clear_frame: bool) -> None:
        async with self._state_lock:
            self._status = status
            if clear_frame:
                self._latest_frame = None
        if clear_frame:
            async with self._frame_condition:
                self._frame_condition.notify_all()

    def _build_backend_config(self, hardware_source: CameraHardwareSource) -> CameraBackendConfig:
        if hardware_source is CameraHardwareSource.PI_CAM:
            device_index = self.settings.camera_pi_device_index
        else:
            device_index = self.settings.camera_usb_device_index

        return CameraBackendConfig(
            hardware_source=hardware_source,
            device_index=device_index,
            frame_width=self.settings.camera_frame_width,
            frame_height=self.settings.camera_frame_height,
            jpeg_quality=self.settings.camera_jpeg_quality,
        )

    @staticmethod
    def _to_view_mode(mode: CameraMode) -> CameraViewMode:
        if mode is CameraMode.ROAD:
            return CameraViewMode.ROAD
        if mode is CameraMode.DRIVER:
            return CameraViewMode.DRIVER
        return CameraViewMode.DISABLED

    @staticmethod
    def _loading_detail(config: CameraBackendConfig) -> str:
        return (
            f"Initializing {config.hardware_source.value.replace('_', ' ')} capture "
            f"at index {config.device_index}."
        )

    @staticmethod
    def _live_detail(config: CameraBackendConfig) -> str:
        return (
            f"{config.hardware_source.value.replace('_', ' ').upper()} feed live "
            f"at {config.frame_width}x{config.frame_height}."
        )
