from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from pitsight_api.core.models.app_settings import DriverMode, PressureUnit, SpeedUnit, TemperatureUnit
from pitsight_api.core.models.telemetry import ProviderName

PROJECT_ROOT = Path(__file__).resolve().parents[4]


@dataclass(frozen=True, slots=True)
class WarningThresholds:
    oil_pressure_warning_bar: float
    oil_pressure_critical_bar: float
    water_temp_warning_c: float
    water_temp_critical_c: float
    oil_temp_warning_c: float
    oil_temp_critical_c: float
    fuel_level_warning_percent: float


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PITSIGHT_",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "PitSight API"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    database_path: Path = PROJECT_ROOT / "data" / "pitsight.db"
    provider_mode: ProviderName = ProviderName.SIMULATOR
    simulator_hz: float = 4.0
    oil_pressure_warning_bar: float = 1.5
    oil_pressure_critical_bar: float = 1.0
    water_temp_warning_c: float = 105.0
    water_temp_critical_c: float = 112.0
    oil_temp_warning_c: float = 120.0
    oil_temp_critical_c: float = 130.0
    fuel_level_warning_percent: float = 15.0
    alert_history_limit: int = 50
    default_speed_unit: SpeedUnit = SpeedUnit.KPH
    default_temperature_unit: TemperatureUnit = TemperatureUnit.CELSIUS
    default_pressure_unit: PressureUnit = PressureUnit.BAR
    default_driver_mode: DriverMode = DriverMode.NORMAL

    @property
    def simulator_interval_seconds(self) -> float:
        return max(0.25, 1.0 / self.simulator_hz)

    @property
    def warning_thresholds(self) -> WarningThresholds:
        return WarningThresholds(
            oil_pressure_warning_bar=self.oil_pressure_warning_bar,
            oil_pressure_critical_bar=self.oil_pressure_critical_bar,
            water_temp_warning_c=self.water_temp_warning_c,
            water_temp_critical_c=self.water_temp_critical_c,
            oil_temp_warning_c=self.oil_temp_warning_c,
            oil_temp_critical_c=self.oil_temp_critical_c,
            fuel_level_warning_percent=self.fuel_level_warning_percent,
        )

    def ensure_data_dir(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
