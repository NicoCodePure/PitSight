import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import type { TelemetrySnapshot } from "../types/telemetry";
import { buildDriverLemonsViewModel, buildDriverNormalViewModel } from "./lemonsTelemetry";

const THRESHOLDS = DEFAULT_APP_SETTINGS.shared.thresholds;
const DISPLAY = DEFAULT_APP_SETTINGS.shared.units;

function buildSnapshot(overrides?: Partial<TelemetrySnapshot>): TelemetrySnapshot {
  return {
    schema_version: "0.2.0",
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
      delta_ms: -420,
    },
    session: {
      session_time_ms: 180000,
      drive_time_ms: 180000,
      stint_time_ms: 180000,
    },
    engine: {
      speed_kph: 118,
      rpm: 5600,
      gear: 4,
      water_temp_c: 98,
      oil_temp_c: 109,
      oil_pressure_bar: 3.2,
      battery_voltage_v: 13.8,
      lambda_value: 1.01,
      afr: 14.8,
      intake_temp_c: 34,
      throttle_position_pct: 58,
    },
    fuel: {
      level_percent: 48,
      range_km: 80,
      pressure_bar: 3.4,
    },
    gps: {
      latitude: -26.0246,
      longitude: 28.0713,
      speed_kph: 121,
      fix_state: "3d",
    },
    camera: {
      state: "unavailable",
      stream_url: null,
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
    expect(view.topStatuses.map((status) => status.id)).toEqual(["source", "link"]);
    expect(view.metrics.map((metric) => metric.id)).toEqual([
      "speed",
      "lap-count",
      "oil-pressure",
      "coolant-temp",
    ]);
    expect(view.metrics[0]?.value).toBe("118");
    expect(view.metrics[0]?.detail).toBe("Vehicle speed");
    expect(view.metrics[2]?.state).toBe("normal");
    expect(view.metrics[1]?.state).toBe("normal");
    expect(view.summary).toBe("SIM live. Engine survival metrics stable.");
  });

  it("uses vehicle speed when GPS speed is unavailable", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        source: {
          provider: "obd2",
          transport: "COM5",
          protocol: "elm327",
          connection_state: "connected",
          connected: true,
          raw_capture_enabled: false,
          details: {
            obd_status: "CAR_CONNECTED",
          },
        },
        engine: {
          speed_kph: 96,
          rpm: 3100,
          gear: null,
          water_temp_c: 88,
          oil_temp_c: null,
          oil_pressure_bar: null,
          battery_voltage_v: 13.7,
          lambda_value: null,
          afr: null,
          intake_temp_c: 31,
          throttle_position_pct: 24,
        },
        gps: {
          latitude: null,
          longitude: null,
          speed_kph: null,
          fix_state: null,
        },
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.metrics[0]?.value).toBe("96");
    expect(view.metrics[0]?.detail).toBe("Vehicle speed");
  });

  it("uses GPS speed only as a fallback when vehicle speed is unavailable", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        engine: {
          speed_kph: null,
          rpm: 4020,
          gear: 3,
          water_temp_c: 91,
          oil_temp_c: 102,
          oil_pressure_bar: 3.1,
          battery_voltage_v: 13.6,
          lambda_value: 1,
          afr: 14.7,
          intake_temp_c: 29,
          throttle_position_pct: 37,
        },
        gps: {
          latitude: -26.0246,
          longitude: 28.0713,
          speed_kph: 104,
          fix_state: "3d",
        },
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.metrics[0]?.value).toBe("104");
    expect(view.metrics[0]?.detail).toBe("GPS fallback");
  });

  it("elevates oil pressure alerts to the top warning strip", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        engine: {
          speed_kph: 88,
          rpm: 4200,
          gear: 3,
          water_temp_c: 96,
          oil_temp_c: 101,
          oil_pressure_bar: 0.92,
          battery_voltage_v: 13.4,
          lambda_value: 0.99,
          afr: 14.5,
          intake_temp_c: 33,
          throttle_position_pct: 41,
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
    expect(view.metrics[2]?.state).toBe("critical");
    expect(view.summary).toBe("1 critical active");
  });

  it("keeps the lemons builder limited to approved telemetry only", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        engine: {
          speed_kph: 102,
          rpm: 4100,
          gear: 4,
          water_temp_c: 102,
          oil_temp_c: 117,
          oil_pressure_bar: 1.8,
          battery_voltage_v: 13.6,
          lambda_value: 1.0,
          afr: 14.7,
          intake_temp_c: 30,
          throttle_position_pct: 38,
        },
        fuel: {
          level_percent: 20,
          range_km: 30,
          pressure_bar: 3.2,
        },
        alerts: [],
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(Object.keys(view).sort()).toEqual(["alerts", "metrics", "summary", "topStatuses"]);
    expect(view.metrics.map((metric) => metric.id)).toEqual([
      "speed",
      "lap-count",
      "oil-pressure",
      "coolant-temp",
    ]);
    expect(view.topStatuses.map((status) => status.id)).toEqual(["source", "link"]);
  });

  it("keeps lap count truthful when lap logic is unavailable", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        source: {
          provider: "dictator",
          transport: "COM4",
          protocol: "dictator-usb",
          connection_state: "connected",
          connected: true,
          raw_capture_enabled: false,
          details: null,
        },
        capabilities: {
          lap_timing: {
            level: "unavailable",
            detail: "Lap timing is not available for this source in the current build.",
          },
          track_position: {
            level: "limited",
            detail: "Raw GPS location is available for context, but track mapping and start/finish logic are not implemented yet.",
          },
          session_clock: {
            level: "limited",
            detail: "Elapsed session, drive, and stint clocks are available, but they are not track-aware or lap-aware.",
          },
        },
        engine: {
          speed_kph: 96,
          rpm: 3600,
          gear: 3,
          water_temp_c: 94,
          oil_temp_c: 106,
          oil_pressure_bar: 3.0,
          battery_voltage_v: 10.8,
          lambda_value: 1.2,
          afr: 17.6,
          intake_temp_c: 31,
          throttle_position_pct: 27,
        },
        alerts: [],
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.metrics[1]?.value).toBe("--");
    expect(view.metrics[1]?.state).toBe("unavailable");
    expect(view.metrics[1]?.detail).toContain("Lap timing is not available");
    expect(view.summary).toBe("DICTATOR live. Lap count unavailable for this source.");
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
    expect(view.topStatuses.find((status) => status.id === "link")?.value).toBe("DOWN");
    expect(view.metrics[0]?.value).toBe("--");
  });

  it("marks missing core sensors as unavailable without showing zero values", () => {
    const view = buildDriverLemonsViewModel({
      snapshot: buildSnapshot({
        lap: {
          lap_count: null,
          current_lap_time_ms: null,
          previous_lap_time_ms: null,
          best_lap_time_ms: null,
          optimal_lap_estimate_ms: null,
          delta_ms: null,
        },
        engine: {
          speed_kph: null,
          rpm: null,
          gear: null,
          water_temp_c: null,
          oil_temp_c: null,
          oil_pressure_bar: null,
          battery_voltage_v: null,
          lambda_value: null,
          afr: null,
          intake_temp_c: null,
          throttle_position_pct: null,
        },
        gps: {
          latitude: null,
          longitude: null,
          speed_kph: null,
          fix_state: null,
        },
        camera: {
          state: null,
          stream_url: null,
        },
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.alerts.some((alert) => alert.title === "OIL TEMP SENSOR UNAVAILABLE")).toBe(true);
    expect(view.metrics.every((metric) => metric.value === "--")).toBe(true);
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
    expect(view.timingMetrics[2]?.value).toBe("-00:00.420");
    expect(view.footerItems.some((item) => item.id === "lap")).toBe(false);
  });

  it("downgrades lap and session timing honestly for real-source capability limits", () => {
    const view = buildDriverNormalViewModel({
      snapshot: buildSnapshot({
        source: {
          provider: "obd2",
          transport: "COM5",
          protocol: "elm327",
          connection_state: "connected",
          connected: true,
          raw_capture_enabled: false,
          details: null,
        },
        capabilities: {
          lap_timing: {
            level: "unavailable",
            detail: "Lap timing is not available for this source in the current build.",
          },
          track_position: {
            level: "limited",
            detail: "Raw GPS location is available for context, but track mapping and start/finish logic are not implemented yet.",
          },
          session_clock: {
            level: "limited",
            detail: "Elapsed session, drive, and stint clocks are available, but they are not track-aware or lap-aware.",
          },
        },
      }),
      session: null,
      streamStatus: "connected",
      thresholds: THRESHOLDS,
      displayPreferences: DISPLAY,
    });

    expect(view.topStatuses.find((status) => status.id === "lap-support")?.value).toBe("UNAVAILABLE");
    expect(view.topStatuses.find((status) => status.id === "track-support")?.value).toBe("LIMITED");
    expect(view.timingMetrics[0]?.state).toBe("unavailable");
    expect(view.timingMetrics[0]?.detail).toContain("Lap timing is not available");
    expect(view.timingMetrics[4]?.state).toBe("advisory");
    expect(view.timingMetrics[4]?.detail).toContain("not track-aware or lap-aware");
    expect(view.summary).toBe("OBD2 live. Lap timing unavailable; session clock limited.");
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
          delta_ms: null,
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
