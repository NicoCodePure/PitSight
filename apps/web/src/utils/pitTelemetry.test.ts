import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import type { AlertEvent, SessionRecord, SystemEvent, TelemetrySnapshot } from "../types/telemetry";
import { buildPitDashboardViewModel } from "./pitTelemetry";

function buildSnapshot(): TelemetrySnapshot {
  return {
    schema_version: "0.2.0",
    session_id: "session-1",
    sequence: 10,
    timestamp: "2026-03-25T10:00:00.000Z",
    source: {
      provider: "simulator",
      transport: "internal",
      protocol: "simulated",
      connection_state: "connected",
      connected: true,
      raw_capture_enabled: false,
      details: null,
    },
    lap: {
      lap_count: 3,
      current_lap_time_ms: 81000,
      previous_lap_time_ms: 80500,
      best_lap_time_ms: 79900,
      optimal_lap_estimate_ms: 79500,
      delta_ms: -250,
    },
    session: {
      session_time_ms: 180000,
      drive_time_ms: 180000,
      stint_time_ms: 180000,
    },
    engine: {
      speed_kph: 120,
      rpm: 5200,
      gear: 4,
      water_temp_c: 97,
      oil_temp_c: 108,
      oil_pressure_bar: 3.3,
      battery_voltage_v: 13.7,
      lambda_value: 1.01,
      afr: 14.8,
      intake_temp_c: 32,
      throttle_position_pct: 55,
    },
    fuel: {
      level_percent: 45,
      range_km: 80,
      pressure_bar: 3.1,
    },
    gps: {
      latitude: -26.02,
      longitude: 28.07,
      speed_kph: 121,
      fix_state: "3d",
    },
    camera: {
      state: "live",
      mode: "road",
      stream_url: "/api/v1/camera/stream.mjpeg",
      detail: "Live camera.",
      present: true,
      last_frame_at: "2026-03-25T10:00:00.000Z",
    },
    alerts: [],
    health_state: "nominal",
  };
}

describe("buildPitDashboardViewModel", () => {
  it("uses backend recent events for the pit timeline", () => {
    const events: SystemEvent[] = [
      {
        timestamp: "2026-03-25T10:01:00.000Z",
        session_id: "session-1",
        category: "alert",
        code: "alert.high_oil_temp_warning.entered",
        action: "entered",
        severity: "warning",
        title: "Oil Temp Warning Entered",
        detail: "High oil temperature. Value 123.0, threshold 120.0.",
        metadata: null,
      },
      {
        timestamp: "2026-03-25T10:02:00.000Z",
        session_id: "session-1",
        category: "device",
        code: "device.online_state.changed",
        action: "disconnected",
        severity: "critical",
        title: "Device Disconnected",
        detail: "PitSight Pi stopped reporting.",
        metadata: null,
      },
    ];

    const view = buildPitDashboardViewModel({
      snapshot: buildSnapshot(),
      alerts: [] satisfies AlertEvent[],
      events,
      session: {
        session_id: "session-1",
        provider: "simulator",
        started_at: "2026-03-25T09:55:00.000Z",
      } satisfies SessionRecord,
      streamStatus: "connected",
      displayPreferences: DEFAULT_APP_SETTINGS.effective.shared.units,
      settings: DEFAULT_APP_SETTINGS,
    });

    expect(view.recentEvents).toHaveLength(2);
    expect(view.recentEvents[0]?.title).toBe("Oil Temp Warning Entered");
    expect(view.recentEvents[0]?.state).toBe("warning");
    expect(view.recentEvents[1]?.title).toBe("Device Disconnected");
    expect(view.recentEvents[1]?.state).toBe("critical");
  });
});
