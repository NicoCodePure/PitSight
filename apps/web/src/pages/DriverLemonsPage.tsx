import type { AlertThresholdSettings, DisplayPreferences } from "../types/appSettings";
import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import { DriverAlertStrip } from "../components/driver/DriverAlertStrip";
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
      <section className="driver-top-strip">
        <div className="driver-top-strip__status">
          <div>
            <p className="screen__eyebrow">PitSight</p>
            <h1 className="screen__title screen__title--lemons">Driver Lemons</h1>
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
          clearTitle="ENGINE STATUS CLEAR"
          clearDetail={view.summary}
        />
      </section>

      <section className="driver-lemons-grid" aria-label="Driver Lemons approved telemetry">
        {view.metrics.map((metric) => (
          <TelemetryStateCard key={metric.id} metric={metric} />
        ))}
      </section>
    </main>
  );
}
