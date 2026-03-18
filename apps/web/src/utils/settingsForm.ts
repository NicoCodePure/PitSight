import type {
  AlertThresholdSettings,
  AppSettingsSnapshot,
  DisplayPreferences,
} from "../types/appSettings";
import {
  formatPressureThresholdInput,
  formatTemperatureThresholdInput,
  parseEditableNumber,
  parsePressureThresholdInput,
  parseTemperatureThresholdInput,
} from "./units";

export type ThresholdFieldName = keyof AlertThresholdSettings;
export type ThresholdInputState = Record<ThresholdFieldName, string>;
export type ThresholdFieldErrors = Partial<Record<ThresholdFieldName, string>>;
export type ThresholdUnitKind = "pressure" | "temperature" | "voltage" | "delta" | "percent";

export interface ThresholdFieldDefinition {
  field: ThresholdFieldName;
  label: string;
  helper: string;
  unitKind: ThresholdUnitKind;
}

export interface ThresholdGroupDefinition {
  id: string;
  label: string;
  description: string;
  fields: ThresholdFieldDefinition[];
}

interface ThresholdRuleGroup {
  direction: "asc" | "desc";
  fields: ThresholdFieldName[];
  message: string;
}

const THRESHOLD_FIELD_DEFINITIONS: Record<ThresholdFieldName, ThresholdFieldDefinition> = {
  oil_pressure_advisory_bar: {
    field: "oil_pressure_advisory_bar",
    label: "Oil Pressure Advisory",
    helper: "Early caution floor before the warning state.",
    unitKind: "pressure",
  },
  oil_pressure_warning_bar: {
    field: "oil_pressure_warning_bar",
    label: "Oil Pressure Warning",
    helper: "Driver should notice now if pressure falls below this point.",
    unitKind: "pressure",
  },
  oil_pressure_critical_bar: {
    field: "oil_pressure_critical_bar",
    label: "Oil Pressure Critical",
    helper: "Immediate engine risk below this minimum.",
    unitKind: "pressure",
  },
  water_temp_advisory_c: {
    field: "water_temp_advisory_c",
    label: "Coolant Temp Advisory",
    helper: "Early rising-temperature caution.",
    unitKind: "temperature",
  },
  water_temp_warning_c: {
    field: "water_temp_warning_c",
    label: "Coolant Temp Warning",
    helper: "Driver should notice the coolant trend here.",
    unitKind: "temperature",
  },
  water_temp_critical_c: {
    field: "water_temp_critical_c",
    label: "Coolant Temp Critical",
    helper: "Critical thermal threshold.",
    unitKind: "temperature",
  },
  oil_temp_advisory_c: {
    field: "oil_temp_advisory_c",
    label: "Oil Temp Advisory",
    helper: "Early oil heat caution.",
    unitKind: "temperature",
  },
  oil_temp_warning_c: {
    field: "oil_temp_warning_c",
    label: "Oil Temp Warning",
    helper: "Driver warning threshold for oil temperature.",
    unitKind: "temperature",
  },
  oil_temp_critical_c: {
    field: "oil_temp_critical_c",
    label: "Oil Temp Critical",
    helper: "Critical oil temperature threshold.",
    unitKind: "temperature",
  },
  battery_voltage_advisory_v: {
    field: "battery_voltage_advisory_v",
    label: "Battery Advisory",
    helper: "Early low-voltage caution floor.",
    unitKind: "voltage",
  },
  battery_voltage_warning_v: {
    field: "battery_voltage_warning_v",
    label: "Battery Warning",
    helper: "Driver should notice sustained low voltage here.",
    unitKind: "voltage",
  },
  battery_voltage_critical_v: {
    field: "battery_voltage_critical_v",
    label: "Battery Critical",
    helper: "Critical low-voltage threshold.",
    unitKind: "voltage",
  },
  fuel_pressure_advisory_bar: {
    field: "fuel_pressure_advisory_bar",
    label: "Fuel Pressure Advisory",
    helper: "Early caution floor for fuel supply pressure.",
    unitKind: "pressure",
  },
  fuel_pressure_warning_bar: {
    field: "fuel_pressure_warning_bar",
    label: "Fuel Pressure Warning",
    helper: "Driver warning floor for fuel pressure.",
    unitKind: "pressure",
  },
  fuel_pressure_critical_bar: {
    field: "fuel_pressure_critical_bar",
    label: "Fuel Pressure Critical",
    helper: "Critical fuel pressure floor.",
    unitKind: "pressure",
  },
  lambda_advisory_delta: {
    field: "lambda_advisory_delta",
    label: "Lambda Advisory",
    helper: "Allowed deviation before a caution state.",
    unitKind: "delta",
  },
  lambda_warning_delta: {
    field: "lambda_warning_delta",
    label: "Lambda Warning",
    helper: "Warning deviation from target lambda.",
    unitKind: "delta",
  },
  lambda_critical_delta: {
    field: "lambda_critical_delta",
    label: "Lambda Critical",
    helper: "Critical deviation from target lambda.",
    unitKind: "delta",
  },
  fuel_level_warning_percent: {
    field: "fuel_level_warning_percent",
    label: "Fuel Level Warning",
    helper: "Warn when usable fuel drops below this level.",
    unitKind: "percent",
  },
};

