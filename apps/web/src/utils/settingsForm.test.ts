import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import {
  buildThresholdInputState,
  hasUnsavedSettingsChanges,
  validateThresholdInputs,
} from "./settingsForm";

describe("settingsForm", () => {
  it("keeps canonical thresholds stable when editing in fahrenheit and psi", () => {
    const canonicalDraft = { ...DEFAULT_APP_SETTINGS.thresholds };
    const savedSettings = {
      ...DEFAULT_APP_SETTINGS,
      display: {
        ...DEFAULT_APP_SETTINGS.display,
        temperature_unit: "fahrenheit" as const,
        pressure_unit: "psi" as const,
      },
    };

    const thresholdInputs = buildThresholdInputState(
      DEFAULT_APP_SETTINGS.thresholds,
      savedSettings.display,
    );
    const validation = validateThresholdInputs(thresholdInputs, savedSettings.display);

    expect(validation.summary).toBeNull();
    expect(validation.thresholds?.oil_pressure_warning_bar).toBeCloseTo(1.5, 2);
    expect(validation.thresholds?.water_temp_critical_c).toBeCloseTo(112, 0);
    expect(canonicalDraft).toEqual(DEFAULT_APP_SETTINGS.thresholds);
  });

  it("flags invalid threshold relationships and unsaved changes", () => {
    const display = DEFAULT_APP_SETTINGS.display;
    const thresholdInputs = {
      ...buildThresholdInputState(DEFAULT_APP_SETTINGS.thresholds, display),
      oil_pressure_warning_bar: "1.2",
      oil_pressure_critical_bar: "1.4",
    };

    const validation = validateThresholdInputs(thresholdInputs, display);

    expect(validation.thresholds).toBeNull();
    expect(validation.summary).toContain("Critical oil pressure");
    expect(validation.fieldErrors.oil_pressure_warning_bar).toContain("Critical oil pressure");
    expect(validation.fieldErrors.oil_pressure_critical_bar).toContain("Critical oil pressure");
    expect(hasUnsavedSettingsChanges(thresholdInputs, display, DEFAULT_APP_SETTINGS)).toBe(true);
  });

  it("treats unit-only changes as unsaved until explicitly saved", () => {
    const display = {
      ...DEFAULT_APP_SETTINGS.display,
      temperature_unit: "fahrenheit" as const,
    };
    const thresholdInputs = buildThresholdInputState(DEFAULT_APP_SETTINGS.thresholds, display);

    expect(hasUnsavedSettingsChanges(thresholdInputs, display, DEFAULT_APP_SETTINGS)).toBe(true);
  });
});
