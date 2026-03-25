import type { AlertThresholdSettings, DisplayPreferences } from "../types/appSettings";
import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import { CameraPanel } from "../components/CameraPanel";
import { DriverBottomStrip } from "../components/driver/DriverBottomStrip";
import { DriverFocusCluster } from "../components/driver/DriverFocusCluster";
import { DriverTopStrip } from "../components/driver/DriverTopStrip";
import { TelemetryStateCard } from "../components/driver/TelemetryStateCard";
import { buildCameraPanelView } from "../utils/camera";
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
  const cameraView = buildCameraPanelView({ camera: snapshot?.camera });

  return (
    <main className="screen screen--driver screen--driver-theme">
      <DriverTopStrip
        title="Driver Lemons"
        statuses={view.topStatuses}
        focus={view.focus}
        alerts={view.alerts}
        summary={view.summary}
      />

      <section className="driver-layout driver-layout--lemons">
        <aside className="driver-column">
          <div className="driver-section__title">Engine Survival</div>
          {view.engineMetrics.map((metric) => (
            <TelemetryStateCard key={metric.id} metric={metric} />
          ))}
        </aside>

        <section className="driver-main-panel">
          <DriverFocusCluster focus={view.focus} />
        </section>

        <aside className="driver-column driver-column--support">
          <div className="driver-section__title">Support Telemetry</div>
          {view.supportMetrics.map((metric) => (
            <TelemetryStateCard key={metric.id} metric={metric} />
          ))}
          <div className="driver-section__title driver-section__title--subtle">Camera</div>
          <CameraPanel view={cameraView} size="driver" />
        </aside>
      </section>

      <DriverBottomStrip summary={view.summary} items={view.footerItems} />
    </main>
  );
}