export const THRESHOLD_GROUPS: ThresholdGroupDefinition[] = [
  {
    id: "lubrication",
    label: "Lubrication",
    description: "Oil pressure floors for advisory, warning, and critical engine survival states.",
    fields: [
      THRESHOLD_FIELD_DEFINITIONS.oil_pressure_advisory_bar,
      THRESHOLD_FIELD_DEFINITIONS.oil_pressure_warning_bar,
      THRESHOLD_FIELD_DEFINITIONS.oil_pressure_critical_bar,
    ],
  },
  {
    id: "cooling",
    label: "Cooling",
    description: "Coolant temperature escalation thresholds.",
    fields: [
      THRESHOLD_FIELD_DEFINITIONS.water_temp_advisory_c,
      THRESHOLD_FIELD_DEFINITIONS.water_temp_warning_c,
      THRESHOLD_FIELD_DEFINITIONS.water_temp_critical_c,
    ],
  },
  {
    id: "oil-temp",
    label: "Oil Temperature",
    description: "Oil temperature escalation thresholds.",
    fields: [
      THRESHOLD_FIELD_DEFINITIONS.oil_temp_advisory_c,
      THRESHOLD_FIELD_DEFINITIONS.oil_temp_warning_c,
      THRESHOLD_FIELD_DEFINITIONS.oil_temp_critical_c,
    ],
  },
  {
    id: "electrical",
    label: "Electrical",
    description: "Battery voltage floors for low-voltage detection.",
    fields: [
      THRESHOLD_FIELD_DEFINITIONS.battery_voltage_advisory_v,
      THRESHOLD_FIELD_DEFINITIONS.battery_voltage_warning_v,
      THRESHOLD_FIELD_DEFINITIONS.battery_voltage_critical_v,
    ],
  },
  {
    id: "fuel",
    label: "Fuel",
    description: "Fuel pressure floors and the low-fuel reserve warning.",
    fields: [
      THRESHOLD_FIELD_DEFINITIONS.fuel_pressure_advisory_bar,
      THRESHOLD_FIELD_DEFINITIONS.fuel_pressure_warning_bar,
      THRESHOLD_FIELD_DEFINITIONS.fuel_pressure_critical_bar,
      THRESHOLD_FIELD_DEFINITIONS.fuel_level_warning_percent,
    ],
  },
  {
    id: "lambda",
    label: "Lambda / AFR",
    description: "Deviation from target mixture before advisory, warning, and critical states.",
    fields: [
      THRESHOLD_FIELD_DEFINITIONS.lambda_advisory_delta,
      THRESHOLD_FIELD_DEFINITIONS.lambda_warning_delta,
      THRESHOLD_FIELD_DEFINITIONS.lambda_critical_delta,
    ],
  },
];

