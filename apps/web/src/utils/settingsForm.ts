import type {
  AlertThresholdSettings,
  AppSettingsSnapshot,
  AppSettingsUpdate,
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

const THRESHOLD_LABELS: Record<ThresholdFieldName, string> = {
  oil_pressure_warning_bar: "Oil pressure warning",
  oil_pressure_critical_bar: "Oil pressure critical",
  water_temp_warning_c: "Water temp warning",
  water_temp_critical_c: "Water temp critical",
  oil_temp_warning_c: "Oil temp warning",
  oil_temp_critical_c: "Oil temp critical",
  fuel_level_warning_percent: "Low fuel warning",
};

const SANITY_LIMITS = {
  oil_pressure_bar: { min: 0.1, max: 10 },
  water_temp_c: { min: 20, max: 180 },
  oil_temp_c: { min: 20, max: 220 },
  fuel_percent: { min: 0, max: 100 },
} as const;

export interface ThresholdValidationResult {
  thresholds: AlertThresholdSettings | null;
  fieldErrors: ThresholdFieldErrors;
  summary: string | null;
}

function formatFuelThresholdInput(value: number): string {
  return Number.isFinite(value) ? value.toString() : "";
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

function validateRange(
  field: ThresholdFieldName,
  value: number,
): string | null {
  switch (field) {
    case "oil_pressure_warning_bar":
    case "oil_pressure_critical_bar":
      if (value < SANITY_LIMITS.oil_pressure_bar.min || value > SANITY_LIMITS.oil_pressure_bar.max) {
        return `${THRESHOLD_LABELS[field]} must stay between ${SANITY_LIMITS.oil_pressure_bar.min} and ${SANITY_LIMITS.oil_pressure_bar.max} bar.`;
      }
      return null;
    case "water_temp_warning_c":
    case "water_temp_critical_c":
      if (value < SANITY_LIMITS.water_temp_c.min || value > SANITY_LIMITS.water_temp_c.max) {
        return `${THRESHOLD_LABELS[field]} must stay between ${SANITY_LIMITS.water_temp_c.min} and ${SANITY_LIMITS.water_temp_c.max} C.`;
      }
      return null;
    case "oil_temp_warning_c":
    case "oil_temp_critical_c":
      if (value < SANITY_LIMITS.oil_temp_c.min || value > SANITY_LIMITS.oil_temp_c.max) {
        return `${THRESHOLD_LABELS[field]} must stay between ${SANITY_LIMITS.oil_temp_c.min} and ${SANITY_LIMITS.oil_temp_c.max} C.`;
      }
      return null;
    case "fuel_level_warning_percent":
      if (value < SANITY_LIMITS.fuel_percent.min || value > SANITY_LIMITS.fuel_percent.max) {
        return `${THRESHOLD_LABELS[field]} must stay between ${SANITY_LIMITS.fuel_percent.min} and ${SANITY_LIMITS.fuel_percent.max} percent.`;
      }
      return null;
  }
}

export function buildTemperatureThresholdInputs(
  thresholds: AlertThresholdSettings,
  temperatureUnit: AppSettingsUpdate["display"]["temperature_unit"],
): Pick<
  ThresholdInputState,
  "water_temp_warning_c" | "water_temp_critical_c" | "oil_temp_warning_c" | "oil_temp_critical_c"
> {
  return {
    water_temp_warning_c: formatTemperatureThresholdInput(
      thresholds.water_temp_warning_c,
      temperatureUnit,
    ),
    water_temp_critical_c: formatTemperatureThresholdInput(
      thresholds.water_temp_critical_c,
      temperatureUnit,
    ),
    oil_temp_warning_c: formatTemperatureThresholdInput(
      thresholds.oil_temp_warning_c,
      temperatureUnit,
    ),
    oil_temp_critical_c: formatTemperatureThresholdInput(
      thresholds.oil_temp_critical_c,
      temperatureUnit,
    ),
  };
}

export function buildPressureThresholdInputs(
  thresholds: AlertThresholdSettings,
  pressureUnit: AppSettingsUpdate["display"]["pressure_unit"],
): Pick<ThresholdInputState, "oil_pressure_warning_bar" | "oil_pressure_critical_bar"> {
  return {
    oil_pressure_warning_bar: formatPressureThresholdInput(
      thresholds.oil_pressure_warning_bar,
      pressureUnit,
    ),
    oil_pressure_critical_bar: formatPressureThresholdInput(
      thresholds.oil_pressure_critical_bar,
      pressureUnit,
    ),
  };
}

export function buildThresholdInputState(
  thresholds: AlertThresholdSettings,
  display: AppSettingsUpdate["display"],
): ThresholdInputState {
  return {
    ...buildPressureThresholdInputs(thresholds, display.pressure_unit),
    ...buildTemperatureThresholdInputs(thresholds, display.temperature_unit),
    fuel_level_warning_percent: formatFuelThresholdInput(thresholds.fuel_level_warning_percent),
  };
}

export function validateThresholdInputs(
  inputs: ThresholdInputState,
  display: AppSettingsUpdate["display"],
): ThresholdValidationResult {
  const fieldErrors: ThresholdFieldErrors = {};

  const oilPressureWarning = parsePressureThresholdInput(
    inputs.oil_pressure_warning_bar,
    display.pressure_unit,
  );
  if (oilPressureWarning === null) {
    addFieldError(
      fieldErrors,
      "oil_pressure_warning_bar",
      `Enter a numeric value for ${THRESHOLD_LABELS.oil_pressure_warning_bar}.`,
    );
  }

  const oilPressureCritical = parsePressureThresholdInput(
    inputs.oil_pressure_critical_bar,
    display.pressure_unit,
  );
  if (oilPressureCritical === null) {
    addFieldError(
      fieldErrors,
      "oil_pressure_critical_bar",
      `Enter a numeric value for ${THRESHOLD_LABELS.oil_pressure_critical_bar}.`,
    );
  }

  const waterTempWarning = parseTemperatureThresholdInput(
    inputs.water_temp_warning_c,
    display.temperature_unit,
  );
  if (waterTempWarning === null) {
    addFieldError(
      fieldErrors,
      "water_temp_warning_c",
      `Enter a numeric value for ${THRESHOLD_LABELS.water_temp_warning_c}.`,
    );
  }

  const waterTempCritical = parseTemperatureThresholdInput(
    inputs.water_temp_critical_c,
    display.temperature_unit,
  );
  if (waterTempCritical === null) {
    addFieldError(
      fieldErrors,
      "water_temp_critical_c",
      `Enter a numeric value for ${THRESHOLD_LABELS.water_temp_critical_c}.`,
    );
  }

  const oilTempWarning = parseTemperatureThresholdInput(
    inputs.oil_temp_warning_c,
    display.temperature_unit,
  );
  if (oilTempWarning === null) {
    addFieldError(
      fieldErrors,
      "oil_temp_warning_c",
      `Enter a numeric value for ${THRESHOLD_LABELS.oil_temp_warning_c}.`,
    );
  }

  const oilTempCritical = parseTemperatureThresholdInput(
    inputs.oil_temp_critical_c,
    display.temperature_unit,
  );
  if (oilTempCritical === null) {
    addFieldError(
      fieldErrors,
      "oil_temp_critical_c",
      `Enter a numeric value for ${THRESHOLD_LABELS.oil_temp_critical_c}.`,
    );
  }

  const fuelWarning = parseEditableNumber(inputs.fuel_level_warning_percent);
  if (fuelWarning === null) {
    addFieldError(
      fieldErrors,
      "fuel_level_warning_percent",
      `Enter a numeric value for ${THRESHOLD_LABELS.fuel_level_warning_percent}.`,
    );
  }

  const parsedThresholds: Partial<AlertThresholdSettings> = {};

  if (oilPressureWarning !== null) {
    parsedThresholds.oil_pressure_warning_bar = oilPressureWarning;
    const rangeError = validateRange("oil_pressure_warning_bar", oilPressureWarning);
    if (rangeError) {
      addFieldError(fieldErrors, "oil_pressure_warning_bar", rangeError);
    }
  }

  if (oilPressureCritical !== null) {
    parsedThresholds.oil_pressure_critical_bar = oilPressureCritical;
    const rangeError = validateRange("oil_pressure_critical_bar", oilPressureCritical);
    if (rangeError) {
      addFieldError(fieldErrors, "oil_pressure_critical_bar", rangeError);
    }
  }

  if (waterTempWarning !== null) {
    parsedThresholds.water_temp_warning_c = waterTempWarning;
    const rangeError = validateRange("water_temp_warning_c", waterTempWarning);
    if (rangeError) {
      addFieldError(fieldErrors, "water_temp_warning_c", rangeError);
    }
  }

  if (waterTempCritical !== null) {
    parsedThresholds.water_temp_critical_c = waterTempCritical;
    const rangeError = validateRange("water_temp_critical_c", waterTempCritical);
    if (rangeError) {
      addFieldError(fieldErrors, "water_temp_critical_c", rangeError);
    }
  }

  if (oilTempWarning !== null) {
    parsedThresholds.oil_temp_warning_c = oilTempWarning;
    const rangeError = validateRange("oil_temp_warning_c", oilTempWarning);
    if (rangeError) {
      addFieldError(fieldErrors, "oil_temp_warning_c", rangeError);
    }
  }

  if (oilTempCritical !== null) {
    parsedThresholds.oil_temp_critical_c = oilTempCritical;
    const rangeError = validateRange("oil_temp_critical_c", oilTempCritical);
    if (rangeError) {
      addFieldError(fieldErrors, "oil_temp_critical_c", rangeError);
    }
  }

  if (fuelWarning !== null) {
    parsedThresholds.fuel_level_warning_percent = fuelWarning;
    const rangeError = validateRange("fuel_level_warning_percent", fuelWarning);
    if (rangeError) {
      addFieldError(fieldErrors, "fuel_level_warning_percent", rangeError);
    }
  }

  if (oilPressureWarning !== null && oilPressureCritical !== null) {
    if (oilPressureCritical >= oilPressureWarning) {
      const message = "Critical oil pressure must stay lower than the warning threshold.";
      addFieldError(fieldErrors, "oil_pressure_warning_bar", message);
      addFieldError(fieldErrors, "oil_pressure_critical_bar", message);
    }
  }

  if (waterTempWarning !== null && waterTempCritical !== null) {
    if (waterTempCritical <= waterTempWarning) {
      const message = "Critical water temp must stay higher than the warning threshold.";
      addFieldError(fieldErrors, "water_temp_warning_c", message);
      addFieldError(fieldErrors, "water_temp_critical_c", message);
    }
  }

  if (oilTempWarning !== null && oilTempCritical !== null) {
    if (oilTempCritical <= oilTempWarning) {
      const message = "Critical oil temp must stay higher than the warning threshold.";
      addFieldError(fieldErrors, "oil_temp_warning_c", message);
      addFieldError(fieldErrors, "oil_temp_critical_c", message);
    }
  }

  const summary =
    Object.values(fieldErrors)[0] ?? null;

  if (summary !== null) {
    return {
      thresholds: null,
      fieldErrors,
      summary,
    };
  }

  return {
    thresholds: parsedThresholds as AlertThresholdSettings,
    fieldErrors,
    summary: null,
  };
}

export function parseThresholdFieldValue(
  field: ThresholdFieldName,
  value: string,
  display: AppSettingsUpdate["display"],
): number | null {
  switch (field) {
    case "oil_pressure_warning_bar":
    case "oil_pressure_critical_bar":
      return parsePressureThresholdInput(value, display.pressure_unit);
    case "water_temp_warning_c":
    case "water_temp_critical_c":
    case "oil_temp_warning_c":
    case "oil_temp_critical_c":
      return parseTemperatureThresholdInput(value, display.temperature_unit);
    case "fuel_level_warning_percent":
      return parseEditableNumber(value);
  }
}

export function hasUnsavedSettingsChanges(
  inputs: ThresholdInputState,
  display: AppSettingsUpdate["display"],
  settings: AppSettingsSnapshot,
): boolean {
  const savedDisplay = settings.display;
  if (JSON.stringify(display) !== JSON.stringify(savedDisplay)) {
    return true;
  }

  const savedInputs = buildThresholdInputState(settings.thresholds, display);
  return (Object.keys(savedInputs) as ThresholdFieldName[]).some(
    (field) => inputs[field] !== savedInputs[field],
  );
}
