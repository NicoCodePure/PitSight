from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SpeedUnit(str, Enum):
    KPH = "kph"
    MPH = "mph"


class TemperatureUnit(str, Enum):
    CELSIUS = "celsius"
    FAHRENHEIT = "fahrenheit"


class PressureUnit(str, Enum):
    BAR = "bar"
    PSI = "psi"


class DriverMode(str, Enum):
    NORMAL = "normal"
    LEMONS = "lemons"


class AlertThresholdSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    oil_pressure_warning_bar: float = Field(gt=0)
    oil_pressure_critical_bar: float = Field(gt=0)
    water_temp_warning_c: float
    water_temp_critical_c: float
    oil_temp_warning_c: float
    oil_temp_critical_c: float
    fuel_level_warning_percent: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def validate_threshold_order(self) -> "AlertThresholdSettings":
        if self.oil_pressure_critical_bar >= self.oil_pressure_warning_bar:
            raise ValueError("Oil pressure critical threshold must be lower than warning threshold.")
        if self.water_temp_critical_c <= self.water_temp_warning_c:
            raise ValueError("Water temp critical threshold must be higher than warning threshold.")
        if self.oil_temp_critical_c <= self.oil_temp_warning_c:
            raise ValueError("Oil temp critical threshold must be higher than warning threshold.")
        return self


class DisplayPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speed_unit: SpeedUnit = SpeedUnit.KPH
    temperature_unit: TemperatureUnit = TemperatureUnit.CELSIUS
    pressure_unit: PressureUnit = PressureUnit.BAR
    default_driver_mode: DriverMode = DriverMode.NORMAL


class AppSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    thresholds: AlertThresholdSettings
    display: DisplayPreferences


class AppSettingsSnapshot(AppSettingsUpdate):
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

