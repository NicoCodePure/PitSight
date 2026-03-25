import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import type { TelemetrySnapshot } from "../types/telemetry";
import { DriverLemonsPage } from "./DriverLemonsPage";

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
      state: "live",
      stream_url: "/api/v1/camera/stream.mjpeg",
    },
    alerts: [],
    health_state: "nominal",
    ...overrides,
  };
}

describe("DriverLemonsPage", () => {
  it("renders only the approved lemons telemetry composition", () => {
    const html = renderToStaticMarkup(
      <DriverLemonsPage
        snapshot={buildSnapshot()}
        alerts={[]}
        session={{
          session_id: "simulator-123",
          provider: "simulator",
          started_at: "2026-03-18T20:58:00.000Z",
        }}
        streamStatus="connected"
        displayPreferences={DEFAULT_APP_SETTINGS.shared.units}
        thresholds={DEFAULT_APP_SETTINGS.shared.thresholds}
      />,
    );

    expect(html).toContain("Driver Lemons");
    expect(html).toContain("Source");
    expect(html).toContain("Link");
    expect(html).toContain("System");
    expect(html).toContain("Shift Lights");
    expect(html).toContain("Speed");
    expect(html).toContain("Gear");
    expect(html).toContain("RPM");
    expect(html).toContain("Engine Survival");
    expect(html).toContain("Aux Gauges");
    expect(html).toContain("Lap Count");
    expect(html).toContain("Oil Temp");
    expect(html).toContain("Oil Pressure");
    expect(html).toContain("Coolant Temp");
    expect(html).toContain("Fuel Level");
    expect(html).toContain("Battery");
    expect(html).toContain("AFR");

    expect(html).not.toContain("Support Telemetry");
    expect(html).not.toContain("Camera");
    expect(html).not.toContain("Current Lap");
    expect(html).not.toContain("Best Lap");
    expect(html).not.toContain("Delta");
    expect(html).not.toContain("Session Elapsed");
    expect(html).not.toContain("Status Summary");
    expect(html).not.toContain("Lambda / AFR");
    expect(html).not.toContain("Signal");
  });
});