const THRESHOLD_RULE_GROUPS: ThresholdRuleGroup[] = [
  {
    direction: "desc",
    fields: [
      "oil_pressure_advisory_bar",
      "oil_pressure_warning_bar",
      "oil_pressure_critical_bar",
    ],
    message: "Oil pressure thresholds must remain advisory > warning > critical.",
  },
  {
    direction: "asc",
    fields: ["water_temp_advisory_c", "water_temp_warning_c", "water_temp_critical_c"],
    message: "Coolant temp thresholds must remain advisory < warning < critical.",
  },
  {
    direction: "asc",
    fields: ["oil_temp_advisory_c", "oil_temp_warning_c", "oil_temp_critical_c"],
    message: "Oil temp thresholds must remain advisory < warning < critical.",
  },
  {
    direction: "desc",
    fields: [
      "battery_voltage_advisory_v",
      "battery_voltage_warning_v",
      "battery_voltage_critical_v",
    ],
    message: "Battery thresholds must remain advisory > warning > critical.",
  },
  {
    direction: "desc",
    fields: [
      "fuel_pressure_advisory_bar",
      "fuel_pressure_warning_bar",
      "fuel_pressure_critical_bar",
    ],
    message: "Fuel pressure thresholds must remain advisory > warning > critical.",
  },
  {
    direction: "asc",
    fields: ["lambda_advisory_delta", "lambda_warning_delta", "lambda_critical_delta"],
    message: "Lambda thresholds must remain advisory < warning < critical.",
  },
];

const SANITY_LIMITS: Record<ThresholdFieldName, { min: number; max: number; unit: string }> = {
  oil_pressure_advisory_bar: { min: 0.1, max: 10, unit: "bar" },
  oil_pressure_warning_bar: { min: 0.1, max: 10, unit: "bar" },
  oil_pressure_critical_bar: { min: 0.1, max: 10, unit: "bar" },
  water_temp_advisory_c: { min: 20, max: 180, unit: "C" },
  water_temp_warning_c: { min: 20, max: 180, unit: "C" },
  water_temp_critical_c: { min: 20, max: 180, unit: "C" },
  oil_temp_advisory_c: { min: 20, max: 220, unit: "C" },
  oil_temp_warning_c: { min: 20, max: 220, unit: "C" },
  oil_temp_critical_c: { min: 20, max: 220, unit: "C" },
  battery_voltage_advisory_v: { min: 0, max: 24, unit: "V" },
  battery_voltage_warning_v: { min: 0, max: 24, unit: "V" },
  battery_voltage_critical_v: { min: 0, max: 24, unit: "V" },
  fuel_pressure_advisory_bar: { min: 0, max: 10, unit: "bar" },
  fuel_pressure_warning_bar: { min: 0, max: 10, unit: "bar" },
  fuel_pressure_critical_bar: { min: 0, max: 10, unit: "bar" },
  lambda_advisory_delta: { min: 0, max: 1, unit: "delta" },
  lambda_warning_delta: { min: 0, max: 1, unit: "delta" },
  lambda_critical_delta: { min: 0, max: 1, unit: "delta" },
  fuel_level_warning_percent: { min: 0, max: 100, unit: "%" },
};

