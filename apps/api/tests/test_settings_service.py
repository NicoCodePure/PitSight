from __future__ import annotations

import asyncio

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    AppSettingsUpdate,
    DriverMode,
    PressureUnit,
    SpeedUnit,
    TemperatureUnit,
)
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.storage.repository import SQLiteRepository


def test_settings_service_persists_updates_and_exposes_defaults(tmp_path) -> None:
    async def scenario() -> None:
        database_path = tmp_path / "pitsight-settings.db"
        defaults = Settings(
            _env_file=None,
            database_path=database_path,
            oil_pressure_warning_bar=1.7,
            oil_pressure_critical_bar=1.2,
            water_temp_warning_c=104,
            water_temp_critical_c=111,
            oil_temp_warning_c=118,
            oil_temp_critical_c=128,
            fuel_level_warning_percent=18,
            default_speed_unit=SpeedUnit.MPH,
            default_temperature_unit=TemperatureUnit.FAHRENHEIT,
            default_pressure_unit=PressureUnit.PSI,
            default_driver_mode=DriverMode.LEMONS,
        )

        repository = SQLiteRepository(database_path)
        await repository.initialize()

        service = SettingsService(repository=repository, defaults=defaults)
        loaded = await service.load()
        default_update = service.default_update()

        assert loaded.thresholds.oil_pressure_warning_bar == 1.7
        assert loaded.display.default_driver_mode is DriverMode.LEMONS
        assert default_update.display.pressure_unit is PressureUnit.PSI

        updated = await service.update(
            AppSettingsUpdate.model_validate(
                {
                    "thresholds": {
                        "oil_pressure_warning_bar": 1.9,
                        "oil_pressure_critical_bar": 1.3,
                        "water_temp_warning_c": 106,
                        "water_temp_critical_c": 113,
                        "oil_temp_warning_c": 121,
                        "oil_temp_critical_c": 132,
                        "fuel_level_warning_percent": 12,
                    },
                    "display": {
                        "speed_unit": "kph",
                        "temperature_unit": "celsius",
                        "pressure_unit": "bar",
                        "default_driver_mode": "normal",
                    },
                }
            )
        )
        assert updated.thresholds.oil_pressure_warning_bar == 1.9

        await repository.close()

        reloaded_repository = SQLiteRepository(database_path)
        await reloaded_repository.initialize()
        try:
            reloaded_service = SettingsService(repository=reloaded_repository, defaults=defaults)
            reloaded = await reloaded_service.load()

            assert reloaded.thresholds.oil_pressure_warning_bar == 1.9
            assert reloaded.thresholds.oil_pressure_critical_bar == 1.3
            assert reloaded.display.speed_unit is SpeedUnit.KPH
            assert reloaded.display.temperature_unit is TemperatureUnit.CELSIUS
        finally:
            await reloaded_repository.close()

    asyncio.run(scenario())
