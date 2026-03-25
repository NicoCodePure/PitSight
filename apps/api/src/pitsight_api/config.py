from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from pitsight_api.core.models.app_settings import (
    DictatorConnectionMethod,
    DriverMode,
    PressureUnit,
    SpeedUnit,
    TemperatureUnit,
)
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
    obd_hz: float = 2.0
    obd_port: str | None = None
    obd_baudrate: int | None = None
    obd_protocol: str | None = None
    obd_fast: bool = True
    obd_timeout_seconds: float = 0.1
    obd_check_voltage: bool = True
    obd_start_low_power: bool = False
    dictator_hz: float = 4.0
    dictator_connection_method: DictatorConnectionMethod = DictatorConnectionMethod.USB
    dictator_port: str | None = None
    dictator_baudrate: int = 115200
    dictator_timeout_seconds: float = 0.1
    dictator_stale_seconds: float = 1.5
    dictator_raw_capture_enabled: bool = False
    dictator_raw_capture_dir: Path = PROJECT_ROOT / "data" / "dictator_raw"
    gps_enabled: bool = False
    gps_port: str | None = None
    gps_baudrate: int = 9600
    gps_timeout_seconds: float = 1.0
    gps_stale_seconds: float = 5.0
    oil_pressure_warning_bar: float = 1.5
    oil_pressure_critical_bar: float = 1.0
    water_temp_warning_c: float = 105.0
    water_temp_critical_c: float = 112.0
    oil_temp_warning_c: float = 120.0
    oil_temp_critical_c: float = 130.0
    fuel_level_warning_percent: float = 15.0
    alert_history_limit: int = 50
    app_version: str = "0.1.0"
    device_id: str | None = None
    device_label: str = "PitSight Pi"
    device_heartbeat_interval_seconds: int = 5
    device_heartbeat_timeout_seconds: int = 15
    default_speed_unit: SpeedUnit = SpeedUnit.KPH
    default_temperature_unit: TemperatureUnit = TemperatureUnit.CELSIUS
    default_pressure_unit: PressureUnit = PressureUnit.BAR
    default_driver_mode: DriverMode = DriverMode.NORMAL
    camera_capture_fps: float = 5.0
    camera_frame_width: int = 960
    camera_frame_height: int = 540
    camera_jpeg_quality: int = 80
    camera_frame_stale_seconds: float = 2.0
    camera_pi_device_index: int = 0
    camera_usb_device_index: int = 0

    @property
    def simulator_interval_seconds(self) -> float:
        return max(0.25, 1.0 / self.simulator_hz)

    @property
    def obd_interval_seconds(self) -> float:
        return max(0.25, 1.0 / self.obd_hz)

    @property
    def dictator_interval_seconds(self) -> float:
        return max(0.25, 1.0 / self.dictator_hz)

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
        self.dictator_raw_capture_dir.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
