from __future__ import annotations

import asyncio
import math
import random
import time
from datetime import datetime, timezone
from typing import AsyncIterator

from pitsight_api.core.models.telemetry import (
    ConnectionState,
    EngineMetrics,
    FuelMetrics,
    GPSMetrics,
    LapMetrics,
    ProviderName,
    SessionMetrics,
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
        water_temp_c = 88.0 + 8.5 * abs(math.sin(elapsed / 38.0)) + self._random.uniform(-0.8, 0.8)
        oil_temp_c = 96.0 + 10.5 * abs(math.sin(elapsed / 50.0)) + self._random.uniform(-0.8, 0.8)
        oil_pressure_bar = (
            4.6
            - max(0.0, water_temp_c - 90.0) / 22.0
            + 0.4 * abs(math.sin(elapsed / 10.0))
            + self._random.uniform(-0.15, 0.15)
        )

        warning_window = 45.0 < (elapsed % 120.0) < 58.0
        if warning_window:
            water_temp_c += 18.0
            oil_temp_c += 12.0
            oil_pressure_bar -= 2.0

        self._fuel_level = max(2.0, self._fuel_level - 0.02)
        lap_progress = current_lap_elapsed / max(current_lap_target, 1.0)
        gps_angle = lap_progress * 2.0 * math.pi
        latitude = -26.0246 + 0.0008 * math.cos(gps_angle)
        longitude = 28.0713 + 0.0012 * math.sin(gps_angle)
        gps_speed_kph = max(0.0, speed_kph + self._random.uniform(-2.0, 2.0))

        snapshot = TelemetrySnapshot(
            session_id=self._session_id,
            sequence=self._sequence,
            timestamp=datetime.now(timezone.utc),
            source=SourceStatus(
                provider=ProviderName.SIMULATOR,
                transport=self.metadata.transport,
                protocol=self.metadata.protocol,
                connection_state=ConnectionState.CONNECTED,
                connected=True,
                raw_capture_enabled=False,
                details={
                    "profile": "mvp-sim",
                    "hz": round(1.0 / self.metadata.poll_interval_seconds, 2),
                },
            ),
            lap=LapMetrics(
                lap_count=lap_count,
                current_lap_time_ms=int(current_lap_elapsed * 1000),
                previous_lap_time_ms=previous_lap,
                best_lap_time_ms=best_lap,
                optimal_lap_estimate_ms=optimal_lap,
            ),
            session=SessionMetrics(
                session_time_ms=int(elapsed * 1000),
                drive_time_ms=int(elapsed * 1000),
                stint_time_ms=int(elapsed * 1000),
            ),
            engine=EngineMetrics(
                speed_kph=round(speed_kph, 1),
                rpm=round(rpm, 0),
                water_temp_c=round(water_temp_c, 1),
                oil_temp_c=round(oil_temp_c, 1),
                oil_pressure_bar=round(max(0.6, oil_pressure_bar), 2),
            ),
            fuel=FuelMetrics(
                level_percent=round(self._fuel_level, 1),
                range_km=round(self._fuel_level * 1.8, 1),
            ),
            gps=GPSMetrics(
                latitude=round(latitude, 6),
                longitude=round(longitude, 6),
                speed_kph=round(gps_speed_kph, 1),
            ),
        )
        self._sequence += 1
        return snapshot
