from __future__ import annotations

import asyncio
import math
import random
import time
from datetime import datetime, timezone
from typing import AsyncIterator

from pitsight_api.core.canonical_telemetry import build_snapshot_from_canonical
from pitsight_api.core.models.telemetry import (
    CameraState,
    ConnectionState,
    GPSFixState,
    ProviderName,
    SourceStatus,
    TelemetrySnapshot,
)
from pitsight_api.providers.base import ProviderMetadata, TelemetryProvider


class SimulatorTelemetryProvider(TelemetryProvider):
    def __init__(self, interval_seconds: float = 0.25) -> None:
        self.metadata = ProviderMetadata(
            name=ProviderName.SIMULATOR,
            transport="internal",
            protocol="simulated",
            raw_capture_supported=False,
            poll_interval_seconds=interval_seconds,
        )
        self._running = False
        self._sequence = 0
        self._session_id = ""
        self._session_started = 0.0
        self._lap_started = 0.0
        self._completed_laps: list[int] = []
        self._fuel_level = 100.0
        self._random = random.Random(14)

    async def start(self, session_id: str) -> None:
        now = time.monotonic()
        self._running = True
        self._sequence = 0
        self._session_id = session_id
        self._session_started = now
        self._lap_started = now
        self._completed_laps = []
        self._fuel_level = 100.0

    async def stop(self) -> None:
        self._running = False

    async def stream(self) -> AsyncIterator[TelemetrySnapshot]:
        while self._running:
            yield self._build_snapshot()
            await asyncio.sleep(self.metadata.poll_interval_seconds)

    def _build_snapshot(self) -> TelemetrySnapshot:
        now_mono = time.monotonic()
        elapsed = now_mono - self._session_started
        current_lap_target = 92.0 + 4.0 * math.sin(elapsed / 180.0)
        current_lap_elapsed = now_mono - self._lap_started

        if current_lap_elapsed >= current_lap_target:
            self._completed_laps.append(int(current_lap_elapsed * 1000))
            self._lap_started = now_mono
            current_lap_elapsed = 0.0

        lap_count = len(self._completed_laps)
        previous_lap = self._completed_laps[-1] if self._completed_laps else None
        best_lap = min(self._completed_laps) if self._completed_laps else None
        optimal_lap = int(best_lap * 0.985) if best_lap else None

        phase = elapsed / 7.5
        speed_kph = max(0.0, 124.0 + 18.0 * math.sin(phase) + self._random.uniform(-4, 4))
        rpm = max(950.0, 2900.0 + speed_kph * 37 + self._random.uniform(-100, 100))
        gear = self._estimate_gear(speed_kph)
        water_temp_c = 88.0 + 8.5 * abs(math.sin(elapsed / 38.0)) + self._random.uniform(-0.8, 0.8)
        oil_temp_c = 96.0 + 10.5 * abs(math.sin(elapsed / 50.0)) + self._random.uniform(-0.8, 0.8)
        oil_pressure_bar = (
            4.6
            - max(0.0, water_temp_c - 90.0) / 22.0
            + 0.4 * abs(math.sin(elapsed / 10.0))
            + self._random.uniform(-0.15, 0.15)
        )
        throttle_position_pct = min(
            100.0,
            max(8.0, 48.0 + 34.0 * math.sin(phase + 0.9) + self._random.uniform(-4.0, 4.0)),
        )
        battery_voltage_v = 13.8 + 0.18 * math.sin(elapsed / 24.0) + self._random.uniform(-0.05, 0.05)
        fuel_pressure_bar = 3.35 + 0.18 * math.sin(elapsed / 15.0) + self._random.uniform(-0.04, 0.04)
        intake_temp_c = 31.0 + 7.5 * abs(math.sin(elapsed / 45.0)) + self._random.uniform(-0.6, 0.6)
        lambda_value = 0.99 + 0.02 * math.sin(elapsed / 8.0) + self._random.uniform(-0.01, 0.01)

        warning_window = 45.0 < (elapsed % 120.0) < 58.0
        if warning_window:
            water_temp_c += 18.0
            oil_temp_c += 12.0
            oil_pressure_bar -= 2.0
            battery_voltage_v -= 0.6
            fuel_pressure_bar -= 0.45
            lambda_value += 0.08

        self._fuel_level = max(2.0, self._fuel_level - 0.02)
        lap_progress = current_lap_elapsed / max(current_lap_target, 1.0)
        gps_angle = lap_progress * 2.0 * math.pi
        latitude = -26.0246 + 0.0008 * math.cos(gps_angle)
        longitude = 28.0713 + 0.0012 * math.sin(gps_angle)
        gps_speed_kph = max(0.0, speed_kph + self._random.uniform(-2.0, 2.0))
        lambda_value = max(0.82, lambda_value)
        afr = max(10.0, lambda_value * 14.7)
        lap_delta = None
        if best_lap is not None:
            projected_best_elapsed = int(best_lap * min(max(lap_progress, 0.0), 1.0))
            lap_delta = int(current_lap_elapsed * 1000) - projected_best_elapsed

        metrics = {
            "source_state": ConnectionState.CONNECTED,
            "lap_count": lap_count,
            "lap_time": int(current_lap_elapsed * 1000),
            "previous_lap": previous_lap,
            "best_lap": best_lap,
            "optimal_lap_estimate": optimal_lap,
            "delta": lap_delta,
            "session_elapsed": int(elapsed * 1000),
            "drive_time": int(elapsed * 1000),
            "stint_time": int(elapsed * 1000),
            "speed": round(speed_kph, 1),
            "rpm": round(rpm, 0),
            "gear": gear,
            "coolant_temp": round(water_temp_c, 1),
            "oil_temp": round(oil_temp_c, 1),
            "oil_pressure": round(max(0.6, oil_pressure_bar), 2),
            "battery_voltage": round(max(10.8, battery_voltage_v), 2),
            "fuel_pressure": round(max(1.8, fuel_pressure_bar), 2),
            "fuel_level": round(self._fuel_level, 1),
            "fuel_range": round(self._fuel_level * 1.8, 1),
            "lambda": round(lambda_value, 3),
            "afr": round(afr, 2),
            "intake_temp": round(intake_temp_c, 1),
            "throttle_position": round(throttle_position_pct, 1),
            "gps_latitude": round(latitude, 6),
            "gps_longitude": round(longitude, 6),
            "gps_speed": round(gps_speed_kph, 1),
            "gps_fix_state": GPSFixState.FIX_3D,
            "camera_state": CameraState.UNAVAILABLE,
        }

        snapshot = build_snapshot_from_canonical(
            session_id=self._session_id,
            sequence=self._sequence,
            timestamp=datetime.now(timezone.utc),
            source_status=SourceStatus(
                provider=ProviderName.SIMULATOR,
                transport=self.metadata.transport,
                protocol=self.metadata.protocol,
                connection_state=ConnectionState.CONNECTED,
                connected=True,
                raw_capture_enabled=False,
                details={
                    "profile": "mvp-sim",
                    "hz": round(1.0 / self.metadata.poll_interval_seconds, 2),
                    "available_metrics": [
                        metric_key
                        for metric_key, value in metrics.items()
                        if value is not None
                    ],
                },
            ),
            metrics=metrics,
        )
        self._sequence += 1
        return snapshot

    @staticmethod
    def _estimate_gear(speed_kph: float) -> int:
        if speed_kph < 25:
            return 1
        if speed_kph < 55:
            return 2
        if speed_kph < 85:
            return 3
        if speed_kph < 120:
            return 4
        if speed_kph < 155:
            return 5
        return 6