export interface ThresholdValidationResult {
  thresholds: AlertThresholdSettings | null;
  fieldErrors: ThresholdFieldErrors;
  summary: string | null;
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatSimpleNumber(value: number, digits = 2): string {
  return trimTrailingZeros(value.toFixed(digits));
}

function addFieldError(
  fieldErrors: ThresholdFieldErrors,
  field: ThresholdFieldName,
  message: string,
): void {
  if (!fieldErrors[field]) {
    fieldErrors[field] = message;
  }
}

function formatThresholdFieldValue(
  field: ThresholdFieldName,
  thresholds: AlertThresholdSettings,
  units: DisplayPreferences,
): string {
  const value = thresholds[field];
  const unitKind = THRESHOLD_FIELD_DEFINITIONS[field].unitKind;

  switch (unitKind) {
    case "pressure":
      return formatPressureThresholdInput(value, units.pressure_unit);
    case "temperature":
      return formatTemperatureThresholdInput(value, units.temperature_unit);
    case "voltage":
      return formatSimpleNumber(value, 2);
    case "delta":
      return formatSimpleNumber(value, 3);
    case "percent":
      return formatSimpleNumber(value, 1);
  }
}

function validateRange(field: ThresholdFieldName, value: number): string | null {
  const limit = SANITY_LIMITS[field];
  if (value < limit.min || value > limit.max) {
    return `${THRESHOLD_FIELD_DEFINITIONS[field].label} must stay between ${limit.min} and ${limit.max} ${limit.unit}.`;
  }
  return null;
}

export function getThresholdUnitLabel(
  field: ThresholdFieldName,
  units: DisplayPreferences,
): string {
  switch (THRESHOLD_FIELD_DEFINITIONS[field].unitKind) {
    case "pressure":
      return units.pressure_unit;
    case "temperature":
      return units.temperature_unit === "fahrenheit" ? "deg F" : "deg C";
    case "voltage":
      return "V";
    case "delta":
      return "delta";
    case "percent":
      return "%";
  }
}

export function buildThresholdInputState(
  thresholds: AlertThresholdSettings,
  units: DisplayPreferences,
): ThresholdInputState {
  return Object.keys(THRESHOLD_FIELD_DEFINITIONS).reduce((result, key) => {
    const field = key as ThresholdFieldName;
    result[field] = formatThresholdFieldValue(field, thresholds, units);
    return result;
  }, {} as ThresholdInputState);
}

export function parseThresholdFieldValue(
  field: ThresholdFieldName,
  value: string,
  units: DisplayPreferences,
): number | null {
  switch (THRESHOLD_FIELD_DEFINITIONS[field].unitKind) {
    case "pressure":
      return parsePressureThresholdInput(value, units.pressure_unit);
    case "temperature":
      return parseTemperatureThresholdInput(value, units.temperature_unit);
    case "voltage":
    case "delta":
    case "percent":
      return parseEditableNumber(value);
  }
}

export function validateThresholdInputs(
  inputs: ThresholdInputState,
  units: DisplayPreferences,
): ThresholdValidationResult {
  const fieldErrors: ThresholdFieldErrors = {};
  const parsedThresholds = {} as AlertThresholdSettings;

  for (const field of Object.keys(THRESHOLD_FIELD_DEFINITIONS) as ThresholdFieldName[]) {
    const parsedValue = parseThresholdFieldValue(field, inputs[field], units);
    if (parsedValue === null) {
      addFieldError(
        fieldErrors,
        field,
        `Enter a numeric value for ${THRESHOLD_FIELD_DEFINITIONS[field].label}.`,
      );
      continue;
    }

    parsedThresholds[field] = parsedValue;
    const rangeError = validateRange(field, parsedValue);
    if (rangeError) {
      addFieldError(fieldErrors, field, rangeError);
    }
  }

  for (const group of THRESHOLD_RULE_GROUPS) {
    const values = group.fields.map((field) => parsedThresholds[field]);
    if (values.some((value) => value === undefined)) {
      continue;
    }

    const isValid =
      group.direction === "asc"
        ? values[0] < values[1] && values[1] < values[2]
        : values[0] > values[1] && values[1] > values[2];

    if (!isValid) {
      for (const field of group.fields) {
        addFieldError(fieldErrors, field, group.message);
      }
    }
  }

  const summary = Object.values(fieldErrors)[0] ?? null;
  if (summary !== null) {
    return {
      thresholds: null,
      fieldErrors,
      summary,
    };
  }

  return {
    thresholds: parsedThresholds,
    fieldErrors,
    summary: null,
  };
}

export function hasUnsavedThresholdChanges(
  inputs: ThresholdInputState,
  units: DisplayPreferences,
  settings: AppSettingsSnapshot,
): boolean {
  const savedInputs = buildThresholdInputState(settings.shared.thresholds, units);
  return (Object.keys(savedInputs) as ThresholdFieldName[]).some((field) => inputs[field] !== savedInputs[field]);
}
