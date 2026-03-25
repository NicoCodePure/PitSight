import { DriverAlertStrip } from "../components/driver/DriverAlertStrip";
import { DriverBottomStrip } from "../components/driver/DriverBottomStrip";
import { DriverFocusCluster } from "../components/driver/DriverFocusCluster";
import { TelemetryStateCard } from "../components/driver/TelemetryStateCard";
import { TimingMetricCard } from "../components/driver/TimingMetricCard";
import { CameraPanel } from "../components/CameraPanel";
import { PitEventTimeline } from "../components/pit/PitEventTimeline";
import type { AppSettingsSnapshot } from "../types/appSettings";
import type { AlertEvent, SessionRecord, SystemEvent, TelemetrySnapshot } from "../types/telemetry";
import { buildPitDashboardViewModel } from "../utils/pitTelemetry";

interface PitDashboardPageProps {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  events: SystemEvent[];
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  settings: AppSettingsSnapshot;
}

export function PitDashboardPage({
  snapshot,
  alerts,
  events,
  session,
  streamStatus,
  settings,
}: PitDashboardPageProps) {
  const view = buildPitDashboardViewModel({
    snapshot,
    alerts,
    events,
    session,
    streamStatus,
    displayPreferences: settings.effective.shared.units,
    settings,
  });

  return (
    <main className="screen screen--pit screen--driver-theme screen--pit-theme">
      <section className="driver-top-strip pit-top-strip">
        <div className="driver-top-strip__status">
          <div>
            <p className="screen__eyebrow">PitSight</p>
            <h1 className="screen__title screen__title--lemons">Pit Dashboard</h1>
          </div>

          <div className="driver-status-badges">
            {view.topStatuses.map((status) => (
              <article key={status.id} className={`driver-status-badge driver-status-badge--${status.state}`}>
                <span className="driver-status-badge__label">{status.label}</span>
                <span className="driver-status-badge__value">{status.value}</span>
              </article>
            ))}
          </div>
        </div>

        <DriverAlertStrip
          alerts={view.alerts}
          clearTitle="PIT STATUS CLEAR"
          clearDetail={view.summary}
        />
      </section>

      <section className="pit-dashboard-layout">
        <div className="pit-dashboard-layout__main">
          <section className="driver-section">
            <div className="driver-section__title">Core Overview</div>
            <DriverFocusCluster focus={view.focus} />
          </section>

          <section className="pit-group-grid">
            {view.metricGroups.map((group) => (
              <section key={group.id} className="pit-group-panel">
                <div className="driver-section__title">{group.label}</div>
                <div className="pit-group-panel__metrics">
                  {group.metrics.map((metric) => (
                    <TelemetryStateCard key={metric.id} metric={metric} />
                  ))}
                </div>
              </section>
            ))}
          </section>
        </div>

        <aside className="pit-dashboard-layout__side">
          <section className="pit-side-panel">
            <div className="driver-section__title">Camera</div>
            <CameraPanel view={view.camera} size="pit" />
          </section>

          <section className="pit-side-panel">
            <div className="driver-section__title">Timing / Session</div>
            <div className="driver-timing-grid pit-timing-grid">
              {view.timingMetrics.map((metric) => (
                <TimingMetricCard key={metric.id} metric={metric} />
              ))}
            </div>
          </section>

          <section className="pit-side-panel">
            <div className="driver-section__title">Recent Alerts / Events</div>
            <PitEventTimeline events={view.recentEvents} />
          </section>
        </aside>
      </section>

      <DriverBottomStrip summary={view.summary} items={view.footerItems} />
    </main>
  );
}
