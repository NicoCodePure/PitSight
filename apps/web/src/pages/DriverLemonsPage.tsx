import type { AlertThresholdSettings, DisplayPreferences } from "../types/appSettings";
import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import { DriverFocusCluster } from "../components/driver/DriverFocusCluster";
import { DriverTopStrip } from "../components/driver/DriverTopStrip";
import { TelemetryStateCard } from "../components/driver/TelemetryStateCard";
import { buildDriverLemonsViewModel } from "../utils/lemonsTelemetry";

interface DriverLemonsPageProps {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  displayPreferences: DisplayPreferences;
  thresholds: AlertThresholdSettings;
}

export function DriverLemonsPage({
  snapshot,
  alerts: _alerts,
  session,
  streamStatus,
  displayPreferences,
  thresholds,
}: DriverLemonsPageProps) {
  const view = buildDriverLemonsViewModel({
    snapshot,
    session,
    streamStatus,
    thresholds,
    displayPreferences,
  });

  return (
    <main className="screen screen--driver screen--driver-theme">
      <DriverTopStrip
        title="Driver Lemons"
        statuses={view.topStatuses}
        focus={view.focus}
        alerts={view.alerts}
        summary={view.summary}
      />

      <section className="driver-layout driver-layout--lemons-focused" aria-label="Driver Lemons approved telemetry">
        <aside className="driver-column">
          <div className="driver-section__title">Engine Survival</div>
          {view.engineMetrics.map((metric) => (
            <TelemetryStateCard key={metric.id} metric={metric} />
          ))}
        </aside>

        <section className="driver-main-panel">
          <DriverFocusCluster focus={view.focus} />
          <div className="driver-section">
            <TelemetryStateCard metric={view.lapMetric} />
          </div>
        </section>

        <aside className="driver-column">
          <div className="driver-section__title">Aux Gauges</div>
          {view.secondaryMetrics.map((metric) => (
            <TelemetryStateCard key={metric.id} metric={metric} />
          ))}
        </aside>
      </section>
    </main>
  );
}
