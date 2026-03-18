import type {
  DisplayPreferences,
  PressureUnit,
  SpeedUnit,
  TemperatureUnit,
} from "../types/appSettings";
import type { AlertEvent } from "../types/telemetry";
import {
  convertPressureFromCanonicalBar,
  convertSpeedFromCanonicalKph,
  convertTemperatureFromCanonicalC,
  pressureUnitLabel,
  speedUnitLabel,
  temperatureUnitLabel,
} from "./units";

export { pressureUnitLabel, speedUnitLabel, temperatureUnitLabel } from "./units";

export function formatMetric(
  value: number | null | undefined,
  decimals = 0,
  fallback = "--",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}

export function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--:--.---";
  }
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = value % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds,
  ).padStart(3, "0")}`;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleTimeString();
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSpeed(value: number | null | undefined, unit: SpeedUnit): string {
  if (value === null || value === undefined) {
    return "--";
  }
  return formatMetric(convertSpeedFromCanonicalKph(value, unit), 0);
}

export function formatTemperature(value: number | null | undefined, unit: TemperatureUnit): string {
  if (value === null || value === undefined) {
    return "--";
  }
  return formatMetric(convertTemperatureFromCanonicalC(value, unit), 1);
}

export function formatPressure(value: number | null | undefined, unit: PressureUnit): string {
  if (value === null || value === undefined) {
    return "--";
  }
  return formatMetric(convertPressureFromCanonicalBar(value, unit), unit === "psi" ? 1 : 2);
}

export function formatAlertValue(
  alert: AlertEvent,
  displayPreferences: DisplayPreferences,
): string | null {
  if (alert.value === null || alert.value === undefined) {
    return null;
  }

  if (alert.code.includes("water_temp") || alert.code.includes("oil_temp")) {
    return `${formatTemperature(alert.value, displayPreferences.temperature_unit)} ${temperatureUnitLabel(displayPreferences.temperature_unit)}`;
  }

  if (alert.code.includes("oil_pressure")) {
    return `${formatPressure(alert.value, displayPreferences.pressure_unit)} ${pressureUnitLabel(displayPreferences.pressure_unit)}`;
  }

  if (alert.code.includes("fuel")) {
    return `${formatMetric(alert.value, 1)} %`;
  }

  return formatMetric(alert.value, 1);
}
