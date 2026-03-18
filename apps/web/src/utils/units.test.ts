import { describe, expect, it } from "vitest";

import {
  convertPressureFromCanonicalBar,
  convertPressureToCanonicalBar,
  convertTemperatureFromCanonicalC,
  convertTemperatureToCanonicalC,
  formatPressureThresholdInput,
  formatTemperatureThresholdInput,
  parsePressureThresholdInput,
  parseTemperatureThresholdInput,
} from "./units";

describe("units", () => {
  it("round-trips temperatures between celsius and fahrenheit", () => {
    expect(convertTemperatureFromCanonicalC(100, "fahrenheit")).toBe(212);
    expect(convertTemperatureToCanonicalC(212, "fahrenheit")).toBe(100);
    expect(parseTemperatureThresholdInput(formatTemperatureThresholdInput(105, "fahrenheit"), "fahrenheit")).toBe(105);
  });

  it("round-trips pressures between bar and psi within display precision", () => {
    expect(convertPressureFromCanonicalBar(2, "psi")).toBeCloseTo(29.0076, 4);
    expect(convertPressureToCanonicalBar(29.0076, "psi")).toBeCloseTo(2, 4);
    expect(parsePressureThresholdInput(formatPressureThresholdInput(1.5, "psi"), "psi")).toBeCloseTo(1.5, 2);
  });
});
