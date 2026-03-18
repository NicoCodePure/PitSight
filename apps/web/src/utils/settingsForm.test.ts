import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import {
  buildThresholdInputState,
  hasUnsavedThresholdChanges,
  validateThresholdInputs,
} from "./settingsForm";

describe("settingsForm", () => {
  it("keeps canonical thresholds stable when editing in fahrenheit and psi", () => {
    const canonicalDraft = { ...DEFAULT_APP_SETTINGS.shared.thresholds };
    const display = {
      ...DEFAULT_APP_SETTINGS.shared.units,
      temperature_unit: "fahrenheit" as const,
      pressure_unit: "psi" as const,
    };

    const thresholdInputs = buildThresholdInputState(
      DEFAULT_APP_SETTINGS.shared.thresholds,
      display,
    );
    const validation = validateThresholdInputs(thresholdInputs, display);

    expect(validation.summary).toBeNull();
    expect(validation.thresholds?.oil_pressure_warning_bar).toBeCloseTo(1.5, 2);
    expect(validation.thresholds?.water_temp_critical_c).toBeCloseTo(112, 0);
    expect(canonicalDraft).toEqual(DEFAULT_APP_SETTINGS.shared.thresholds);
  });

  it("flags invalid threshold relationships and unsaved changes", () => {
    const display = DEFAULT_APP_SETTINGS.shared.units;
    const thresholdInputs = {
      ...buildThresholdInputState(DEFAULT_APP_SETTINGS.shared.thresholds, display),
      oil_pressure_advisory_bar: "1.2",
      oil_pressure_warning_bar: "1.4",
    };

    const validation = validateThresholdInputs(thresholdInputs, display);

    expect(validation.thresholds).toBeNull();
    expect(validation.summary).toContain("Oil pressure thresholds");
    expect(validation.fieldErrors.oil_pressure_advisory_bar).toContain("Oil pressure thresholds");
    expect(validation.fieldErrors.oil_pressure_warning_bar).toContain("Oil pressure thresholds");
    expect(hasUnsavedThresholdChanges(thresholdInputs, display, DEFAULT_APP_SETTINGS)).toBe(true);
  });

  it("keeps threshold inputs stable across a unit-only view change", () => {
    const display = {
      ...DEFAULT_APP_SETTINGS.shared.units,
      temperature_unit: "fahrenheit" as const,
    };
    const thresholdInputs = buildThresholdInputState(DEFAULT_APP_SETTINGS.shared.thresholds, display);

    expect(hasUnsavedThresholdChanges(thresholdInputs, display, DEFAULT_APP_SETTINGS)).toBe(false);
  });
});
