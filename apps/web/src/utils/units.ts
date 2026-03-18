import type { PressureUnit, SpeedUnit, TemperatureUnit } from "../types/appSettings";

const KPH_TO_MPH = 0.621371;
const BAR_TO_PSI = 14.5038;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function parseEditableNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") {
    return null;
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function convertSpeedFromCanonicalKph(value: number, unit: SpeedUnit): number {
  return unit === "mph" ? value * KPH_TO_MPH : value;
}

export function convertTemperatureFromCanonicalC(value: number, unit: TemperatureUnit): number {
  return unit === "fahrenheit" ? value * 1.8 + 32 : value;
}

export function convertTemperatureToCanonicalC(value: number, unit: TemperatureUnit): number {
  return unit === "fahrenheit" ? (value - 32) / 1.8 : value;
}

export function convertPressureFromCanonicalBar(value: number, unit: PressureUnit): number {
  return unit === "psi" ? value * BAR_TO_PSI : value;
}

export function convertPressureToCanonicalBar(value: number, unit: PressureUnit): number {
  return unit === "psi" ? value / BAR_TO_PSI : value;
}

export function speedUnitLabel(unit: SpeedUnit): string {
  return unit;
}

export function temperatureUnitLabel(unit: TemperatureUnit): string {
  return unit === "fahrenheit" ? "F" : "C";
}

export function pressureUnitLabel(unit: PressureUnit): string {
  return unit;
}

export function formatTemperatureThresholdInput(valueC: number, unit: TemperatureUnit): string {
  return trimTrailingZeros(convertTemperatureFromCanonicalC(valueC, unit).toFixed(unit === "fahrenheit" ? 0 : 1));
}

export function formatPressureThresholdInput(valueBar: number, unit: PressureUnit): string {
  return trimTrailingZeros(convertPressureFromCanonicalBar(valueBar, unit).toFixed(unit === "psi" ? 1 : 2));
}

export function parseTemperatureThresholdInput(value: string, unit: TemperatureUnit): number | null {
  const parsed = parseEditableNumber(value);
  if (parsed === null) {
    return null;
  }
  return roundTo(convertTemperatureToCanonicalC(parsed, unit), 4);
}

export function parsePressureThresholdInput(value: string, unit: PressureUnit): number | null {
  const parsed = parseEditableNumber(value);
  if (parsed === null) {
    return null;
  }
  return roundTo(convertPressureToCanonicalBar(parsed, unit), 4);
}
