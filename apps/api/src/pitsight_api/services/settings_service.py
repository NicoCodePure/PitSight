from __future__ import annotations

from datetime import datetime, timezone

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    AlertThresholdSettings,
    AppSettingsSnapshot,
    AppSettingsUpdate,
    DisplayPreferences,
)
from pitsight_api.storage.repository import SQLiteRepository


class SettingsService:
    def __init__(self, repository: SQLiteRepository, defaults: Settings) -> None:
        self.repository = repository
        self.defaults = defaults
        self._current: AppSettingsSnapshot | None = None

    async def load(self) -> AppSettingsSnapshot:
        stored = await self.repository.fetch_app_settings()
        if stored is not None:
            self._current = stored
            return stored

        default_settings = AppSettingsSnapshot(
            thresholds=AlertThresholdSettings(
                oil_pressure_warning_bar=self.defaults.oil_pressure_warning_bar,
                oil_pressure_critical_bar=self.defaults.oil_pressure_critical_bar,
                water_temp_warning_c=self.defaults.water_temp_warning_c,
                water_temp_critical_c=self.defaults.water_temp_critical_c,
                oil_temp_warning_c=self.defaults.oil_temp_warning_c,
                oil_temp_critical_c=self.defaults.oil_temp_critical_c,
                fuel_level_warning_percent=self.defaults.fuel_level_warning_percent,
            ),
            display=DisplayPreferences(
                speed_unit=self.defaults.default_speed_unit,
                temperature_unit=self.defaults.default_temperature_unit,
                pressure_unit=self.defaults.default_pressure_unit,
                default_driver_mode=self.defaults.default_driver_mode,
            ),
        )
        await self.repository.store_app_settings(default_settings)
        self._current = default_settings
        return default_settings

    def current(self) -> AppSettingsSnapshot:
        if self._current is None:
            raise RuntimeError("App settings have not been loaded.")
        return self._current

    async def update(self, update: AppSettingsUpdate) -> AppSettingsSnapshot:
        next_snapshot = AppSettingsSnapshot(
            thresholds=update.thresholds,
            display=update.display,
            updated_at=datetime.now(timezone.utc),
        )
        await self.repository.store_app_settings(next_snapshot)
        self._current = next_snapshot
        return next_snapshot

