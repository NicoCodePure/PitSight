import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import type { TelemetrySnapshot } from "../types/telemetry";
import { buildDriverLemonsViewModel, buildDriverNormalViewModel } from "./lemonsTelemetry";

const THRESHOLDS = DEFAULT_APP_SETTINGS.shared.thresholds;
const DISPLAY = DEFAULT_APP_SETTINGS.shared.units;

function buildSnapshot(overrides?: Partial<TelemetrySnapshot>): TelemetrySnapshot {
  return {
    schema_version: "0.1.0",
    session_id: "simulator-123",
    sequence: 12,
    timestamp: "2026-03-18T21:00:00.000Z",
    source: {
      provider: "simulator",
      transport: "internal",
      protocol: "simulated",
      connection_state: "connected",
      connected: true,
      raw_capture_enabled: false,
      details: {
        profile: "mvp-sim",
      },
    },
    lap: {
      lap_count: 4,
      current_lap_time_ms: 81234,
      previous_lap_time_ms: 80500,
      best_lap_time_ms: 79999,
      optimal_lap_estimate_ms: 79000,
    },
    session: {
      session_time_ms: 180000,
      drive_time_ms: 180000,
      stint_time_ms: 180000,
    },
    engine: {
      speed_kph: 118,
      rpm: 5600,
      water_temp_c: 98,
      oil_temp_c: 109,
      oil_pressure_bar: 3.2,
    },
    fuel: {
      level_percent: 48,
      range_km: 80,
    },
    gps: {
      latitude: -26.0246,
      longitude: 28.0713,
      speed_kph: 121,
    },
    alerts: [],
    health_state: "nominal",
    ...overrides,
  };
}

describe("buildDriverLemonsViewModel", () => {
  it("returns clear status for healthy simulated telemetry", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot(),
      session: {
        session_id: "simulator-123",
        provider: "simulator",
        started_at: "2026-03-18T20:58:00.000Z",
      },
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.alerts).toHaveLength(0);
    expect(view.focus.speed.value).toBe("121");
    expect(view.engineMetrics[1].state).toBe("normal");
    expect(view.supportMetrics[1].state).toBe("normal");
    expect(view.summary).toBe("SIM live. Core telemetry stable.");
  });

  it("elevates oil pressure alerts to the top warning strip", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        engine: {
          speed_kph: 88,
          rpm: 4200,
          water_temp_c: 96,
          oil_temp_c: 101,
          oil_pressure_bar: 0.92,
        },
        alerts: [
          {
            code: "low_oil_pressure_critical",
            severity: "critical",
            message: "Critical oil pressure",
            active: true,
            value: 0.92,
            threshold: 1.0,
          },
        ],
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.alerts[0]?.title).toBe("OIL PRESSURE CRITICAL");
    expect(view.alerts[0]?.detail).toContain("4200 RPM");
    expect(view.engineMetrics[1].state).toBe("critical");
    expect(view.summary).toBe("1 critical active");
  });

  it("raises signal lost when no snapshot is available", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: null,
      session: null,
      streamStatus: "disconnected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.alerts[0]?.title).toBe("TELEMETRY SIGNAL LOST");
    expect(view.supportMetrics[3].value).toBe("LOST");
  });

  it("marks missing core sensors as unavailable without showing zero values", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        engine: {
          speed_kph: null,
          rpm: null,
          water_temp_c: null,
          oil_temp_c: null,
          oil_pressure_bar: null,
        },
        gps: {
          latitude: null,
          longitude: null,
          speed_kph: null,
        },
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.alerts.some((alert) => alert.title === "OIL TEMP SENSOR UNAVAILABLE")).toBe(true);
    expect(view.focus.gear.value).toBe("--");
    expect(view.focus.rpm.value).toBe("--");
    expect(view.engineMetrics.every((metric) => metric.value === "--")).toBe(true);
  });
});

describe("buildDriverNormalViewModel", () => {
  it("builds timing metrics in the same driver design language", () => {
    const view = buildDriverNormalViewModel({
      snapshot: buildSnapshot(),
      session: {
        session_id: "simulator-123",
        provider: "simulator",
        started_at: "2026-03-18T20:58:00.000Z",
      },
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.focus.rpm.detail).toBe("Shift soon");
    expect(view.timingMetrics[0]?.label).toBe("Current Lap");
    expect(view.timingMetrics[0]?.emphasis).toBe("primary");
    expect(view.timingMetrics[2]?.value).toBe("--");
    expect(view.footerItems.some((item) => item.id === "lap")).toBe(false);
  });

  it("marks unavailable timing telemetry intentionally when missing", () => {
    const view = buildDriverNormalViewModel({
      snapshot: buildSnapshot({
        lap: {
          lap_count: null,
          current_lap_time_ms: null,
          previous_lap_time_ms: null,
          best_lap_time_ms: null,
          optimal_lap_estimate_ms: null,
        },
        session: {
          session_time_ms: null,
          drive_time_ms: null,
          stint_time_ms: null,
        },
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.timingMetrics.every((metric) => metric.state === "unavailable")).toBe(true);
    expect(view.timingMetrics[0]?.value).toBe("--:--.---");
  });
});
