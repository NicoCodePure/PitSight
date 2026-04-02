import type { DriverAlertView, FocusClusterView, StatusBadgeView } from "../../utils/lemonsTelemetry";
import { DriverAlertStrip } from "./DriverAlertStrip";
import { ShiftLights } from "./ShiftLights";

interface DriverTopStripProps {
  title: string;
  statuses: StatusBadgeView[];
  focus: FocusClusterView;
  alerts: DriverAlertView[];
  summary: string;
}

export function DriverTopStrip({
  title,
  statuses,
  focus,
  alerts,
  summary,
}: DriverTopStripProps) {
  return (
    <section className="driver-top-strip">
      <div className="driver-top-strip__status">
        <div>
          <p className="screen__eyebrow">PitSight</p>
          <h1 className="screen__title screen__title--lemons">{title}</h1>
        </div>

        <div className="driver-status-badges">
          {statuses.map((status) => (
            <article key={status.id} className={`driver-status-badge driver-status-badge--${status.state}`}>
              <span className="driver-status-badge__label">{status.label}</span>
              <span className="driver-status-badge__value">{status.value}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="driver-top-strip__lights">
        <div className="driver-shift-header">
          <span className="driver-shift-header__label">Shift Lights</span>
          <span className="driver-shift-header__detail">{focus.rpm.detail}</span>
        </div>
        <ShiftLights activeCount={focus.rpm.shiftLightCount} state={focus.rpm.shiftState} />
      </div>

      <DriverAlertStrip alerts={alerts} clearDetail={summary} />
    </section>
  );
}
