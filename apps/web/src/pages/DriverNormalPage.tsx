import type { DisplayPreferences } from "../types/appSettings";
import { MetricCard } from "../components/MetricCard";
import { StatusStrip } from "../components/StatusStrip";
import { WarningBanner } from "../components/WarningBanner";
import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import {
  formatDuration,
  formatMetric,
  formatPressure,
  formatSpeed,
  formatTemperature,
  pressureUnitLabel,
  speedUnitLabel,
  temperatureUnitLabel,
} from "../utils/format";

interface DriverNormalPageProps {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  displayPreferences: DisplayPreferences;
}

function accentForAlert(alerts: AlertEvent[], codePrefix: string): "default" | "warning" | "critical" {
  if (alerts.some((alert) => alert.active && alert.code.startsWith(`${codePrefix}_critical`))) {
    return "critical";
  }
  if (alerts.some((alert) => alert.active && alert.code.startsWith(`${codePrefix}_warning`))) {
    return "warning";
  }
  return "default";
}

export function DriverNormalPage({
  snapshot,
  alerts: _alerts,
  session,
  streamStatus,
  displayPreferences,
}: DriverNormalPageProps) {
  const liveAlerts = snapshot?.alerts ?? [];
  const idleMessage = streamStatus === "connected" ? "No active alarms" : "Waiting for backend feed";

  return (
    <main className="screen screen--driver">
      <header className="screen__header">
        <div>
          <p className="screen__eyebrow">PitSight</p>
          <h1 className="screen__title">Driver Normal Mode</h1>
        </div>
      </header>

      <WarningBanner
        alerts={liveAlerts}
        idleMessage={idleMessage}
        displayPreferences={displayPreferences}
      />
      <StatusStrip
        source={snapshot?.source}
        streamStatus={streamStatus}
        healthState={snapshot?.health_state}
        sessionId={session?.session_id ?? snapshot?.session_id}
      />

      <section className="metric-grid metric-grid--driver">
        <MetricCard label="Lap Count" value={formatMetric(snapshot?.lap.lap_count)} />
        <MetricCard label="Current Lap" value={formatDuration(snapshot?.lap.current_lap_time_ms)} />
        <MetricCard label="Previous Lap" value={formatDuration(snapshot?.lap.previous_lap_time_ms)} />
        <MetricCard label="Best Lap" value={formatDuration(snapshot?.lap.best_lap_time_ms)} />
        <MetricCard
          label="Speed"
          value={formatSpeed(snapshot?.engine.speed_kph, displayPreferences.speed_unit)}
          unit={speedUnitLabel(displayPreferences.speed_unit)}
        />
        <MetricCard label="RPM" value={formatMetric(snapshot?.engine.rpm)} unit="rpm" />
        <MetricCard
          label="Oil Pressure"
          value={formatPressure(snapshot?.engine.oil_pressure_bar, displayPreferences.pressure_unit)}
          unit={pressureUnitLabel(displayPreferences.pressure_unit)}
          accent={accentForAlert(liveAlerts, "low_oil_pressure")}
        />
        <MetricCard
          label="Water Temp"
          value={formatTemperature(snapshot?.engine.water_temp_c, displayPreferences.temperature_unit)}
          unit={temperatureUnitLabel(displayPreferences.temperature_unit)}
          accent={accentForAlert(liveAlerts, "high_water_temp")}
        />
      </section>
    </main>
  );
}
