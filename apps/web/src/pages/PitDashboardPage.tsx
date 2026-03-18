import type { DisplayPreferences } from "../types/appSettings";
import { AlertTimeline } from "../components/AlertTimeline";
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
  formatTimestamp,
  pressureUnitLabel,
  speedUnitLabel,
  temperatureUnitLabel,
} from "../utils/format";

interface PitDashboardPageProps {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  displayPreferences: DisplayPreferences;
}

export function PitDashboardPage({
  snapshot,
  alerts,
  session,
  streamStatus,
  displayPreferences,
}: PitDashboardPageProps) {
  const idleMessage = streamStatus === "connected" ? "No active alarms" : "Waiting for backend feed";

  return (
    <main className="screen screen--pit">
      <header className="screen__header screen__header--pit">
        <div>
          <p className="screen__eyebrow">PitSight</p>
          <h1 className="screen__title">Pit Dashboard</h1>
        </div>
        <div className="session-summary">
          <span>Session start {formatTimestamp(session?.started_at)}</span>
          <span>Last sample {formatTimestamp(snapshot?.timestamp)}</span>
        </div>
      </header>

      <WarningBanner
        alerts={snapshot?.alerts ?? []}
        idleMessage={idleMessage}
        displayPreferences={displayPreferences}
      />
      <StatusStrip
        source={snapshot?.source}
        streamStatus={streamStatus}
        healthState={snapshot?.health_state}
        sessionId={session?.session_id ?? snapshot?.session_id}
      />

      <section className="pit-layout">
        <div className="pit-layout__main">
          <div className="metric-grid metric-grid--pit">
            <MetricCard label="Lap Count" value={formatMetric(snapshot?.lap.lap_count)} />
            <MetricCard label="Current Lap" value={formatDuration(snapshot?.lap.current_lap_time_ms)} />
            <MetricCard label="Previous Lap" value={formatDuration(snapshot?.lap.previous_lap_time_ms)} />
            <MetricCard label="Best Lap" value={formatDuration(snapshot?.lap.best_lap_time_ms)} />
            <MetricCard label="Drive Time" value={formatDuration(snapshot?.session.drive_time_ms)} />
            <MetricCard label="Stint Time" value={formatDuration(snapshot?.session.stint_time_ms)} />
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
            />
            <MetricCard
              label="Water Temp"
              value={formatTemperature(snapshot?.engine.water_temp_c, displayPreferences.temperature_unit)}
              unit={temperatureUnitLabel(displayPreferences.temperature_unit)}
            />
            <MetricCard
              label="Oil Temp"
              value={formatTemperature(snapshot?.engine.oil_temp_c, displayPreferences.temperature_unit)}
              unit={temperatureUnitLabel(displayPreferences.temperature_unit)}
            />
            <MetricCard label="Fuel Level" value={formatMetric(snapshot?.fuel.level_percent, 1)} unit="%" />
          </div>
        </div>

        <aside className="pit-layout__side">
          <section className="panel">
            <div className="panel__title">Camera</div>
            <div className="camera-placeholder">Camera stream placeholder</div>
          </section>

          <section className="panel">
            <div className="panel__title">Recent Alerts</div>
            <AlertTimeline alerts={alerts} />
          </section>
        </aside>
      </section>
    </main>
  );
}
