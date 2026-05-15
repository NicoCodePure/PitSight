import type { AlertThresholdSettings, DisplayPreferences } from "../types/appSettings";
import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import { DriverBottomStrip } from "../components/driver/DriverBottomStrip";
import { DriverFocusCluster } from "../components/driver/DriverFocusCluster";
import { DriverTopStrip } from "../components/driver/DriverTopStrip";
import { TelemetryStateCard } from "../components/driver/TelemetryStateCard";
import { TimingMetricCard } from "../components/driver/TimingMetricCard";
import { buildDriverNormalViewModel } from "../utils/lemonsTelemetry";

interface DriverNormalPageProps {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  displayPreferences: DisplayPreferences;
  thresholds: AlertThresholdSettings;
}

export function DriverNormalPage({
  snapshot,
  alerts: _alerts,
  session,
  streamStatus,
  displayPreferences,
  thresholds,
}: DriverNormalPageProps) {
  const view = buildDriverNormalViewModel({
    snapshot,
    session,
    streamStatus,
    thresholds,
    displayPreferences,
  });

  return (
    <main className="screen screen--driver screen--driver-theme">
      <DriverTopStrip
        title="Driver Normal"
        statuses={view.topStatuses}
        focus={view.focus}
        alerts={view.alerts}
        summary={view.summary}
      />

      <section className="driver-layout driver-layout--normal">
        <aside className="driver-column">
          <div className="driver-section__title">Engine Health</div>
          {view.engineMetrics.map((metric) => (
            <TelemetryStateCard key={metric.id} metric={metric} />
          ))}
        </aside>

        <section className="driver-main-panel driver-main-panel--normal">
          <DriverFocusCluster focus={view.focus} />

          <div className="driver-section">
            <div className="driver-section__title">Timing &amp; Performance</div>
            <div className="driver-timing-grid">
              {view.timingMetrics.map((metric) => (
                <TimingMetricCard key={metric.id} metric={metric} />
              ))}
            </div>
          </div>
        </section>

        <aside className="driver-column driver-column--support">
          <div className="driver-section__title">Support Telemetry</div>
          {view.supportMetrics.map((metric) => (
            <TelemetryStateCard key={metric.id} metric={metric} />
          ))}
        </aside>
      </section>

      <DriverBottomStrip summary={view.summary} items={view.footerItems} />
    </main>
  );
}
