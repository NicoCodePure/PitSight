import type { DisplayPreferences } from "../types/appSettings";
import { MetricCard } from "../components/MetricCard";
import { StatusStrip } from "../components/StatusStrip";
import { WarningBanner } from "../components/WarningBanner";
import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import {
  formatMetric,
  formatPressure,
  formatSpeed,
  formatTemperature,
  pressureUnitLabel,
  speedUnitLabel,
  temperatureUnitLabel,
} from "../utils/format";

interface DriverLemonsPageProps {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  displayPreferences: DisplayPreferences;
}

function severityAccent(alerts: AlertEvent[], match: string): "default" | "warning" | "critical" {
  if (alerts.some((alert) => alert.active && alert.code.includes(match) && alert.severity === "critical")) {
    return "critical";
  }
  if (alerts.some((alert) => alert.active && alert.code.includes(match) && alert.severity === "warning")) {
    return "warning";
  }
  return "default";
}

export function DriverLemonsPage({
  snapshot,
  alerts: _alerts,
  session,
  streamStatus,
  displayPreferences,
}: DriverLemonsPageProps) {
  const liveAlerts = snapshot?.alerts ?? [];
  const trueSpeed = snapshot?.gps.speed_kph ?? snapshot?.engine.speed_kph;
  const idleMessage = streamStatus === "connected" ? "No active alarms" : "Waiting for backend feed";

  return (
    <main className="screen screen--driver screen--lemons">
      <header className="screen__header">
        <div>
          <p className="screen__eyebrow">PitSight</p>
          <h1 className="screen__title">Lemons Mode</h1>
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

      <section className="metric-grid metric-grid--lemons">
        <MetricCard label="Lap Count" value={formatMetric(snapshot?.lap.lap_count)} />
        <MetricCard
          label="Oil Pressure"
          value={formatPressure(snapshot?.engine.oil_pressure_bar, displayPreferences.pressure_unit)}
          unit={pressureUnitLabel(displayPreferences.pressure_unit)}
          accent={severityAccent(liveAlerts, "oil_pressure")}
        />
        <MetricCard
          label="Water Temp"
          value={formatTemperature(snapshot?.engine.water_temp_c, displayPreferences.temperature_unit)}
          unit={temperatureUnitLabel(displayPreferences.temperature_unit)}
          accent={severityAccent(liveAlerts, "water_temp")}
        />
        <MetricCard
          label="True Speed"
          value={formatSpeed(trueSpeed, displayPreferences.speed_unit)}
          unit={speedUnitLabel(displayPreferences.speed_unit)}
        />
      </section>
    </main>
  );
}
