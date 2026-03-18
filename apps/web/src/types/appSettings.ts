export type SpeedUnit = "kph" | "mph";
export type TemperatureUnit = "celsius" | "fahrenheit";
export type PressureUnit = "bar" | "psi";
export type DriverMode = "normal" | "lemons";

export interface AlertThresholdSettings {
  oil_pressure_warning_bar: number;
  oil_pressure_critical_bar: number;
  water_temp_warning_c: number;
  water_temp_critical_c: number;
  oil_temp_warning_c: number;
  oil_temp_critical_c: number;
  fuel_level_warning_percent: number;
}

export interface DisplayPreferences {
  speed_unit: SpeedUnit;
  temperature_unit: TemperatureUnit;
  pressure_unit: PressureUnit;
  default_driver_mode: DriverMode;
}

export interface AppSettingsUpdate {
  thresholds: AlertThresholdSettings;
  display: DisplayPreferences;
}

export interface AppSettingsSnapshot extends AppSettingsUpdate {
  updated_at: string;
}

export const DEFAULT_APP_SETTINGS: AppSettingsSnapshot = {
  thresholds: {
    oil_pressure_warning_bar: 1.5,
    oil_pressure_critical_bar: 1.0,
    water_temp_warning_c: 105,
    water_temp_critical_c: 112,
    oil_temp_warning_c: 120,
    oil_temp_critical_c: 130,
    fuel_level_warning_percent: 15,
  },
  display: {
    speed_unit: "kph",
    temperature_unit: "celsius",
    pressure_unit: "bar",
    default_driver_mode: "normal",
  },
  updated_at: new Date(0).toISOString(),
};
